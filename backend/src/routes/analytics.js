const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireAdmin, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/admin/overview', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [userCount, courseCount, enrollmentCount, quizAttempts, avgRetention] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.course.count({ where: { isPublished: true } }),
    prisma.enrollment.count(),
    prisma.quizAttempt.count(),
    prisma.retentionScore.aggregate({ _avg: { score: true } }),
  ]);

  const roleBreakdown = await prisma.user.groupBy({ by: ['role'], _count: { id: true } });
  const riskBreakdown = await prisma.riskProfile.groupBy({ by: ['riskLevel'], _count: { id: true } });

  const recentActivity = await prisma.quizAttempt.findMany({
    orderBy: { completedAt: 'desc' },
    take: 10,
    include: { user: { select: { name: true, department: true } }, quiz: { select: { title: true } } },
  });

  res.json({
    overview: {
      users: userCount,
      courses: courseCount,
      enrollments: enrollmentCount,
      quizAttempts,
      avgRetention: Math.round((avgRetention._avg.score || 0) * 10) / 10,
    },
    roleBreakdown,
    riskBreakdown,
    recentActivity,
  });
}));

router.get('/learning-trends', authenticate, requireManager, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const attempts = await prisma.quizAttempt.findMany({
    where: { completedAt: { gte: since }, user: { managerId: req.user.id } },
    select: { completedAt: true, score: true, totalPoints: true },
  });

  const byDay = {};
  attempts.forEach(a => {
    const day = a.completedAt.toISOString().split('T')[0];
    if (!byDay[day]) byDay[day] = { count: 0, totalScore: 0 };
    byDay[day].count++;
    byDay[day].totalScore += (a.score / a.totalPoints) * 100;
  });

  const trend = Object.entries(byDay).map(([date, d]) => ({
    date,
    attempts: d.count,
    avgScore: Math.round(d.totalScore / d.count),
  })).sort((a, b) => a.date.localeCompare(b.date));

  res.json(trend);
}));

module.exports = router;
