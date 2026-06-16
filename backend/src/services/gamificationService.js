const prisma = require('../config/database');
const logger = require('../utils/logger');

const BADGES = [
  // Onboarding
  { name: 'Welcome!', description: 'Join the CaratLane Learning Platform', iconUrl: '🎉', category: 'onboarding', criteria: { type: 'first_login' } },
  { name: 'First Step', description: 'Complete your first quiz', iconUrl: '🎯', category: 'quiz', criteria: { type: 'first_quiz' } },
  { name: 'Perfectionist', description: 'Score 100% on a quiz', iconUrl: '💯', category: 'quiz', criteria: { type: 'perfect_quiz' } },

  // Courses
  { name: 'Fast Learner', description: 'Complete 5 courses', iconUrl: '📚', category: 'achievement', criteria: { type: 'courses_completed', threshold: 5 } },
  { name: 'Course Champion', description: 'Complete 10 courses', iconUrl: '🏆', category: 'achievement', criteria: { type: 'courses_completed', threshold: 10 } },
  { name: 'Scholar', description: 'Complete 20 courses', iconUrl: '🎓', category: 'achievement', criteria: { type: 'courses_completed', threshold: 20 } },

  // Quiz mastery
  { name: 'Quiz Pro', description: 'Score 90%+ on 5 quizzes', iconUrl: '⭐', category: 'quiz', criteria: { type: 'high_score_quizzes', threshold: 5 } },
  { name: 'Quiz Master', description: 'Score 90%+ on 10 quizzes', iconUrl: '🌟', category: 'quiz', criteria: { type: 'high_score_quizzes', threshold: 10 } },

  // Domain expertise
  { name: 'Diamond Expert', description: 'Master diamond knowledge with 85%+ score', iconUrl: '💎', category: 'expertise', criteria: { type: 'course_mastery', tag: 'diamond' } },
  { name: 'Communication Star', description: 'Complete communication courses', iconUrl: '🗣️', category: 'expertise', criteria: { type: 'category_complete', tag: 'communication', threshold: 1 } },
  { name: 'Sales Guru', description: 'Complete all sales courses', iconUrl: '💰', category: 'expertise', criteria: { type: 'category_complete', tag: 'sales', threshold: 1 } },

  // Streaks
  { name: '7-Day Streak', description: 'Learn 7 days in a row', iconUrl: '🔥', category: 'streak', criteria: { type: 'streak', threshold: 7 } },
  { name: '15-Day Streak', description: 'Learn 15 days in a row', iconUrl: '🔥', category: 'streak', criteria: { type: 'streak', threshold: 15 } },
  { name: 'Elite Learner', description: 'Maintain 30-day streak', iconUrl: '⚡', category: 'streak', criteria: { type: 'streak', threshold: 30 } },
  { name: '90-Day Champion', description: 'Maintain 90-day learning streak', iconUrl: '👑', category: 'streak', criteria: { type: 'streak', threshold: 90 } },

  // AI & Roleplay
  { name: 'AI Curious', description: '10+ AI companion interactions', iconUrl: '🤖', category: 'engagement', criteria: { type: 'ai_interactions', threshold: 10 } },
  { name: 'AI Champion', description: '100+ AI companion interactions', iconUrl: '🧠', category: 'engagement', criteria: { type: 'ai_interactions', threshold: 100 } },
  { name: 'Roleplay Pro', description: 'Complete 5 roleplays with 80%+ score', iconUrl: '🎭', category: 'skill', criteria: { type: 'roleplay_score', threshold: 5 } },

  // Points milestones
  { name: 'Point Collector', description: 'Earn 100 points', iconUrl: '🪙', category: 'points', criteria: { type: 'points_milestone', threshold: 100 } },
  { name: 'High Achiever', description: 'Earn 500 points', iconUrl: '🏅', category: 'points', criteria: { type: 'points_milestone', threshold: 500 } },
  { name: 'Legend', description: 'Earn 1000 points', iconUrl: '🌠', category: 'points', criteria: { type: 'points_milestone', threshold: 1000 } },
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

async function onQuizCompleted(userId, score, totalPoints, { isDelta = false } = {}) {
  // score here is already the delta (improvement) score when isDelta=true
  if (score <= 0) return; // No negative or zero point awards
  const earned = Math.round((score / totalPoints) * 20);
  if (earned > 0) {
    await addPoints(userId, earned, isDelta ? 'Quiz improvement bonus' : 'Quiz completion');
  }
  await updateStreak(userId);

  // Badge check: uses actual percentage of latest attempt
  const latestAttempt = await prisma.quizAttempt.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
  });
  if (latestAttempt && latestAttempt.totalPoints > 0) {
    const pct = latestAttempt.score / latestAttempt.totalPoints;
    if (pct >= 0.9) {
      const highScoreCount = await prisma.quizAttempt.count({
        where: { userId, score: { gte: latestAttempt.totalPoints * 0.9 } },
      });
      if (highScoreCount >= 10) {
        const badge = await prisma.badge.findFirst({ where: { name: 'Quiz Master' } });
        if (badge) await awardBadge(userId, badge.id);
      }
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

async function checkAllBadges(userId) {
  const [
    badges,
    earnedBadges,
    enrollments,
    quizAttempts,
    streak,
    aiInteractions,
    roleplays,
    points,
  ] = await Promise.all([
    prisma.badge.findMany(),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.enrollment.findMany({ where: { userId }, include: { course: true } }),
    prisma.quizAttempt.findMany({ where: { userId } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.aIInteraction.count({ where: { userId } }),
    prisma.roleplaySessions.findMany({ where: { userId } }),
    prisma.userPoints.findUnique({ where: { userId } }),
  ]);

  const earnedIds = new Set(earnedBadges.map(b => b.badgeId));
  const completedEnrollments = enrollments.filter(e => e.completedAt || e.progressPercent >= 100);
  const currentStreak = streak?.currentStreak || 0;

  for (const badge of badges) {
    if (earnedIds.has(badge.id)) continue; // already earned

    const c = badge.criteria;
    let shouldAward = false;

    switch (c?.type) {
      case 'courses_completed':
        shouldAward = completedEnrollments.length >= (c.threshold || 1);
        break;

      case 'streak':
        shouldAward = currentStreak >= (c.threshold || 1);
        break;

      case 'high_score_quizzes': {
        const highScores = quizAttempts.filter(a => (a.score / a.totalPoints) >= 0.9);
        shouldAward = highScores.length >= (c.threshold || 10);
        break;
      }

      case 'first_quiz':
        shouldAward = quizAttempts.length >= 1;
        break;

      case 'perfect_quiz':
        shouldAward = quizAttempts.some(a => (a.score / a.totalPoints) === 1.0);
        break;

      case 'course_mastery': {
        // Course with matching tag completed with 85%+ quiz score
        const tagCourses = enrollments.filter(e => e.course?.tags?.includes(c.tag));
        if (tagCourses.length > 0) {
          const tagAttempts = quizAttempts.filter(a => {
            // We need quiz courseId — approximate via any high score attempt
            return (a.score / a.totalPoints) >= 0.85;
          });
          shouldAward = tagAttempts.length > 0 && tagCourses.some(e => e.progressPercent >= 80);
        }
        break;
      }

      case 'category_complete': {
        const catCourses = enrollments.filter(e => e.course?.tags?.includes(c.tag) || e.course?.department === c.tag);
        shouldAward = catCourses.length >= (c.threshold || 1) && catCourses.every(e => e.progressPercent >= 80);
        break;
      }

      case 'ai_interactions':
        shouldAward = aiInteractions >= (c.threshold || 100);
        break;

      case 'roleplay_score': {
        const goodRoleplays = roleplays.filter(r => (r.overallScore || 0) >= 80);
        shouldAward = goodRoleplays.length >= (c.threshold || 5);
        break;
      }

      case 'points_milestone':
        shouldAward = (points?.totalPoints || 0) >= (c.threshold || 100);
        break;

      case 'first_login':
        shouldAward = true; // always award on first check
        break;

      default:
        break;
    }

    if (shouldAward) {
      await awardBadge(userId, badge.id);
      logger.info(`Auto-awarded badge "${badge.name}" to user ${userId}`);
    }
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
  checkAllBadges,
};
