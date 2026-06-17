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

// Learner: see all active certifications + their personal readiness per cert
router.get('/certifications', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [certs, enrollments, attempts] = await Promise.all([
    prisma.certification.findMany({
      where: { isActive: true },
      include: {
        courses: { include: { course: { select: { id: true, title: true, department: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true, progressPercent: true, completedAt: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      include: { quiz: { select: { courseId: true } } },
    }),
  ]);

  const enrollMap = Object.fromEntries(enrollments.map(e => [e.courseId, e]));

  // For each quiz, get best score per courseId
  const bestByCourse = {};
  for (const a of attempts) {
    const cid = a.quiz?.courseId;
    if (!cid) continue;
    const pct = (a.score / a.totalPoints) * 100;
    if (!bestByCourse[cid] || pct > bestByCourse[cid]) bestByCourse[cid] = pct;
  }

  const result = certs.map(cert => {
    const requiredCourses = cert.courses.map(cc => cc.course);
    const courseDetails = requiredCourses.map(c => {
      const enroll = enrollMap[c.id];
      const quizScore = bestByCourse[c.id] || null;
      const completion = enroll?.progressPercent || 0;
      const completionMet = completion >= cert.minCourseCompletion;
      const quizMet = quizScore !== null && quizScore >= cert.minQuizScore;
      const enrolled = !!enroll;
      return { ...c, completion: Math.round(completion), quizScore: quizScore ? Math.round(quizScore) : null, completionMet, quizMet, enrolled };
    });

    const totalRequired = requiredCourses.length;
    const completionReady = totalRequired === 0 ? 0 : courseDetails.filter(c => c.completionMet).length / totalRequired;
    const quizReady = totalRequired === 0 ? 0 : courseDetails.filter(c => c.quizMet).length / totalRequired;
    const readinessScore = Math.round((completionReady * 50 + quizReady * 50));

    let status = 'NOT_READY';
    if (readinessScore >= 80) status = 'READY';
    else if (readinessScore >= 50) status = 'NEARLY_READY';

    return {
      id: cert.id,
      name: cert.name,
      description: cert.description,
      minQuizScore: cert.minQuizScore,
      minCourseCompletion: cert.minCourseCompletion,
      readinessScore,
      status,
      courses: courseDetails,
    };
  });

  res.json(result);
}));

// Certificate data for a specific certification
router.get('/certifications/:certId/certificate', authenticate, asyncHandler(async (req, res) => {
  const certId = Number(req.params.certId);
  const userId = req.user.id;

  const [cert, user, attempts] = await Promise.all([
    prisma.certification.findUnique({
      where: { id: certId },
      include: { courses: { include: { course: { select: { id: true, title: true } } } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, department: true } }),
    prisma.quizAttempt.findMany({
      where: { userId },
      include: { quiz: { select: { courseId: true } } },
    }),
  ]);

  if (!cert) return res.status(404).json({ error: 'Certification not found' });

  const courseIds = cert.courses.map(cc => cc.courseId);
  const enrollData = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { courseId: true, progressPercent: true, completedAt: true },
  });

  const enrollMap = Object.fromEntries(enrollData.map(e => [e.courseId, e]));

  const bestByCourse = {};
  for (const a of attempts) {
    const cid = a.quiz?.courseId;
    if (!cid || !courseIds.includes(cid)) continue;
    const pct = (a.score / a.totalPoints) * 100;
    if (!bestByCourse[cid] || pct > bestByCourse[cid]) bestByCourse[cid] = pct;
  }

  // Same formula as the certifications list endpoint: per-course binary pass/fail
  const courseDetails = courseIds.map(cid => {
    const enroll = enrollMap[cid];
    const completion = enroll?.progressPercent || 0;
    const quizScore = bestByCourse[cid] || null;
    return {
      completionMet: completion >= cert.minCourseCompletion,
      quizMet: quizScore !== null && quizScore >= cert.minQuizScore,
      completion,
      quizScore,
    };
  });

  const total = courseIds.length;
  const completionReady = total === 0 ? 0 : courseDetails.filter(c => c.completionMet).length / total;
  const quizReady = total === 0 ? 0 : courseDetails.filter(c => c.quizMet).length / total;
  const readinessScore = Math.round(completionReady * 50 + quizReady * 50);
  const isEligible = readinessScore >= 80;

  const avgQuizScore = total === 0 ? 0 : Math.round(
    courseDetails.reduce((s, c) => s + (c.quizScore || 0), 0) / total
  );
  const avgCompletion = total === 0 ? 0 : Math.round(
    courseDetails.reduce((s, c) => s + c.completion, 0) / total
  );

  res.json({
    certification: { id: cert.id, name: cert.name, description: cert.description },
    learner: { name: user.name, department: user.department },
    isEligible,
    readinessScore,
    avgQuizScore,
    avgCompletion,
    completedCourses: enrollData.filter(e => e.completedAt || e.progressPercent >= 100).length,
    totalCourses: courseIds.length,
    earnedDate: isEligible ? new Date().toISOString() : null,
  });
}));

module.exports = router;
