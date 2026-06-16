const { Queue, Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { calculateRetentionScore } = require('../services/retentionService');
const { analyzeRisk, triggerInterventions } = require('../services/riskService');
const { generateRecommendations } = require('../services/recommendationService');
const { onQuizCompleted, onCourseCompleted, onVideoWatched } = require('../services/gamificationService');
const logger = require('../utils/logger');

let queues = {};
let workers = {};

function initQueues() {
  try {
    // 1. Grab your centralized connection instance that parses process.env.REDIS_URL
    const connection = getRedis();

    // 2. Safely tell BullMQ that retries are handled, satisfying its strict structural check
    if (connection && connection.options) {
      connection.options.maxRetriesPerRequest = null;
    }

    // 3. Initialize queues using the proper connected client instance
    queues.learning = new Queue('learning-events', { connection });
    queues.retention = new Queue('retention-calc', { connection });

    // 4. Initialize workers to process the event channels
    workers.learning = new Worker('learning-events', processLearningEvent, { connection, concurrency: 5 });
    workers.retention = new Worker('retention-calc', processRetentionCalc, { connection, concurrency: 3 });

    // 5. Setup event log listeners for diagnostic tracking
    workers.learning.on('completed', job => logger.info(`Job ${job.id} completed`));
    workers.learning.on('failed', (job, err) => logger.error(`Job ${job?.id} failed:`, err.message));

    logger.info('BullMQ queues initialized successfully with process.env.REDIS_URL');
  } catch (err) {
    logger.warn('BullMQ not available (Redis required):', err.message);
  }
}

async function processLearningEvent(job) {
  const { type, userId, data } = job.data;

  switch (type) {
    case 'QUIZ_COMPLETED':
      await onQuizCompleted(userId, data.score, data.totalPoints, { isDelta: data.isDelta || false });
      const { checkAllBadges } = require('../services/gamificationService');
      await checkAllBadges(userId);
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