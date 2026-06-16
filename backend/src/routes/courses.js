const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateSummary } = require('../services/aiService');
const { indexDocument } = require('../services/embeddingService');

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { department, search, page = 1, limit = 20 } = req.query;
  const where = { isPublished: true };
  if (department) where.department = department;
  if (search) where.OR = [{ title: { contains: search } }, { description: { contains: search } }];

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { modules: { select: { id: true, title: true, order: true, contentType: true, duration: true } } },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.course.count({ where }),
  ]);

  res.json({ courses, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      modules: { orderBy: { order: 'asc' } },
      quizzes: { include: { questions: { select: { id: true, text: true, type: true, difficulty: true, points: true } } } },
    },
  });
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
  });

  res.json({ ...course, enrolled: !!enrollment, progress: enrollment?.progressPercent || 0 });
}));

router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description, thumbnail, department, tags, estimatedHours, isPublished, isMandatory, modules = [] } = req.body;
  const course = await prisma.course.create({
    data: {
      title, description, thumbnail: thumbnail || null, department, tags, estimatedHours: parseFloat(estimatedHours) || 0, isPublished: !!isPublished, isMandatory: !!isMandatory,
      createdById: req.user.id,
      modules: {
        create: modules.map((m, i) => ({ ...m, order: i + 1 })),
      },
    },
    include: { modules: true },
  });
  res.status(201).json(course);
}));

router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description, thumbnail, department, tags, estimatedHours, isPublished, isMandatory } = req.body;
  const course = await prisma.course.update({
    where: { id: Number(req.params.id) },
    data: { title, description, thumbnail: thumbnail || null, department, tags, estimatedHours, isPublished, isMandatory },
  });
  res.json(course);
}));

router.post('/:id/enroll', authenticate, asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: req.user.id, courseId } },
    create: { userId: req.user.id, courseId },
    update: { lastAccessedAt: new Date() },
  });
  res.json(enrollment);
}));

router.post('/:id/modules', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);
  const { title, contentType, contentUrl, duration, description } = req.body;
  if (!title || !contentType) return res.status(400).json({ error: 'Title and contentType are required' });

  const count = await prisma.module.count({ where: { courseId } });
  const module = await prisma.module.create({
    data: { courseId, title, contentType, contentUrl: contentUrl || '', duration: duration || 0, description, order: count + 1 },
  });

  // Generate AI summary + index in Qdrant for ALL content types (non-blocking)
  (async () => {
    try {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
      let summaryInput;
      if (contentType === 'VIDEO') {
        summaryInput = `Video Title: ${title}\nCourse: ${course?.title || ''}\n${description || ''}\nThis video covers: ${title}`;
      } else if (contentType === 'ARTICLE') {
        summaryInput = contentUrl || `${title}\n${description || ''}`;
      } else {
        summaryInput = `${title}\n${description || ''}\nCourse: ${course?.title || ''}`;
      }

      const summary = await generateSummary({
        content: summaryInput,
        contentType,
        courseTitle: course?.title || '',
      });

      await prisma.module.update({ where: { id: module.id }, data: { aiSummary: summary } });

      // Index in Qdrant so AI Companion can answer course-specific questions
      const { indexDocument } = require('../services/embeddingService');
      await indexDocument({
        id: `module_${module.id}`,
        content: `${title}\n\n${summary}`,
        metadata: {
          source: 'course',
          courseId,
          moduleId: module.id,
          title,
          contentType,
        },
      });
    } catch (err) {
      require('../utils/logger').warn(`Module ${module.id} summary/index failed:`, err.message);
    }
  })();

  res.status(201).json(module);
}));

router.get('/:courseId/next-quiz', authenticate, asyncHandler(async (req, res) => {
  const courseId = Number(req.params.courseId);
  const quiz = await prisma.quiz.findFirst({
    where: { courseId },
    include: { _count: { select: { questions: true } } },
  });
  if (!quiz) return res.json(null);

  const myBestAttempt = await prisma.quizAttempt.findFirst({
    where: { userId: req.user.id, quizId: quiz.id },
    orderBy: { score: 'desc' },
  });

  res.json({
    ...quiz,
    myBestScore: myBestAttempt ? Math.round((myBestAttempt.score / myBestAttempt.totalPoints) * 100) : null,
    attemptCount: await prisma.quizAttempt.count({ where: { userId: req.user.id, quizId: quiz.id } }),
  });
}));

router.post('/:courseId/modules/:moduleId/watch', authenticate, asyncHandler(async (req, res) => {
  const { watchedSecs, totalSecs, completed } = req.body;
  const session = await prisma.watchSession.create({
    data: {
      userId: req.user.id,
      moduleId: Number(req.params.moduleId),
      watchedSecs,
      totalSecs,
      completedAt: completed ? new Date() : null,
    },
  });

  if (completed) {
    const { enqueueEvent } = require('../queues/learningQueue');
    await enqueueEvent('VIDEO_WATCHED', req.user.id, { completionPercent: watchedSecs / totalSecs });
  }

  // Check badges after progress update
  if (completedAt || progressPercent >= 100) {
    const { checkAllBadges } = require('../services/gamificationService');
    checkAllBadges(req.user.id).catch(() => {});
  }

  res.json(session);
}));

module.exports = router;
