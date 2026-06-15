const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [enrollments, streak, points, retention, risk, badges, recentActivity] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      include: { course: { include: { modules: { select: { duration: true } } } } },
      orderBy: { lastAccessedAt: 'desc' },
      take: 5,
    }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userPoints.findUnique({ where: { userId } }),
    prisma.retentionScore.findUnique({ where: { userId } }),
    prisma.riskProfile.findUnique({ where: { userId } }),
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
      take: 5,
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      include: { quiz: true },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
  ]);

  const totalHours = enrollments.reduce((sum, e) => {
    const moduleHours = e.course.modules.reduce((s, m) => s + m.duration / 3600, 0);
    return sum + moduleHours * (e.progressPercent / 100);
  }, 0);

  res.json({
    enrollments,
    streak: streak || { currentStreak: 0, longestStreak: 0 },
    points: points || { totalPoints: 0, weeklyPoints: 0 },
    retention: retention || { score: 0 },
    risk: risk || { riskLevel: 'LOW' },
    recentBadges: badges.map(b => b.badge),
    recentActivity,
    totalHours: Math.round(totalHours * 10) / 10,
    coursesInProgress: enrollments.filter(e => !e.completedAt && e.progressPercent > 0).length,
    coursesCompleted: enrollments.filter(e => e.completedAt).length,
  });
}));

router.get('/learning-path', authenticate, asyncHandler(async (req, res) => {
  const paths = await prisma.userLearningPath.findMany({
    where: { userId: req.user.id },
    include: {
      learningPath: {
        include: {
          courses: {
            include: { course: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });
  res.json(paths);
}));

router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const [attempts, watchSessions] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId: req.user.id },
      include: { quiz: { include: { course: true } } },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * limit,
      take: Number(limit),
    }),
    prisma.watchSession.findMany({
      where: { userId: req.user.id },
      include: { module: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  res.json({ quizAttempts: attempts, watchSessions });
}));

router.get('/roleplays', authenticate, asyncHandler(async (req, res) => {
  const sessions = await prisma.roleplaySessions.findMany({
    where: { userId: req.user.id },
    orderBy: { completedAt: 'desc' },
  });
  res.json(sessions);
}));

module.exports = router;
