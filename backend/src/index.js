require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const quizRoutes = require('./routes/quizzes');
const aiRoutes = require('./routes/ai');
const managerRoutes = require('./routes/manager');
const learnerRoutes = require('./routes/learner');
const gamificationRoutes = require('./routes/gamification');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const { setupSocketHandlers } = require('./services/socketService');
const { initQueues } = require('./queues/learningQueue');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Static file serving for uploaded assets
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'YAMI Learn AI', timestamp: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/learner', learnerRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
const uploadRoutes = require('./routes/upload');
app.use('/api', uploadRoutes);

app.use(errorHandler);

setupSocketHandlers(io);
initQueues();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`YAMI Learn AI backend running on port ${PORT}`);
  // Auto-seed badges on startup (upsert — safe to run every time)
  const { seedBadges } = require('./services/gamificationService');
  seedBadges().then(() => logger.info('Badges seeded')).catch(e => logger.warn('Badge seed failed:', e.message));
});
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
module.exports = { app, server };
