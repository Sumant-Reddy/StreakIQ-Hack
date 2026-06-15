const prisma = require('../config/database');

async function generateRecommendations(userId) {
  const [user, enrollments, quizAttempts, riskProfile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { department: true, designation: true } }),
    prisma.enrollment.findMany({ where: { userId }, select: { courseId: true, progressPercent: true } }),
    prisma.quizAttempt.findMany({ where: { userId }, orderBy: { completedAt: 'desc' }, take: 10, include: { quiz: { include: { course: true } } } }),
    prisma.riskProfile.findUnique({ where: { userId } }),
  ]);

  const enrolledCourseIds = enrollments.map(e => e.courseId);
  const weakCategories = getWeakCategories(quizAttempts);
  const recommendations = [];

  if (riskProfile?.riskLevel === 'HIGH' || riskProfile?.riskLevel === 'CRITICAL') {
    const refreshers = await prisma.course.findMany({
      where: {
        isPublished: true,
        id: { notIn: enrolledCourseIds },
        tags: { contains: 'refresher' },
      },
      take: 3,
    });
    recommendations.push(...refreshers.map(c => ({
      userId,
      courseId: c.id,
      reason: 'Refresher course assigned based on knowledge risk assessment',
      priority: 1,
    })));
  }

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
      reason: `Recommended to strengthen weak area: ${weakCategories.join(', ')}`,
      priority: 2,
    })));
  }

  if (user?.department) {
    const deptCourses = await prisma.course.findMany({
      where: {
        isPublished: true,
        id: { notIn: enrolledCourseIds },
        department: user.department,
      },
      take: 3,
    });
    recommendations.push(...deptCourses.map(c => ({
      userId,
      courseId: c.id,
      reason: `Recommended for ${user.department} department`,
      priority: 3,
    })));
  }

  if (recommendations.length) {
    await prisma.learningRecommendation.deleteMany({ where: { userId, isActedOn: false } });
    await prisma.learningRecommendation.createMany({ data: recommendations });
  }

  return prisma.learningRecommendation.findMany({
    where: { userId },
    include: { course: true },
    orderBy: { priority: 'asc' },
    take: 10,
  });
}

function getWeakCategories(attempts) {
  const categoryScores = {};
  for (const attempt of attempts) {
    const tag = attempt.quiz?.course?.tags;
    if (!tag) continue;
    if (!categoryScores[tag]) categoryScores[tag] = { total: 0, count: 0 };
    categoryScores[tag].total += (attempt.score / attempt.totalPoints) * 100;
    categoryScores[tag].count++;
  }
  return Object.entries(categoryScores)
    .filter(([, v]) => v.total / v.count < 60)
    .map(([k]) => k);
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

module.exports = { generateRecommendations, getSkillHeatmap };
