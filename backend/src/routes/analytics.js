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

// Activity heatmap — daily event counts for the last N weeks (default 12)
router.get('/heatmap', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const weeks = Math.min(parseInt(req.query.weeks) || 12, 52);
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  const [quizAttempts, watchSessions, enrollments] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { completedAt: { gte: since } },
      select: { completedAt: true, score: true, totalPoints: true },
    }),
    prisma.watchSession.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.enrollment.findMany({
      where: { enrolledAt: { gte: since } },
      select: { enrolledAt: true },
    }),
  ]);

  const byDay = {};

  const inc = (date, type, value = 1) => {
    const day = date.toISOString().split('T')[0];
    if (!byDay[day]) byDay[day] = { quiz: 0, watch: 0, enroll: 0, total: 0 };
    byDay[day][type] += value;
    byDay[day].total += value;
  };

  quizAttempts.forEach(a => inc(a.completedAt, 'quiz'));
  watchSessions.forEach(s => inc(s.createdAt, 'watch'));
  enrollments.forEach(e => inc(e.enrolledAt, 'enroll'));

  // Fill every day in the range with zeros so the grid renders complete
  const cells = [];
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  while (cursor <= today) {
    const key = cursor.toISOString().split('T')[0];
    cells.push({ date: key, ...(byDay[key] || { quiz: 0, watch: 0, enroll: 0, total: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json(cells);
}));

// Department + skill heatmap — avg quiz score by department × course tag
router.get('/skill-heatmap', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const attempts = await prisma.quizAttempt.findMany({
    include: {
      user: { select: { department: true } },
      quiz: { include: { course: { select: { tags: true, title: true } } } },
    },
  });

  // Aggregate: department → tag → { totalScore, count }
  const matrix = {};
  const allTags = new Set();
  const allDepts = new Set();

  attempts.forEach(a => {
    const dept = a.user?.department || 'Unknown';
    const score = a.totalPoints > 0 ? Math.round((a.score / a.totalPoints) * 100) : 0;
    const tags = (a.quiz?.course?.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    allDepts.add(dept);
    if (!matrix[dept]) matrix[dept] = {};

    tags.forEach(tag => {
      allTags.add(tag);
      if (!matrix[dept][tag]) matrix[dept][tag] = { total: 0, count: 0 };
      matrix[dept][tag].total += score;
      matrix[dept][tag].count += 1;
    });
  });

  // Convert to avg scores
  const departments = [...allDepts].sort();
  const tags = [...allTags].sort();

  const rows = departments.map(dept => ({
    department: dept,
    scores: tags.map(tag => {
      const cell = matrix[dept]?.[tag];
      return cell ? Math.round(cell.total / cell.count) : null;
    }),
  }));

  res.json({ departments, tags, rows });
}));

router.get('/learning-trends', authenticate, requireManager, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      completedAt: { gte: since },
      ...(req.user.role === 'MANAGER' ? { user: { managerId: req.user.id } } : {}),
    },
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
