const jwt = require('jsonwebtoken');
const { generateRoleplayResponse, answerQuestion, ragAnswer } = require('./aiService');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const SKILL_KEYWORDS = {
  'Diamond Knowledge': /\b(4c|four c|cut|carat|clarity|colou?r|diamond|grading|brilliant|facet|inclusion|fluorescence)\b/i,
  'Upselling': /\b(upsell|upgrade|higher|premium|better quality|recommend|bundle)\b/i,
  'Customer Handling': /\b(customer|complaint|objection|price|budget|negotiat|concern|refund|return|difficult|angry)\b/i,
  'Metal Knowledge': /\b(gold|platinum|silver|metal|karat|rhodium|white gold|yellow gold|rose gold)\b/i,
  'Product Knowledge': /\b(solitaire|halo|eternity|pendant|bracelet|necklace|ring|earring|bangle|mangalsutra|chain)\b/i,
  'Certification Knowledge': /\b(gia|igi|bis|hallmark|certif|authentic|lab.grown|lab report)\b/i,
  'Jewelry Care': /\b(care|maintain|clean|polish|store|scratch|tarnish|repair|warranty|service)\b/i,
};

async function updateSkillScores(userId, text) {
  const detected = Object.entries(SKILL_KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([skill]) => skill);
  if (!detected.length) return;
  await Promise.all(detected.map(skill =>
    prisma.skillScore.upsert({
      where: { userId_skill: { userId, skill } },
      create: { userId, skill, score: 1 },
      update: { score: { increment: 1 } },
    }).catch(() => {})
  ));
}

