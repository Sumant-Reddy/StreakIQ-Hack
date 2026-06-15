const { Queue, Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { calculateRetentionScore } = require('../services/retentionService');
const { analyzeRisk, triggerInterventions } = require('../services/riskService');
const { generateRecommendations } = require('../services/recommendationService');
const { onQuizCompleted, onCourseCompleted, onVideoWatched } = require('../services/gamificationService');
const logger = require('../utils/logger');

let queues = {};
let workers = {};

// function initQueues() {
//   try {
//     const connection = getRedis();

//     queues.learning = new Queue('learning-events', { connection });
//     queues.retention = new Queue('retention-calc', { connection });

//     workers.learning = new Worker('learning-events', processLearningEvent, { connection, concurrency: 5 });
//     workers.retention = new Worker('retention-calc', processRetentionCalc, { connection, concurrency: 3 });

//     workers.learning.on('completed', job => logger.info(`Job ${job.id} completed`));
//     workers.learning.on('failed', (job, err) => logger.error(`Job ${job?.id} failed:`, err.message));

//     logger.info('BullMQ queues initialized');
//   } catch (err) {
//     logger.warn('BullMQ not available (Redis required):', err.message);
//   }
// }
function initQueues() {
  try {
    // 💡 Replace getRedis() with a direct fallback configuration object
    const connection = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null // 👈 Crucial requirement for BullMQ
    };

    queues.learning = new Queue('learning-events', { connection });
    queues.retention = new Queue('retention-calc', { connection });

    workers.learning = new Worker('learning-events', processLearningEvent, { connection, concurrency: 5 });
    workers.retention = new Worker('retention-calc', processRetentionCalc, { connection, concurrency: 3 });
  } catch (err) {
    logger.warn('BullMQ not available (Redis required):', err.message);
  }
}
async function processLearningEvent(job) {
  const { type, userId, data } = job.data;

  switch (type) {
    case 'QUIZ_COMPLETED':
      await onQuizCompleted(userId, data.score, data.totalPoints);
      break;
    case 'COURSE_COMPLETED':
      await onCourseCompleted(userId);
      break;
    case 'VIDEO_WATCHED':
      await onVideoWatched(userId, data.completionPercent);
      break;
  }

  await queues.retention?.add('recalculate', { userId }, { delay: 5000 });
}

async function processRetentionCalc(job) {
  const { userId } = job.data;
  const retention = await calculateRetentionScore(userId);
  const risk = await analyzeRisk(userId);

  if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
    await triggerInterventions(userId, risk.riskLevel, retention.score);
  }

  await generateRecommendations(userId);
}

async function enqueueEvent(type, userId, data = {}) {
  try {
    await queues.learning?.add(type, { type, userId, data }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  } catch (err) {
    logger.warn('Could not enqueue event (running sync fallback):', err.message);
    await processLearningEvent({ data: { type, userId, data } });
  }
}

module.exports = { initQueues, enqueueEvent };
