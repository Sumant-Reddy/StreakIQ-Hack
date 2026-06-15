const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { enqueueEvent } = require('../queues/learningQueue');

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { courseId } = req.query;
  const where = courseId ? { courseId: Number(courseId) } : {};
  const quizzes = await prisma.quiz.findMany({
    where,
    include: { _count: { select: { questions: true, attempts: true } } },
  });
  res.json(quizzes);
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      questions: { orderBy: { order: 'asc' } },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const myAttempts = await prisma.quizAttempt.findMany({
    where: { userId: req.user.id, quizId: quiz.id },
    orderBy: { completedAt: 'desc' },
    take: 5,
  });

  res.json({ ...quiz, myAttempts });
}));

router.post('/:id/attempt', authenticate, asyncHandler(async (req, res) => {
  const { answers, timeTaken } = req.body;
  const quiz = await prisma.quiz.findUnique({
    where: { id: Number(req.params.id) },
    include: { questions: true },
  });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  let score = 0;
  const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
  const answerRecords = [];

  for (const question of quiz.questions) {
    const submitted = answers[question.id];
    const isCorrect = submitted === question.correctAnswer;
    if (isCorrect) score += question.points;
    answerRecords.push({ questionId: question.id, answer: submitted || '', isCorrect });
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId: req.user.id,
      quizId: quiz.id,
      score,
      totalPoints,
      timeTaken,
      answers: { create: answerRecords },
    },
    include: { answers: true },
  });

  await enqueueEvent('QUIZ_COMPLETED', req.user.id, { score, totalPoints });

  const percentage = Math.round((score / totalPoints) * 100);
  res.json({
    attempt,
    score,
    totalPoints,
    percentage,
    passed: percentage >= quiz.passingScore,
    breakdown: quiz.questions.map(q => ({
      question: q.text,
      correct: answerRecords.find(a => a.questionId === q.id)?.isCorrect,
      explanation: q.explanation,
    })),
  });
}));

router.get('/:id/attempts', authenticate, asyncHandler(async (req, res) => {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: req.user.id, quizId: Number(req.params.id) },
    orderBy: { completedAt: 'desc' },
  });
  res.json(attempts);
}));

module.exports = router;
