import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      connectTimeout: 10000,
      lazyConnect: true,
    })
  : null;

if (redis) {
  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error);
  });
}

export { redis };

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) {
    return null;
  }

  const data = await redis.get(key);
  return data ? (JSON.parse(data) as T) : null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function deleteCache(key: string): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.del(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis) {
    return;
  }

  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
