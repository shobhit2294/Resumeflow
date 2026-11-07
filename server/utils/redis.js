let Redis;
try {
  Redis = require('ioredis');
} catch (_) {
  Redis = null;
}

let client = null;

/**
 * Returns a shared Redis client.
 * Connects immediately so pub/sub and command queues work properly.
 */
function getRedis() {
  if (!Redis) return null;
  if (client) return client;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  try {
    client = new Redis(redisUrl, {
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 5) {
          console.warn('⚠️  Redis max retries reached, falling back to memory');
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
    });

    client.on('error', (err) => {
      console.warn('⚠️  Redis notice:', err.message);
    });

    return client;
  } catch (err) {
    console.warn('⚠️  Redis init failed:', err.message);
    return null;
  }
}

module.exports = { getRedis };
