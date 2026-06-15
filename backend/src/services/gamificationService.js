const prisma = require('../config/database');
const logger = require('../utils/logger');

const BADGES = [
  { name: 'Fast Learner', description: 'Complete 5 courses', category: 'achievement', criteria: { type: 'courses_completed', threshold: 5 } },
  { name: 'Quiz Master', description: 'Score 90%+ on 10 quizzes', category: 'quiz', criteria: { type: 'high_score_quizzes', threshold: 10 } },
  { name: 'Diamond Expert', description: 'Complete Diamond Knowledge course with 85%+ score', category: 'expertise', criteria: { type: 'course_mastery', tag: 'diamond' } },
  { name: 'Communication Star', description: 'Complete all communication courses', category: 'expertise', criteria: { type: 'category_complete', tag: 'communication' } },
  { name: 'AI Champion', description: '100+ AI companion interactions', category: 'engagement', criteria: { type: 'ai_interactions', threshold: 100 } },
  { name: 'Elite Learner', description: 'Maintain 30-day streak', category: 'streak', criteria: { type: 'streak', threshold: 30 } },
  { name: '7-Day Streak', description: 'Learn 7 days in a row', category: 'streak', criteria: { type: 'streak', threshold: 7 } },
  { name: '15-Day Streak', description: 'Learn 15 days in a row', category: 'streak', criteria: { type: 'streak', threshold: 15 } },
  { name: '90-Day Champion', description: 'Maintain 90-day learning streak', category: 'streak', criteria: { type: 'streak', threshold: 90 } },
  { name: 'Roleplay Pro', description: 'Complete 5 AI customer roleplays with 80%+ score', category: 'skill', criteria: { type: 'roleplay_score', threshold: 5 } },
];

async function seedBadges() {
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      create: badge,
      update: badge,
    });
  }
}

async function updateStreak(userId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  let streak = await prisma.streak.findUnique({ where: { userId } });

  if (!streak) {
    streak = await prisma.streak.create({ data: { userId, currentStreak: 1, longestStreak: 1, lastActiveAt: now } });
    await addPoints(userId, 5, 'Daily streak bonus');
    return streak;
  }

  const lastActive = new Date(streak.lastActiveAt);
  const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());

  if (lastActiveDay.getTime() === todayStart.getTime()) {
    return streak;
  }

  let newStreak;
  if (lastActiveDay.getTime() === yesterdayStart.getTime()) {
    newStreak = streak.currentStreak + 1;
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(streak.longestStreak, newStreak);
  streak = await prisma.streak.update({
    where: { userId },
    data: { currentStreak: newStreak, longestStreak, lastActiveAt: now },
  });

  await addPoints(userId, 5, 'Daily streak bonus');
  await checkAndAwardStreakBadges(userId, newStreak);

  return streak;
}

async function checkAndAwardStreakBadges(userId, currentStreak) {
  const milestones = [7, 15, 30, 90];
  for (const milestone of milestones) {
    if (currentStreak >= milestone) {
      const badge = await prisma.badge.findFirst({ where: { criteria: { path: ['$.threshold'], equals: milestone }, category: 'streak' } });
      if (badge) {
        await awardBadge(userId, badge.id);
      }
    }
  }
}

async function addPoints(userId, points, reason = '') {
  await prisma.userPoints.upsert({
    where: { userId },
    create: { userId, totalPoints: points, weeklyPoints: points, monthlyPoints: points },
    update: {
      totalPoints: { increment: points },
      weeklyPoints: { increment: points },
      monthlyPoints: { increment: points },
    },
  });
  logger.info(`Added ${points} points to user ${userId}: ${reason}`);
}

async function awardBadge(userId, badgeId) {
  try {
    await prisma.userBadge.create({ data: { userId, badgeId } });
    logger.info(`Badge ${badgeId} awarded to user ${userId}`);
    return true;
  } catch {
    return false;
  }
}

async function getLeaderboard(limit = 20, period = 'all') {
  const pointsField = period === 'weekly' ? 'weeklyPoints' : period === 'monthly' ? 'monthlyPoints' : 'totalPoints';

  const topUsers = await prisma.userPoints.findMany({
    orderBy: { [pointsField]: 'desc' },
    take: limit,
    include: {
      user: {
        select: { id: true, name: true, department: true, avatarUrl: true },
      },
    },
  });

  return topUsers.map((up, index) => ({
    rank: index + 1,
    userId: up.userId,
    name: up.user.name,
    department: up.user.department,
    avatarUrl: up.user.avatarUrl,
    points: up[pointsField],
  }));
}

async function onQuizCompleted(userId, score, totalPoints) {
  const earned = Math.round((score / totalPoints) * 20);
  await addPoints(userId, earned, 'Quiz completion');
  await updateStreak(userId);

  if (score / totalPoints >= 0.9) {
    const highScoreCount = await prisma.quizAttempt.count({
      where: { userId, score: { gte: 90 } },
    });
    if (highScoreCount >= 10) {
      const badge = await prisma.badge.findFirst({ where: { name: 'Quiz Master' } });
      if (badge) await awardBadge(userId, badge.id);
    }
  }
}

async function onCourseCompleted(userId) {
  await addPoints(userId, 50, 'Course completion');
  const completed = await prisma.enrollment.count({ where: { userId, completedAt: { not: null } } });
  if (completed >= 5) {
    const badge = await prisma.badge.findFirst({ where: { name: 'Fast Learner' } });
    if (badge) await awardBadge(userId, badge.id);
  }
}

async function onVideoWatched(userId, completionPercent) {
  if (completionPercent >= 0.9) {
    await addPoints(userId, 10, 'Video completed');
    await updateStreak(userId);
  }
}

module.exports = {
  seedBadges,
  updateStreak,
  addPoints,
  awardBadge,
  getLeaderboard,
  onQuizCompleted,
  onCourseCompleted,
  onVideoWatched,
};
