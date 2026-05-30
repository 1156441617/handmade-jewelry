const Redis = require('ioredis');
require('dotenv').config();

// 检查是否启用无数据库模式
const NO_DB_MODE = process.env.NO_DB_MODE === 'true';

let redis;
let redisConnected = false;

if (!NO_DB_MODE) {
  // Redis客户端配置
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  // 连接事件
  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
    redisConnected = true;
  });

  redis.on('ready', () => {
    redisConnected = true;
  });

  redis.on('error', (err) => {
    console.warn('⚠️  Redis connection error:', err.message);
    console.log('💡 Tip: Set NO_DB_MODE=true to run without Redis');
    redisConnected = false;
  });
} else {
  console.log('⚠️  Running in NO_DB_MODE - Redis disabled');
  redisConnected = false;
}

// 内存缓存(无Redis时使用)
const memoryCache = new Map();

// 缓存辅助函数
const cache = {
  // 设置缓存
  async set(key, value, expireSeconds = 3600) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        // 使用内存缓存
        memoryCache.set(key, {
          value,
          expire: Date.now() + (expireSeconds * 1000)
        });
        return true;
      }

      const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
      if (expireSeconds) {
        await redis.setex(key, expireSeconds, stringValue);
      } else {
        await redis.set(key, stringValue);
      }
      return true;
    } catch (error) {
      console.warn('Redis SET error, using memory cache:', error.message);
      // 降级到内存缓存
      memoryCache.set(key, {
        value,
        expire: Date.now() + (expireSeconds * 1000)
      });
      return true;
    }
  },

  // 获取缓存
  async get(key, parse = true) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        // 从内存缓存获取
        const item = memoryCache.get(key);
        if (!item) return null;
        if (Date.now() > item.expire) {
          memoryCache.delete(key);
          return null;
        }
        return item.value;
      }

      const value = await redis.get(key);
      if (!value) return null;
      return parse ? JSON.parse(value) : value;
    } catch (error) {
      console.warn('Redis GET error:', error.message);
      return null;
    }
  },

  // 删除缓存
  async del(key) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        memoryCache.delete(key);
        return true;
      }
      await redis.del(key);
      return true;
    } catch (error) {
      console.warn('Redis DEL error:', error.message);
      return false;
    }
  },

  // 批量删除(支持模式匹配)
  async delPattern(pattern) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        let count = 0;
        for (const key of memoryCache.keys()) {
          if (new RegExp(pattern.replace('*', '.*')).test(key)) {
            memoryCache.delete(key);
            count++;
          }
        }
        return count;
      }

      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.warn('Redis DEL pattern error:', error.message);
      return 0;
    }
  },

  // 检查键是否存在
  async exists(key) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        const item = memoryCache.get(key);
        if (!item) return false;
        if (Date.now() > item.expire) {
          memoryCache.delete(key);
          return false;
        }
        return true;
      }
      return await redis.exists(key) === 1;
    } catch (error) {
      console.warn('Redis EXISTS error:', error.message);
      return false;
    }
  },

  // 设置哈希
  async hset(key, field, value) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        if (!memoryCache.has(key)) {
          memoryCache.set(key, { value: {}, expire: Date.now() + 3600000 });
        }
        const data = memoryCache.get(key);
        data.value[field] = value;
        return true;
      }

      const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
      await redis.hset(key, field, stringValue);
      return true;
    } catch (error) {
      console.warn('Redis HSET error:', error.message);
      return false;
    }
  },

  // 获取哈希字段
  async hget(key, field, parse = true) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        const data = memoryCache.get(key);
        if (!data) return null;
        return data.value[field] || null;
      }

      const value = await redis.hget(key, field);
      if (!value) return null;
      return parse ? JSON.parse(value) : value;
    } catch (error) {
      console.warn('Redis HGET error:', error.message);
      return null;
    }
  },

  // 递增计数器
  async incr(key, expireSeconds = null) {
    try {
      if (!redisConnected || NO_DB_MODE) {
        const current = memoryCache.get(key)?.value || 0;
        const newValue = current + 1;
        memoryCache.set(key, {
          value: newValue,
          expire: Date.now() + ((expireSeconds || 3600) * 1000)
        });
        return newValue;
      }

      const newValue = await redis.incr(key);
      if (expireSeconds && newValue === 1) {
        await redis.expire(key, expireSeconds);
      }
      return newValue;
    } catch (error) {
      console.warn('Redis INCR error:', error.message);
      return null;
    }
  },
};

module.exports = {
  redis,
  cache,
  isRedisConnected: () => redisConnected,
  NO_DB_MODE,
};
