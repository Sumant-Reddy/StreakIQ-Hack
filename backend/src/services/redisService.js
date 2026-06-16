const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const getRedis = () => {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: false,
    });
    redis.on('connect', () => logger.info('Redis connected to ' + url));
    redis.on('error', (err) => logger.warn('Redis error:', err.message));
  }
  return redis;
};

function isRedisReady() {
  try {
    const r = getRedis();
    return r.status === 'ready';
  } catch (_) {
    return false;
  }
}

async function safeGet(key) {
  try {
    const r = getRedis();
    const value = await r.get(key);
    return value ? JSON.parse(value) : null;
  } catch (_) {
    return null;
  }
}

async function safeSet(key, ttl, value) {
  try {
    const r = getRedis();
    await r.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

async function cached(key, ttl, fn) {
  if (isRedisReady()) {
    const hit = await safeGet(key);
    if (hit !== null) return hit;
  }

  const result = await fn();

  if (isRedisReady()) {
    await safeSet(key, ttl, result);
  }

  return result;
}

async function clearPattern(pattern) {
  const r = getRedis();
  const deleted = [];
  let cursor = '0';

  do {
    const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await r.del(...keys);
      deleted.push(...keys);
    }
  } while (cursor !== '0');

  logger.info(`clearPattern(${pattern}): deleted ${deleted.length} key(s)`);
  return deleted.length;
}

module.exports = { getRedis, isRedisReady, safeGet, safeSet, cached, clearPattern };
