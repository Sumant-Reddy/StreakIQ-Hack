const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const getRedis = () => {
  if (!redis) {
    // 1. Corrected the parentheses closure so the configuration object is passed inside
    // 2. Removed 'const' so it mutates the global 'let redis' defined above
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    redis.on('connect', () => logger.info('Redis connected successfully'));
    redis.on('error', (err) => logger.error('Redis connection error:', err.message));
  }
  return redis;
};

module.exports = { getRedis };