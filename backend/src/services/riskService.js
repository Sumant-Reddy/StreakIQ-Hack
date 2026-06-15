const prisma = require('../config/database');
const { calculateRetentionScore } = require('./retentionService');
const logger = require('../utils/logger');

async function analyzeRisk(userId) {
  const [retention, user, lastActivity, recentQuizzes] = await Promise.all([
    calculateRetentionScore(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, department: true } }),
    getLastActivity(userId),
    prisma.quizAttempt.findMany({ where: { userId }, orderBy: { completedAt: 'desc' }, take: 5 }),
  ]);

  const daysInactive = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));
  const avgRecentScore = recentQuizzes.length
    ? recentQuizzes.reduce((s, a) => s + (a.score / a.totalPoints) * 100, 0) / recentQuizzes.length
    : 0;

  let riskLevel = 'LOW';
  let reasons = [];

  if (retention.score < 40) { riskLevel = 'CRITICAL'; reasons.push(`Retention score critically low (${retention.score})`); }
  else if (retention.score < 60) { riskLevel = 'HIGH'; reasons.push(`Retention score below threshold (${retention.score})`); }
  else if (retention.score < 75) { riskLevel = Math.max(riskLevel, 'MEDIUM') === 'HIGH' ? 'HIGH' : 'MEDIUM'; }

  if (daysInactive >= 14) { riskLevel = 'CRITICAL'; reasons.push(`${daysInactive} days without learning activity`); }
  else if (daysInactive >= 7) { if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH'; reasons.push(`${daysInactive} days inactive`); }

  if (avgRecentScore < 50 && recentQuizzes.length >= 2) {
    if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
    reasons.push(`Recent quiz average score: ${avgRecentScore.toFixed(1)}%`);
  }

  const recommendation = generateRecommendation(riskLevel, retention.score, daysInactive, avgRecentScore);

  await prisma.riskProfile.upsert({
    where: { userId },
    create: { userId, riskLevel, retentionScore: retention.score, daysInactive, failedQuizzes: countFailedQuizzes(recentQuizzes), recommendation },
    update: { riskLevel, retentionScore: retention.score, daysInactive, failedQuizzes: countFailedQuizzes(recentQuizzes), recommendation, calculatedAt: new Date() },
  });

  return {
    userId,
    name: user?.name,
    department: user?.department,
    riskLevel,
    retentionScore: retention.score,
    daysInactive,
    avgRecentScore,
    reasons,
    recommendation,
    breakdown: retention.breakdown,
  };
}

function riskCompare(a, b) {
  const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return order[a] > order[b] ? a : b;
}

function countFailedQuizzes(attempts) {
  return attempts.filter(a => (a.score / a.totalPoints) * 100 < 50).length;
}

async function getLastActivity(userId) {
  const [lastQuiz, lastWatch, lastAI] = await Promise.all([
    prisma.quizAttempt.findFirst({ where: { userId }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
    prisma.watchSession.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.aIInteraction.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);

  const dates = [
    lastQuiz?.completedAt,
    lastWatch?.createdAt,
    lastAI?.createdAt,
  ].filter(Boolean).map(d => new Date(d).getTime());

  return dates.length ? Math.max(...dates) : Date.now() - 30 * 24 * 60 * 60 * 1000;
}

function generateRecommendation(riskLevel, retentionScore, daysInactive, quizScore) {
  if (riskLevel === 'CRITICAL') {
    return `URGENT: Schedule 1-on-1 with manager. Assign Diamond Fundamentals refresher course. Set daily 15-min learning reminders. Consider structured coaching plan.`;
  }
  if (riskLevel === 'HIGH') {
    if (daysInactive >= 7) return `Re-engage with 3 short video modules. Attempt the Weekly Knowledge Check quiz. Join next team learning session.`;
    if (quizScore < 50) return `Focus on core product knowledge. Retry last failed quiz after reviewing summaries. Use AI companion for concept clarification.`;
    return `Increase daily learning to 20 mins. Schedule revision of weakest topics. Attempt 2 practice quizzes this week.`;
  }
  if (riskLevel === 'MEDIUM') {
    return `Maintain learning momentum. Review AI-recommended content. Complete pending module in current learning path.`;
  }
  return `Excellent progress! Explore advanced courses or mentor junior team members. Consider certification preparation.`;
}

async function triggerInterventions(userId, riskLevel, retentionScore) {
  const interventions = [];

  if (retentionScore < 60) {
    interventions.push({ userId, type: 'REFRESHER_CONTENT', reason: `Retention score ${retentionScore} below 60` });
  }
  if (retentionScore < 50) {
    interventions.push({ userId, type: 'NEW_QUIZ', reason: 'Retention critically low — reinforce with quiz' });
  }
  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    interventions.push({ userId, type: 'MANAGER_ALERT', reason: `Risk level: ${riskLevel}` });
    interventions.push({ userId, type: 'REMINDER', reason: 'High risk learner needs re-engagement' });
  }

  if (interventions.length) {
    await prisma.learningIntervention.createMany({ data: interventions, skipDuplicates: true });
    logger.info(`Created ${interventions.length} interventions for user ${userId}`);
  }
  return interventions;
}

async function getTeamRiskSummary(managerId) {
  const subordinates = await prisma.user.findMany({
    where: { managerId },
    select: { id: true, name: true, department: true, designation: true },
  });

  const riskProfiles = await Promise.all(subordinates.map(u => analyzeRisk(u.id)));

  return {
    total: riskProfiles.length,
    critical: riskProfiles.filter(r => r.riskLevel === 'CRITICAL').length,
    high: riskProfiles.filter(r => r.riskLevel === 'HIGH').length,
    medium: riskProfiles.filter(r => r.riskLevel === 'MEDIUM').length,
    low: riskProfiles.filter(r => r.riskLevel === 'LOW').length,
    profiles: riskProfiles,
  };
}

module.exports = { analyzeRisk, triggerInterventions, getTeamRiskSummary };
