const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name, role = 'LEARNER', department, designation, managerId } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role, department, designation, managerId: managerId || null },
    select: { id: true, email: true, name: true, role: true, department: true },
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.status(201).json({ token, user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const { passwordHash, ...safeUser } = user;
  res.json({ token, user: safeUser });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      streak: true,
      points: true,
      retentionScore: true,
      riskProfile: true,
      badges: { include: { badge: true } },
    },
  });
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
}));

router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { name, department, designation, avatarUrl } = req.body;
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, department, designation, avatarUrl },
    select: { id: true, email: true, name: true, role: true, department: true, designation: true, avatarUrl: true },
  });
  res.json(updated);
}));

router.post('/accept-invite/:token', asyncHandler(async (req, res) => {
  const { password, name } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = await prisma.user.findFirst({
    where: {
      inviteToken: req.params.token,
      inviteExpiry: { gt: new Date() },
      status: 'INVITED',
    },
  });
  if (!user) return res.status(400).json({ error: 'Invalid or expired invite link' });

  const passwordHash = await bcrypt.hash(password, 12);

  // Find mandatory courses to auto-enroll
  const mandatoryCourses = await prisma.course.findMany({
    where: { isMandatory: true, isPublished: true },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        name: name || user.name,
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiry: null,
      },
    });
    // Auto-enroll in mandatory courses
    for (const course of mandatoryCourses) {
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        create: { userId: user.id, courseId: course.id },
        update: {},
      });
    }
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const { passwordHash: _, ...safeUser } = await prisma.user.findUnique({ where: { id: user.id } });
  res.json({ token, user: safeUser });
}));

router.put('/me/language', authenticate, asyncHandler(async (req, res) => {
  const { language } = req.body;
  if (!['EN', 'HI', 'TE', 'TA', 'KN'].includes(language)) return res.status(400).json({ error: 'Invalid language' });
  await prisma.user.update({ where: { id: req.user.id }, data: { language } });
  res.json({ language });
}));

module.exports = router;
