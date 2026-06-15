const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getLeaderboard } = require('../services/gamificationService');

router.get('/leaderboard', authenticate, asyncHandler(async (req, res) => {
  const { period = 'all', limit = 20 } = req.query;
  const leaderboard = await getLeaderboard(Number(limit), period);
  const myRank = leaderboard.findIndex(l => l.userId === req.user.id) + 1;
  res.json({ leaderboard, myRank: myRank || null });
}));

router.get('/badges', authenticate, asyncHandler(async (req, res) => {
  const [allBadges, myBadges] = await Promise.all([
    prisma.badge.findMany(),
    prisma.userBadge.findMany({ where: { userId: req.user.id }, select: { badgeId: true, earnedAt: true } }),
  ]);
  const myBadgeIds = new Set(myBadges.map(b => b.badgeId));
  res.json(allBadges.map(b => ({ ...b, earned: myBadgeIds.has(b.id), earnedAt: myBadges.find(mb => mb.badgeId === b.id)?.earnedAt })));
}));

router.get('/my-stats', authenticate, asyncHandler(async (req, res) => {
  const [points, streak, badges] = await Promise.all([
    prisma.userPoints.findUnique({ where: { userId: req.user.id } }),
    prisma.streak.findUnique({ where: { userId: req.user.id } }),
    prisma.userBadge.count({ where: { userId: req.user.id } }),
  ]);
  res.json({
    points: points || { totalPoints: 0, weeklyPoints: 0, monthlyPoints: 0 },
    streak: streak || { currentStreak: 0, longestStreak: 0 },
    badgeCount: badges,
  });
}));

router.post('/badges/seed', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { seedBadges } = require('../services/gamificationService');
  await seedBadges();
  res.json({ message: 'Badges seeded' });
}));

module.exports = router;
