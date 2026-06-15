const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getTeamRiskSummary } = require('../services/riskService');
const { getSkillHeatmap } = require('../services/recommendationService');

router.get('/team', authenticate, requireManager, asyncHandler(async (req, res) => {
  const managerId = req.user.id;
  const team = await prisma.user.findMany({
    where: { managerId },
    include: {
      retentionScore: true,
      riskProfile: true,
      streak: true,
      points: true,
      enrollments: { select: { courseId: true, progressPercent: true, completedAt: true } },
      badges: { include: { badge: true } },
    },
  });
  res.json(team);
}));

router.get('/team/summary', authenticate, requireManager, asyncHandler(async (req, res) => {
  const team = await prisma.user.findMany({
    where: { managerId: req.user.id },
    include: { retentionScore: true, riskProfile: true, streak: true },
  });

  const avgRetention = team.length
    ? team.reduce((s, u) => s + (u.retentionScore?.score || 0), 0) / team.length
    : 0;

  const riskBreakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  team.forEach(u => { if (u.riskProfile?.riskLevel) riskBreakdown[u.riskProfile.riskLevel]++; });

  const activeStreaks = team.filter(u => (u.streak?.currentStreak || 0) > 0).length;

  const quizStats = await prisma.quizAttempt.aggregate({
    where: { user: { managerId: req.user.id } },
    _avg: { score: true },
    _count: { id: true },
  });

  res.json({
    totalLearners: team.length,
    avgRetentionScore: Math.round(avgRetention * 10) / 10,
    activeStreaks,
    riskBreakdown,
    atRisk: riskBreakdown.HIGH + riskBreakdown.CRITICAL,
    quizAttempts: quizStats._count.id,
    avgQuizScore: Math.round((quizStats._avg.score || 0) * 10) / 10,
  });
}));

router.get('/team/:userId/audit', authenticate, requireManager, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      retentionScore: true,
      riskProfile: true,
      streak: true,
      points: true,
      badges: { include: { badge: true } },
      enrollments: {
        include: { course: { include: { modules: { select: { id: true, title: true, duration: true } } } } },
      },
      quizAttempts: { orderBy: { completedAt: 'desc' }, take: 20, include: { quiz: true } },
      aiInteractions: { orderBy: { createdAt: 'desc' }, take: 5 },
      interventions: { orderBy: { createdAt: 'desc' }, take: 5 },
      recommendations: { include: { course: true }, take: 5 },
    },
  });

  if (!user || user.managerId !== req.user.id) {
    return res.status(404).json({ error: 'User not found or access denied' });
  }

  const { passwordHash, ...safeUser } = user;

  const avgScore = user.quizAttempts.length
    ? user.quizAttempts.reduce((s, a) => s + (a.score / a.totalPoints) * 100, 0) / user.quizAttempts.length
    : 0;

  const learningHours = user.enrollments.reduce((sum, e) => {
    return sum + e.course.modules.reduce((s, m) => s + m.duration / 3600, 0) * (e.progressPercent / 100);
  }, 0);

  res.json({
    ...safeUser,
    avgQuizScore: Math.round(avgScore),
    learningHours: Math.round(learningHours * 10) / 10,
    coursesAssigned: user.enrollments.length,
    coursesCompleted: user.enrollments.filter(e => e.completedAt).length,
    quizAttempts: user.quizAttempts.length,
  });
}));

router.get('/skill-heatmap', authenticate, requireManager, asyncHandler(async (req, res) => {
  const heatmap = await getSkillHeatmap(req.user.id);
  res.json(heatmap);
}));

router.get('/certification-readiness', authenticate, requireManager, asyncHandler(async (req, res) => {
  const team = await prisma.user.findMany({
    where: { managerId: req.user.id },
    include: {
      retentionScore: true,
      riskProfile: true,
      quizAttempts: { orderBy: { completedAt: 'desc' }, take: 10 },
      enrollments: { where: { completedAt: { not: null } } },
    },
  });

  const readiness = team.map(u => {
    const avgScore = u.quizAttempts.length
      ? u.quizAttempts.reduce((s, a) => s + (a.score / a.totalPoints) * 100, 0) / u.quizAttempts.length
      : 0;
    const retention = u.retentionScore?.score || 0;
    const completionRate = u.enrollments.length > 0 ? (u.enrollments.filter(e => e.completedAt).length / u.enrollments.length) * 100 : 0;
    const readinessScore = Math.round(avgScore * 0.4 + retention * 0.4 + completionRate * 0.2);

    return {
      id: u.id,
      name: u.name,
      department: u.department,
      readinessScore,
      avgQuizScore: Math.round(avgScore),
      retentionScore: retention,
      completionRate: Math.round(completionRate),
      status: readinessScore >= 80 ? 'READY' : readinessScore >= 60 ? 'NEARLY_READY' : 'NOT_READY',
      riskLevel: u.riskProfile?.riskLevel || 'LOW',
    };
  });

  res.json(readiness);
}));

module.exports = router;
