const router = require('express').Router();
const multer = require('multer');
const prisma = require('../config/database');
const { authenticate, requireAdmin, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateQuiz, generateSummary, generateFlashcards, generateManagerInsight, extractTextFromBuffer } = require('../services/aiService');
const { analyzeRisk } = require('../services/riskService');
const { calculateRetentionScore } = require('../services/retentionService');
const { generateRecommendations } = require('../services/recommendationService');

const quizUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Generate quiz from content (text body)
router.post('/generate-quiz', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { content, contentType = 'PDF', difficulty = 'MEDIUM', count = 10, courseTitle = '', courseId } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const questions = await generateQuiz({ content, contentType, difficulty, count, courseTitle });

  if (courseId) {
    const diffLabel = difficulty === 'MIXED' ? 'Mixed Difficulty' : difficulty;
    let quiz = await prisma.quiz.create({
      data: { courseId: Number(courseId), title: `AI Quiz - ${courseTitle || 'Course'} (${diffLabel})`, isAIGenerated: true, passingScore: 70 },
    });
    await prisma.question.createMany({
      data: questions.map((q, i) => ({
        quizId: quiz.id, text: q.text, type: q.type, difficulty: q.difficulty,
        options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation,
        points: q.points || 10, order: i + 1,
      })),
    });
    quiz = await prisma.quiz.findUnique({ where: { id: quiz.id }, include: { questions: true } });
    return res.json({ quiz, questions });
  }

  res.json({ questions });
}));

// Generate quiz from uploaded file (PDF, DOCX, TXT)
router.post('/generate-quiz-from-upload', authenticate, requireAdmin,
  quizUpload.single('file'),
  asyncHandler(async (req, res) => {
    const { courseId, courseTitle = '', difficulty = 'MIXED', count = 10, contentType = 'PDF' } = req.body;

    let content = req.body.content || '';

    if (req.file) {
      try {
        content = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      } catch (err) {
        return res.status(422).json({ error: `Could not extract text from file: ${err.message}` });
      }
    }

    if (!content.trim()) return res.status(400).json({ error: 'No content found. Provide a file or paste text.' });

    const questions = await generateQuiz({ content, contentType, difficulty, count: Number(count), courseTitle });

    if (courseId) {
      const diffLabel = difficulty === 'MIXED' ? 'Mixed Difficulty' : difficulty;
      let quiz = await prisma.quiz.create({
        data: {
          courseId: Number(courseId),
          title: `AI Quiz - ${courseTitle || 'Course'} (${diffLabel})`,
          isAIGenerated: true,
          passingScore: 70,
        },
      });
      await prisma.question.createMany({
        data: questions.map((q, i) => ({
          quizId: quiz.id, text: q.text, type: q.type, difficulty: q.difficulty,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation,
          points: q.points || 10, order: i + 1,
        })),
      });
      quiz = await prisma.quiz.findUnique({ where: { id: quiz.id }, include: { questions: true } });
      return res.json({ quiz, questions });
    }

    res.json({ questions });
  })
);

// Generate course summary
router.post('/generate-summary', authenticate, asyncHandler(async (req, res) => {
  const { content, contentType = 'VIDEO', courseTitle = '' } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  const summary = await generateSummary({ content, contentType, courseTitle });
  res.json({ summary });
}));

// Generate flashcards
router.post('/generate-flashcards', authenticate, asyncHandler(async (req, res) => {
  const { content, moduleTitle = '', count = 10, moduleId } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const flashcards = await generateFlashcards({ content, moduleTitle, count });

  if (moduleId) {
    await prisma.flashcard.deleteMany({ where: { moduleId: Number(moduleId) } });
    await prisma.flashcard.createMany({
      data: flashcards.map((f, i) => ({ moduleId: Number(moduleId), front: f.front, back: f.back, order: i + 1 })),
    });
  }

  res.json({ flashcards });
}));

// AI Manager Copilot
router.post('/copilot/query', authenticate, requireManager, asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const managerId = req.user.id;
  const team = await prisma.user.findMany({
    where: { managerId },
    include: {
      retentionScore: true,
      riskProfile: true,
      streak: true,
      points: true,
      enrollments: { include: { course: true } },
      quizAttempts: { orderBy: { completedAt: 'desc' }, take: 5 },
    },
  });

  const teamData = {
    total: team.length,
    members: team.map(u => ({
      name: u.name,
      department: u.department,
      designation: u.designation,
      retentionScore: Math.round(u.retentionScore?.score || 0),
      riskLevel: u.riskProfile?.riskLevel || 'LOW',
      streak: u.streak?.currentStreak || 0,
      points: u.points?.totalPoints || 0,
      weeklyPoints: u.points?.weeklyPoints || 0,
      coursesEnrolled: u.enrollments.length,
      coursesCompleted: u.enrollments.filter(e => e.completedAt).length,
      recentCourses: u.enrollments.slice(0, 3).map(e => ({
        title: e.course?.title,
        progress: Math.round(e.progressPercent || 0),
        completed: !!e.completedAt,
      })),
      recentQuizScores: u.quizAttempts.map(a => Math.round((a.score / a.totalPoints) * 100)),
      avgQuizScore: u.quizAttempts.length
        ? Math.round(u.quizAttempts.reduce((s, a) => s + (a.score / a.totalPoints) * 100, 0) / u.quizAttempts.length)
        : null,
    })),
    summary: {
      highRisk: team.filter(u => ['HIGH', 'CRITICAL'].includes(u.riskProfile?.riskLevel)).length,
      avgRetention: team.length ? Math.round(team.reduce((s, u) => s + (u.retentionScore?.score || 0), 0) / team.length) : 0,
      totalPointsThisWeek: team.reduce((s, u) => s + (u.points?.weeklyPoints || 0), 0),
    },
  };

  const insight = await generateManagerInsight({ query, teamData });
  res.json({ insight, teamSummary: { total: teamData.total, ...teamData.summary, data: teamData.members } });
}));

