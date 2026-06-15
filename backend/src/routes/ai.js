const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireAdmin, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateQuiz, generateSummary, generateFlashcards, generateManagerInsight } = require('../services/aiService');
const { analyzeRisk } = require('../services/riskService');
const { calculateRetentionScore } = require('../services/retentionService');
const { generateRecommendations } = require('../services/recommendationService');

// Generate quiz from content
router.post('/generate-quiz', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { content, contentType = 'PDF', difficulty = 'MEDIUM', count = 10, courseTitle = '', courseId } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const questions = await generateQuiz({ content, contentType, difficulty, count, courseTitle });

  if (courseId) {
    let quiz = await prisma.quiz.create({
      data: { courseId: Number(courseId), title: `AI Quiz - ${courseTitle}`, isAIGenerated: true, passingScore: 70 },
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

  const teamData = team.map(u => ({
    name: u.name,
    department: u.department,
    designation: u.designation,
    retentionScore: u.retentionScore?.score || 0,
    riskLevel: u.riskProfile?.riskLevel || 'UNKNOWN',
    streak: u.streak?.currentStreak || 0,
    points: u.points?.totalPoints || 0,
    coursesCompleted: u.enrollments.filter(e => e.completedAt).length,
    avgQuizScore: u.quizAttempts.length
      ? u.quizAttempts.reduce((s, a) => s + (a.score / a.totalPoints) * 100, 0) / u.quizAttempts.length
      : 0,
  }));

  const insight = await generateManagerInsight({ query, teamData });
  res.json({ insight, teamSummary: { total: team.length, data: teamData } });
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

module.exports = router;
