const prisma = require('../config/database');
const logger = require('../utils/logger');

// Retention Score = 40% Quiz Accuracy + 20% Watch Completion + 15% Revision Frequency + 15% Streak + 10% AI Interaction

async function calculateRetentionScore(userId) {
  const [quizStats, watchStats, streakData, aiInteractions, revisionData] = await Promise.all([
    getQuizAccuracy(userId),
    getWatchCompletion(userId),
    prisma.streak.findUnique({ where: { userId } }),
    getAIInteractionScore(userId),
    getRevisionFrequency(userId),
  ]);

  const quizAccuracy = Math.min(100, quizStats.accuracy);
  const watchCompletion = Math.min(100, watchStats.completion);
  const revisionFreq = Math.min(100, revisionData.score);
  const streakBonus = Math.min(100, calculateStreakBonus(streakData?.currentStreak || 0));
  const aiInteraction = Math.min(100, aiInteractions.score);

  const score =
    quizAccuracy * 0.40 +
    watchCompletion * 0.20 +
    revisionFreq * 0.15 +
    streakBonus * 0.15 +
    aiInteraction * 0.10;

  const rounded = Math.round(score * 10) / 10;

  await prisma.retentionScore.upsert({
    where: { userId },
    create: { userId, score: rounded, quizAccuracy, watchCompletion, revisionFreq, streakBonus, aiInteraction },
    update: { score: rounded, quizAccuracy, watchCompletion, revisionFreq, streakBonus, aiInteraction, calculatedAt: new Date() },
  });

  return { score: rounded, breakdown: { quizAccuracy, watchCompletion, revisionFreq, streakBonus, aiInteraction } };
}

async function getQuizAccuracy(userId) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: 20,
  });

  if (!attempts.length) return { accuracy: 0 };
  const accuracy = attempts.reduce((sum, a) => sum + (a.score / a.totalPoints) * 100, 0) / attempts.length;
  return { accuracy };
}

async function getWatchCompletion(userId) {
  const sessions = await prisma.watchSession.findMany({
    where: { userId },
    take: 50,
  });

  if (!sessions.length) return { completion: 0 };
  const completion = sessions.reduce((sum, s) => sum + (s.watchedSecs / Math.max(s.totalSecs, 1)) * 100, 0) / sessions.length;
  return { completion };
}

async function getRevisionFrequency(userId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentAttempts = await prisma.quizAttempt.count({
    where: { userId, completedAt: { gte: thirtyDaysAgo } },
  });

  const score = Math.min(100, recentAttempts * 10);
  return { score };
}

async function getAIInteractionScore(userId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const interactions = await prisma.aIInteraction.count({
    where: { userId, createdAt: { gte: sevenDaysAgo } },
  });
  const score = Math.min(100, interactions * 5);
  return { score };
}

function calculateStreakBonus(currentStreak) {
  if (currentStreak >= 90) return 100;
  if (currentStreak >= 30) return 90;
  if (currentStreak >= 15) return 75;
  if (currentStreak >= 7) return 60;
  if (currentStreak >= 3) return 40;
  if (currentStreak >= 1) return 20;
  return 0;
}

async function recalculateAll() {
  const users = await prisma.user.findMany({ where: { role: 'LEARNER', isActive: true }, select: { id: true } });
  logger.info(`Recalculating retention for ${users.length} users`);
  await Promise.allSettled(users.map(u => calculateRetentionScore(u.id)));
  logger.info('Retention recalculation complete');
}

module.exports = { calculateRetentionScore, recalculateAll };
