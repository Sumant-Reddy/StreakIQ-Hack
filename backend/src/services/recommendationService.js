const prisma = require('../config/database');
const logger = require('../utils/logger');

async function generateRecommendations(userId) {
  const [user, enrollments, quizAttempts, riskProfile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { department: true, designation: true, name: true } }),
    prisma.enrollment.findMany({ where: { userId }, select: { courseId: true, progressPercent: true } }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20,
      include: { quiz: { include: { course: { select: { title: true, tags: true, department: true } } } } },
    }),
    prisma.riskProfile.findUnique({ where: { userId } }),
  ]);

  const enrolledCourseIds = enrollments.map(e => e.courseId);
  const weakCategories = getWeakCategories(quizAttempts);
  const recommendations = [];

  // High risk: recommend refresher courses
  if (riskProfile?.riskLevel === 'HIGH' || riskProfile?.riskLevel === 'CRITICAL') {
    const refreshers = await prisma.course.findMany({
      where: { isPublished: true, id: { notIn: enrolledCourseIds }, tags: { contains: 'refresher' } },
      take: 3,
    });
    recommendations.push(...refreshers.map(c => ({
      userId,
      courseId: c.id,
      reason: 'Refresher course — knowledge risk detected',
      priority: 1,
    })));
  }

  // Weak categories: recommend improvement courses
  if (weakCategories.length) {
    const improvementCourses = await prisma.course.findMany({
      where: {
        isPublished: true,
        id: { notIn: enrolledCourseIds },
        OR: weakCategories.map(cat => ({ tags: { contains: cat } })),
      },
      take: 5,
    });
    recommendations.push(...improvementCourses.map(c => ({
      userId,
      courseId: c.id,
      reason: `Strengthen weak area: ${weakCategories.join(', ')}`,
      priority: 2,
    })));
  }

  // Department courses
  if (user?.department) {
    const deptCourses = await prisma.course.findMany({
      where: { isPublished: true, id: { notIn: enrolledCourseIds }, department: user.department },
      take: 3,
    });
    recommendations.push(...deptCourses.map(c => ({
      userId,
      courseId: c.id,
      reason: `Recommended for ${user.department}`,
      priority: 3,
    })));
  }

  // In-progress courses (not yet complete)
  const inProgress = enrollments.filter(e => e.progressPercent > 0 && e.progressPercent < 100);
  if (inProgress.length) {
    for (const e of inProgress.slice(0, 2)) {
      const course = await prisma.course.findUnique({ where: { id: e.courseId }, select: { id: true, title: true } });
      if (course) {
        recommendations.unshift({
          userId,
          courseId: course.id,
          reason: `Continue where you left off — ${Math.round(e.progressPercent)}% complete`,
          priority: 0,
        });
      }
    }
  }

  const deduplicated = recommendations.filter((rec, idx, arr) =>
    arr.findIndex(r => r.courseId === rec.courseId) === idx
  ).sort((a, b) => a.priority - b.priority).slice(0, 8);

  // Merge AI-powered recommendations for users with enough history
  const hasEnoughHistory = quizAttempts.length >= 3 || enrollments.length >= 2;
  if (hasEnoughHistory) {
    const aiRecs = await generateAIRecommendations(userId);
    for (const aiRec of aiRecs) {
      const alreadyPresent = deduplicated.find(r => r.courseId === aiRec.courseId);
      if (!alreadyPresent && deduplicated.length < 8) {
        deduplicated.push({
          userId,
          courseId: aiRec.courseId,
          reason: aiRec.reason,
          aiReason: aiRec.reason,
          urgency: aiRec.urgency,
          priority: aiRec.urgency === 'high' ? 1 : aiRec.urgency === 'medium' ? 2 : 3,
        });
      } else if (alreadyPresent) {
        alreadyPresent.aiReason = aiRec.reason;
        alreadyPresent.urgency = aiRec.urgency;
      }
    }
    deduplicated.sort((a, b) => a.priority - b.priority);
  }

  if (deduplicated.length) {
    await prisma.learningRecommendation.deleteMany({ where: { userId } });
    await prisma.learningRecommendation.createMany({ data: deduplicated.map(r => ({
      userId: r.userId,
      courseId: r.courseId,
      reason: r.reason,
      priority: r.priority,
    })) });
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: deduplicated.map(r => r.courseId) } },
    include: { modules: { select: { contentType: true }, take: 5 } },
  });

  return deduplicated.map(rec => {
    const course = courses.find(c => c.id === rec.courseId);
    const contentTypes = [...new Set(course?.modules?.map(m => m.contentType) || [])];
    return { ...rec, course, contentTypes };
  });
}