function setupSocketHandlers(io) {
  // 1. Socket Authentication Middleware (Triggers when frontend client connects)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // 2. Active Connection Management
  io.on('connection', (socket) => {
    logger.info(`Socket connected: user ${socket.userId}`);

    // AI Message Handler (RAG Flow)
    socket.on('ai:message', async ({ sessionId, message, courseId, courseTitle }) => {
      try {
        const { searchSimilar } = require('./embeddingService');
        const { getRedis } = require('./redisService');

        // Fix 4: Cache RAG responses to avoid redundant LLM + embedding calls
        const redis = getRedis();
        const cacheKey =
          'ai:answer:' +
          Buffer.from((sessionId + message).slice(0, 50))
            .toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 32);

        const cachedAnswer = await redis.get(cacheKey).catch(() => null);
        if (cachedAnswer) {
          socket.emit('ai:response', {
            sessionId,
            message: cachedAnswer,
            sources: [],
            timestamp: new Date(),
            fromCache: true,
          });
          return;
        }

        const { context, sources } = await searchSimilar(message, { courseId, includeDocmost: true });
        const { answer } = await ragAnswer({ question: message, context, sources, userId: socket.userId, courseTitle });

        // Persist to cache (30 min TTL) — best-effort, never block the response
        redis.setex(cacheKey, 1800, answer).catch(() => {});

        await prisma.aIInteraction.create({
          data: { userId: socket.userId, sessionId, role: 'user', content: message },
        });
        await prisma.aIInteraction.create({
          data: { userId: socket.userId, sessionId, role: 'assistant', content: answer },
        });

        const { checkAllBadges } = require('../services/gamificationService');
        checkAllBadges(socket.userId).catch(() => {});
        updateSkillScores(socket.userId, message + ' ' + (sources || []).join(' ')).catch(() => {});

        socket.emit('ai:response', { sessionId, message: answer, sources, timestamp: new Date() });
      } catch (err) {
        logger.error('AI socket error:', err.message);
        socket.emit('ai:error', { message: 'AI temporarily unavailable' });
      }
    });

    // Roleplay Start Handler
    socket.on('roleplay:start', async ({ scenario, customerPersona }) => {
      const sessionId = `rp_${socket.userId}_${Date.now()}`;
      socket.roleplaySession = { sessionId, scenario, customerPersona, transcript: [] };

      let greeting;
      try {
        // Cache opening greetings by scenario to avoid repeated LLM calls (1hr TTL)
        const { getRedis } = require('./redisService');
        const redis = getRedis();
        const cacheKey = `roleplay:greeting:${Buffer.from(scenario + customerPersona).toString('base64').slice(0, 32)}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
          greeting = cached;
        } else {
          greeting = await generateRoleplayResponse({ scenario, customerPersona, transcript: [] });
          await redis.setex(cacheKey, 3600, greeting);
        }
      } catch {
        greeting = await generateRoleplayResponse({ scenario, customerPersona, transcript: [] });
      }

      socket.roleplaySession.transcript.push({ role: 'customer', content: greeting });
      // Store active session in Redis
      try {
        const { getRedis } = require('./redisService');
        const redis = getRedis();
        await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(socket.roleplaySession));
      } catch (_) {}
      socket.emit('roleplay:message', { role: 'customer', content: greeting, sessionId });
    });

    // Roleplay Core Response Handler
    // Fix 1: Wrap in try/catch so errors surface to the client instead of silently dropping
    socket.on('roleplay:respond', async ({ message }) => {
      if (!socket.roleplaySession) return;
      const { scenario, customerPersona, transcript, sessionId } = socket.roleplaySession;

      transcript.push({ role: 'consultant', content: message });

      try {
        const customerReply = await generateRoleplayResponse({ scenario, customerPersona, transcript });
        transcript.push({ role: 'customer', content: customerReply });

        // Fix 2: Persist full updated transcript back to Redis after every turn
        try {
          const { getRedis } = require('./redisService');
          const redis = getRedis();
          await redis.setex('session:' + sessionId, 3600, JSON.stringify(socket.roleplaySession));
        } catch (redisErr) {
          logger.warn('Redis transcript persist failed:', redisErr.message);
        }

        socket.emit('roleplay:message', { role: 'customer', content: customerReply, sessionId });
      } catch (err) {
        logger.error('roleplay:respond error:', err.message);
        socket.emit('roleplay:error', { message: 'Failed to generate roleplay response. Please try again.' });
      }
    });

    // Fix 3: Restore a roleplay session from Redis on page refresh / reconnect
    socket.on('roleplay:restore', async ({ sessionId }) => {
      try {
        const { getRedis } = require('./redisService');
        const redis = getRedis();
        const raw = await redis.get('session:' + sessionId);
        if (!raw) {
          socket.emit('roleplay:error', { message: 'Session not found or expired.' });
          return;
        }
        const session = JSON.parse(raw);
        socket.roleplaySession = session;

        // Re-emit every message in the transcript so the frontend can rebuild the UI
        for (const turn of session.transcript) {
          socket.emit('roleplay:message', {
            role: turn.role,
            content: turn.content,
            sessionId,
            restored: true,
          });
        }
        logger.info(`Restored roleplay session ${sessionId} for user ${socket.userId}`);
      } catch (err) {
        logger.error('roleplay:restore error:', err.message);
        socket.emit('roleplay:error', { message: 'Failed to restore session.' });
      }
    });

    // Fix 5: Lightweight ping/pong so the frontend can verify the socket is alive
    socket.on('roleplay:ping', () => {
      socket.emit('roleplay:pong', { timestamp: new Date() });
    });

    // Roleplay Termination and Evaluation Handler
    socket.on('roleplay:end', async () => {
      if (!socket.roleplaySession) return;
      const { scenario, transcript, sessionId } = socket.roleplaySession;
      socket.roleplaySession = null;

      try {
        const { scoreRoleplay } = require('./aiService');
        const rawScores = await scoreRoleplay({ transcript, scenario });

        const clamp = (v) => (typeof v === 'number' && !isNaN(v)) ? Math.min(100, Math.max(0, Math.round(v))) : null;
        const ps  = clamp(rawScores.productScore);
        const cs  = clamp(rawScores.confidenceScore);
        const cms = clamp(rawScores.communicationScore);
        const us  = clamp(rawScores.upsellScore);
        const nums = [ps, cs, cms, us].filter(n => n !== null);
        const scores = {
          productScore:       ps,
          confidenceScore:    cs,
          communicationScore: cms,
          upsellScore:        us,
          overallScore:       clamp(rawScores.overallScore) ?? (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null),
          feedback:           typeof rawScores.feedback === 'string' ? rawScores.feedback : '',
          strengths:          Array.isArray(rawScores.strengths)    ? rawScores.strengths    : [],
          improvements:       Array.isArray(rawScores.improvements) ? rawScores.improvements : [],
        };

        await prisma.roleplaySessions.create({
          data: { userId: socket.userId, scenario, transcript, ...scores },
        });

        const roleplaySkillMap = [
          { skill: 'Product Knowledge', value: scores.productScore },
          { skill: 'Customer Handling', value: scores.communicationScore },
          { skill: 'Upselling',         value: scores.upsellScore },
        ];
        await Promise.all(roleplaySkillMap.map(({ skill, value }) => {
          if (value == null) return Promise.resolve();
          return prisma.skillScore.upsert({
            where:  { userId_skill: { userId: socket.userId, skill } },
            create: { userId: socket.userId, skill, score: Number(value) },
            update: { score: Number(value) },
          }).catch(() => {});
        }));

        const { checkAllBadges } = require('../services/gamificationService');
        checkAllBadges(socket.userId).catch(() => {});

        socket.emit('roleplay:scored', { ...scores, sessionId });
      } catch (err) {
        logger.error('roleplay:end error:', err.message);
        socket.emit('roleplay:error', { message: 'Scoring failed. Please try again.' });
      }
    });

    // Disconnection Clean up
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${socket.userId}`);
    });
  });
}

module.exports = { setupSocketHandlers };
