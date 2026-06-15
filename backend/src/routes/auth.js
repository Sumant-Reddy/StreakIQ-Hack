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

module.exports = router;