async function generateAIRecommendations(userId) {
  try {
    const { callLLM } = require('./aiService');
    const [user, enrollments, attempts, riskProfile] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, department: true, designation: true } }),
      prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { title: true, department: true, tags: true } } },
        take: 10,
      }),
      prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: { quiz: { include: { course: { select: { title: true } } } } },
      }),
      prisma.riskProfile.findUnique({ where: { userId } }),
    ]);

    const profileSummary = {
      name: user?.name,
      department: user?.department,
      designation: user?.designation,
      riskLevel: riskProfile?.riskLevel || 'LOW',
      enrolledCourses: enrollments.map(e => ({
        title: e.course?.title,
        progress: Math.round(e.progressPercent),
      })),
      recentQuizzes: attempts.slice(0, 5).map(a => ({
        course: a.quiz?.course?.title,
        score: Math.round((a.score / a.totalPoints) * 100),
      })),
    };

    const availableCourses = await prisma.course.findMany({
      where: {
        isPublished: true,
        id: { notIn: enrollments.map(e => e.courseId) },
      },
      select: { id: true, title: true, description: true, department: true, tags: true },
      take: 20,
    });

    const prompt = `You are a learning advisor for CaratLane jewelry retail.
Analyze this learner's profile and recommend the top 3 most relevant courses for them.

Learner Profile:
${JSON.stringify(profileSummary, null, 2)}

Available Courses:
${availableCourses.map(c => `- ID:${c.id} "${c.title}" [${c.department || 'general'}] tags:${c.tags || 'none'}`).join('\n')}

Return JSON array of 3 recommendations:
[{ "courseId": 123, "reason": "specific 1-sentence reason tied to their profile", "urgency": "high|medium|low" }]`;

    const response = await callLLM([
      { role: 'system', content: 'You are a learning advisor. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.4, max_tokens: 600 });

    const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const parsed = JSON.parse(match ? match[0] : response);
    return parsed.filter(r => r.courseId && availableCourses.find(c => c.id === r.courseId));
  } catch (err) {
    logger.warn('AI recommendation generation failed, using standard:', err.message);
    return [];
  }
}

function getWeakCategories(attempts) {
  const categoryScores = {};
  for (const attempt of attempts) {
    const tags = attempt.quiz?.course?.tags;
    if (!tags) continue;
    const percentage = (attempt.score / attempt.totalPoints) * 100;
    for (const tag of tags.split(',').map(t => t.trim()).filter(Boolean)) {
      if (!categoryScores[tag]) categoryScores[tag] = [];
      categoryScores[tag].push(percentage);
    }
  }
  return Object.entries(categoryScores)
    .map(([tag, scores]) => ({ tag, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .filter(({ avg }) => avg < 70)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map(({ tag }) => tag);
}

async function getSkillHeatmap(managerId) {
  const skills = ['Diamond Knowledge', 'Gemstone Knowledge', 'Communication', 'Consultative Selling', 'Customer Handling'];
  const team = await prisma.user.findMany({
    where: { managerId },
    select: { id: true, name: true, department: true },
  });

  const heatmapData = await Promise.all(
    team.map(async (user) => {
      const skillScores = await prisma.skillScore.findMany({ where: { userId: user.id } });
      const skills_map = {};
      for (const skill of skills) {
        const found = skillScores.find(s => s.skill === skill);
        skills_map[skill] = found ? found.score : Math.random() * 100;
      }
      return { ...user, skills: skills_map };
    })
  );

  return { skills, team: heatmapData };
}

module.exports = { generateRecommendations, generateAIRecommendations, getWeakCategories, getSkillHeatmap };