// Risk analysis for a user
router.get('/risk-analysis/:userId', authenticate, requireManager, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const risk = await analyzeRisk(userId);
  res.json(risk);
}));

// Retention score
router.get('/retention/:userId', authenticate, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  if (req.user.role === 'LEARNER' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const retention = await calculateRetentionScore(userId);
  res.json(retention);
}));

router.post('/retention/recalculate', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { recalculateAll } = require('../services/retentionService');
  recalculateAll().catch(() => {});
  res.json({ message: 'Recalculation started' });
}));

// Learning recommendations
router.get('/recommendations/:userId', authenticate, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  if (req.user.role === 'LEARNER' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const recommendations = await generateRecommendations(userId);
  res.json(recommendations);
}));

// Flashcards for a module
router.get('/flashcards/:moduleId', authenticate, asyncHandler(async (req, res) => {
  const flashcards = await prisma.flashcard.findMany({
    where: { moduleId: Number(req.params.moduleId) },
    orderBy: { order: 'asc' },
  });
  res.json(flashcards);
}));

// RAG Q&A endpoint for JC learners
router.post('/ask', authenticate, asyncHandler(async (req, res) => {
  const { question, courseId } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Question is required' });

  const { searchSimilar } = require('../services/embeddingService');
  const { ragAnswer } = require('../services/aiService');

  const { context, sources, chunks } = await searchSimilar(question, {
    courseId: courseId ? Number(courseId) : undefined,
    includeDocmost: true,
    limit: 6,
  });

  const result = await ragAnswer({
    question,
    context,
    sources,
    userId: req.user.id,
  });

  // Log interaction
  await prisma.aIInteraction.create({
    data: {
      userId: req.user.id,
      sessionId: `http_${req.user.id}_${Date.now()}`,
      role: 'user',
      content: question,
    },
  }).catch(() => {});

  res.json({
    answer: result.answer,
    sources: result.sources,
    chunks: chunks.slice(0, 3).map(c => ({ source: c.source, excerpt: c.text.substring(0, 200) })),
  });
}));

// AI-powered course recommendations
router.get('/ai-recommendations/:userId', authenticate, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  // Users can only view their own recommendations unless admin/manager
  if (req.user.id !== userId && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { generateAIRecommendations, generateRecommendations } = require('../services/recommendationService');

  // Run both in parallel: AI analysis + standard rules-based
  const [aiRecs, standardRecs] = await Promise.all([
    generateAIRecommendations(userId),
    generateRecommendations(userId),
  ]);

  // Merge: AI recommendations come first, then standard ones not already in AI list
  const aiCourseIds = new Set(aiRecs.map(r => r.courseId));
  const merged = [
    ...aiRecs.map(r => ({ ...r, source: 'ai', course: standardRecs.find(s => s.courseId === r.courseId)?.course })),
    ...standardRecs.filter(r => !aiCourseIds.has(r.courseId)).slice(0, 5).map(r => ({ ...r, source: 'rules' })),
  ];

  // Enrich with course data for any AI recs missing course info
  const missingCourseIds = merged.filter(r => !r.course).map(r => r.courseId);
  if (missingCourseIds.length) {
    const courses = await prisma.course.findMany({
      where: { id: { in: missingCourseIds } },
      include: { modules: { select: { contentType: true }, take: 5 } },
    });
    for (const rec of merged) {
      if (!rec.course) {
        const c = courses.find(c => c.id === rec.courseId);
        if (c) {
          rec.course = c;
          rec.contentTypes = [...new Set(c.modules.map(m => m.contentType))];
        }
      }
    }
  }

  res.json(merged.filter(r => r.course).slice(0, 8));
}));

// AI/Embedding health check
router.get('/health', authenticate, asyncHandler(async (req, res) => {
  const { testEmbedding } = require('../services/embeddingService');
  const { getRedis } = require('../services/redisService');

  const [embeddingTest, redisStatus, geminiKeyPresent] = await Promise.all([
    testEmbedding().catch(err => ({ error: err.message })),
    (async () => {
      try {
        const r = getRedis();
        await r.ping();
        return 'connected';
      } catch { return 'disconnected'; }
    })(),
    Promise.resolve(!!process.env.GEMINI_API_KEY),
  ]);

  const qdrantStatus = await (async () => {
    try {
      const { ensureCollection } = require('../services/embeddingService');
      await ensureCollection();
      return 'connected';
    } catch { return 'disconnected'; }
  })();

  res.json({
    gemini: { keyPresent: geminiKeyPresent, embedding: embeddingTest },
    redis: redisStatus,
    qdrant: qdrantStatus,
    timestamp: new Date(),
  });
}));

module.exports = router;
