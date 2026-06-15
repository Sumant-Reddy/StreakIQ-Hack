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

module.exports = router;
