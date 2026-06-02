const { createClient } = require('redis');

let redisClient = null;
let isRedisAvailable = false;

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

if (process.env.NODE_ENV !== 'test') {
  console.log(`🔌 Initializing Redis Client on ${redisUrl}...`);
  
  redisClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries, cause) => {
        if (cause && (cause.message.includes('ENOTFOUND') || cause.message.includes('ECONNREFUSED'))) {
          console.warn('⚠️  Redis Fast-Fail: DNS or Network is unreachable. Gracefully falling back to MongoDB immediately.');
          isRedisAvailable = false;
          return false; // Stop reconnecting immediately
        }
        if (retries > 5) {
          console.warn('⚠️  Redis reconnection retries exceeded limit. Gracefully falling back to MongoDB-only queue.');
          isRedisAvailable = false;
          return false; // Stop reconnecting
        }
        console.log(`🔌 Redis reconnecting, attempt #${retries}...`);
        return Math.min(retries * 500, 2000); // backoff strategy
      }
    }
  });

  redisClient.on('connect', () => {
    console.log('🔌 Redis connecting...');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis Client Ready!');
    isRedisAvailable = true;
  });

  redisClient.on('error', (err) => {
    console.error(`❌ Redis connection error: ${err.message}`);
    // If it's a connection issue on startup, toggle off availability
    isRedisAvailable = false;
  });

  redisClient.on('end', () => {
    console.warn('🔌 Redis connection closed.');
    isRedisAvailable = false;
  });

  // Connect asynchronously
  redisClient.connect().catch((err) => {
    console.warn('⚠️  Failed to connect to Redis on startup. Graceful MongoDB fallback is active.', err.message);
    isRedisAvailable = false;
  });
}

/**
 * Safe helper wrapper to interact with Redis if available
 */
const safeRedis = {
  isAvailable: () => isRedisAvailable && redisClient?.isOpen,
  
  get: async (key) => {
    if (!safeRedis.isAvailable()) return null;
    try { return await redisClient.get(key); } catch { return null; }
  },
  
  set: async (key, value, options) => {
    if (!safeRedis.isAvailable()) return false;
    try { await redisClient.set(key, value, options); return true; } catch { return false; }
  },

  del: async (key) => {
    if (!safeRedis.isAvailable()) return false;
    try { await redisClient.del(key); return true; } catch { return false; }
  },
  
  lPush: async (queue, value) => {
    if (!safeRedis.isAvailable()) return false;
    try {
      await redisClient.lPush(queue, value);
      return true;
    } catch (err) {
      console.error('❌ Redis lPush failed:', err.message);
      return false;
    }
  },
  
  brPop: async (queue, timeoutSeconds = 2) => {
    if (!safeRedis.isAvailable()) return null;
    try {
      // brPop returns { key: '...', element: '...' } or null
      const res = await redisClient.brPop(queue, timeoutSeconds);
      return res ? res.element : null;
    } catch (err) {
      // Suppress connection closed errors during shutdown
      if (err.message.includes('closed') || err.message.includes('Connection')) return null;
      console.error('❌ Redis brPop failed:', err.message);
      return null;
    }
  },
  
  hSet: async (key, field, value) => {
    if (!safeRedis.isAvailable()) return false;
    try { await redisClient.hSet(key, field, value); return true; } catch { return false; }
  },
  
  hGet: async (key, field) => {
    if (!safeRedis.isAvailable()) return null;
    try { return await redisClient.hGet(key, field); } catch { return null; }
  },

  hGetAll: async (key) => {
    if (!safeRedis.isAvailable()) return null;
    try { return await redisClient.hGetAll(key); } catch { return null; }
  },

  quit: async () => {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  }
};

module.exports = safeRedis;
