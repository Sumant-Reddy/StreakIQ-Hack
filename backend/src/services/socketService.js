const jwt = require('jsonwebtoken');
const { generateRoleplayResponse } = require('./aiService');
const { answerQuestion } = require('./aiService');
const prisma = require('../config/database');
const logger = require('../utils/logger');

function setupSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: user ${socket.userId}`);

    socket.on('ai:message', async ({ sessionId, message, courseId, courseTitle }) => {
      try {
        const { searchSimilar } = require('./embeddingService');
        const context = await searchSimilar(message, { courseId });
        const response = await answerQuestion({ question: message, context, userId: socket.userId, courseTitle });

        await prisma.aIInteraction.create({
          data: { userId: socket.userId, sessionId, role: 'user', content: message },
        });
        await prisma.aIInteraction.create({
          data: { userId: socket.userId, sessionId, role: 'assistant', content: response },
        });

        socket.emit('ai:response', { sessionId, message: response, timestamp: new Date() });
      } catch (err) {
        logger.error('AI socket error:', err.message);
        socket.emit('ai:error', { message: 'AI temporarily unavailable' });
      }
    });

    socket.on('roleplay:start', async ({ scenario, customerPersona }) => {
      const sessionId = `rp_${socket.userId}_${Date.now()}`;
      socket.roleplaySession = { sessionId, scenario, customerPersona, transcript: [] };

      const greeting = await generateRoleplayResponse({
        scenario,
        customerPersona,
        transcript: [],
      });

      socket.roleplaySession.transcript.push({ role: 'customer', content: greeting });
      socket.emit('roleplay:message', { role: 'customer', content: greeting, sessionId });
    });

    socket.on('roleplay:respond', async ({ message }) => {
      if (!socket.roleplaySession) return;
      const { scenario, customerPersona, transcript, sessionId } = socket.roleplaySession;

      transcript.push({ role: 'consultant', content: message });

      const customerReply = await generateRoleplayResponse({ scenario, customerPersona, transcript });
      transcript.push({ role: 'customer', content: customerReply });

      socket.emit('roleplay:message', { role: 'customer', content: customerReply, sessionId });
    });

    socket.on('roleplay:end', async () => {
      if (!socket.roleplaySession) return;
      const { scenario, transcript, sessionId } = socket.roleplaySession;
      const { scoreRoleplay } = require('./aiService');
      const scores = await scoreRoleplay({ transcript, scenario });

      await prisma.roleplaySessions.create({
        data: {
          userId: socket.userId,
          scenario,
          transcript,
          ...scores,
        },
      });

      socket.emit('roleplay:scored', { ...scores, sessionId });
      socket.roleplaySession = null;
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${socket.userId}`);
    });
  });
}

module.exports = { setupSocketHandlers };
