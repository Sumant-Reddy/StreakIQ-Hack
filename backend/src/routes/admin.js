const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 50 } = req.query;
  const where = {};
  if (role) where.role = role;
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, department: true, designation: true, isActive: true, createdAt: true, managerId: true, retentionScore: true, riskProfile: true },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total });
}));

router.put('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, role, department, designation, isActive, managerId } = req.body;
  const user = await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { name, role, department, designation, isActive, managerId },
    select: { id: true, email: true, name: true, role: true, department: true, isActive: true },
  });
  res.json(user);
}));

const crypto = require('crypto');

router.post('/invite', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { email, name, role = 'LEARNER', department, designation, managerId, storeCode, region } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Email and name are required' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'User already exists' });

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      department,
      designation,
      managerId: managerId || null,
      storeCode,
      region,
      passwordHash: 'INVITE_PENDING',
      status: 'INVITED',
      inviteToken,
      inviteExpiry,
    },
    select: { id: true, email: true, name: true, role: true, department: true, status: true },
  });

  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${inviteToken}`;
  res.status(201).json({ user, inviteLink, message: 'Invite created. Share the link with the user.' });
}));

router.get('/invites', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const invites = await prisma.user.findMany({
    where: { status: 'INVITED' },
    select: { id: true, email: true, name: true, role: true, department: true, inviteExpiry: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ invites });
}));

router.post('/sync-docmost', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { syncDocmost } = require('../services/docmostService');
  syncDocmost().catch(err => console.error('Docmost sync error:', err.message));
  res.json({ message: 'Docmost sync started in background' });
}));

router.get('/docmost/status', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const count = await prisma.docmostDocument.count();
  const latest = await prisma.docmostDocument.findFirst({ orderBy: { lastSyncedAt: 'desc' } });
  res.json({ syncedDocuments: count, lastSyncedAt: latest?.lastSyncedAt || null });
}));

module.exports = router;
