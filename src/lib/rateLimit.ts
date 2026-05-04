import Redis from 'ioredis';

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const memoryStore = new Map<string, { count: number; expiry: number }>();

function memoryRateLimit(key: string, windowMs: number, maxRequests: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.expiry) {
    memoryStore.set(key, { count: 1, expiry: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.expiry - now) / 1000) };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

function memorySetEx(key: string, ttlSeconds: number) {
  memoryStore.set(key, { count: 1, expiry: Date.now() + ttlSeconds * 1000 });
}

function memoryIncr(key: string, ttlSeconds: number): number {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.expiry) {
    memoryStore.set(key, { count: 1, expiry: now + ttlSeconds * 1000 });
    return 1;
  }

  entry.count++;
  return entry.count;
}

function memoryDel(key: string) {
  memoryStore.delete(key);
}

function memoryExists(key: string): number {
  const entry = memoryStore.get(key);
  if (!entry || Date.now() > entry.expiry) {
    memoryStore.delete(key);
    return 0;
  }
  return 1;
}

function isRedisConfigured(): boolean {
  const url = process.env.REDIS_URL;
  if (!url) return false;
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    if (process.env.NODE_ENV !== 'production') return false;
  }
  return true;
}

let redisInstance: Redis | null = null;
let redisReady = false;

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;

  if (redisInstance) {
    return redisReady ? redisInstance : null;
  }

  try {
    redisInstance = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      connectTimeout: 2000,
    });

    redisInstance.on('error', () => {
      redisReady = false;
    });

    redisInstance.on('ready', () => {
      redisReady = true;
    });

    redisInstance.on('close', () => {
      redisReady = false;
    });

    return null;
  } catch {
    return null;
  }
}

async function useRedis(): Promise<Redis | null> {
  const client = getRedis();
  if (!client) return null;

  if (redisReady) return client;

  try {
    await client.ping();
    redisReady = true;
    return client;
  } catch {
    return null;
  }
}

const rateLimits = {
  perUser: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:user',
  },
  attemptsPerUser: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'ratelimit:attempts:user',
  },
  perIP: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'ratelimit:ip',
  },
  blockAfterFailures: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'ratelimit:block:user',
  },
  global: {
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: 'ratelimit:global',
  },
};

export const checkRateLimit = async (
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  const key = `${config.keyPrefix}:${identifier}`;
  const redis = await useRedis();

  if (redis) {
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, config.windowMs);
      }
      if (current > config.maxRequests) {
        const ttl = await redis.pttl(key);
        return { allowed: false, retryAfter: Math.ceil(ttl / 1000) };
      }
      return { allowed: true, remaining: config.maxRequests - current };
    } catch {
      return { allowed: true };
    }
  }

  return memoryRateLimit(key, config.windowMs, config.maxRequests);
};

export const isBlocked = async (email: string): Promise<boolean> => {
  const key = `block:user:${email}`;
  const redis = await useRedis();

  if (redis) {
    try {
      const blocked = await redis.exists(key);
      return blocked === 1;
    } catch {
      return false;
    }
  }

  return memoryExists(key) === 1;
};

export const blockUser = async (email: string, durationMs: number = 15 * 60 * 1000) => {
  const key = `block:user:${email}`;
  const redis = await useRedis();

  if (redis) {
    try {
      await redis.setex(key, Math.ceil(durationMs / 1000), '1');
      return;
    } catch {
      // fallback
    }
  }

  memorySetEx(key, Math.ceil(durationMs / 1000));
};

export const recordFailure = async (email: string): Promise<number> => {
  const key = `failures:user:${email}`;
  const redis = await useRedis();

  let count: number;

  if (redis) {
    try {
      count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 15 * 60);
      }
      if (count >= 5) {
        await blockUser(email);
      }
      return count;
    } catch {
      // fallback to memory
    }
  }

  count = memoryIncr(key, 15 * 60);
  if (count >= 5) {
    await blockUser(email);
  }
  return count;
};

export const clearFailures = async (email: string) => {
  const key = `failures:user:${email}`;
  const redis = await useRedis();

  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      // fallback
    }
  }

  memoryDel(key);
};

export const checkUserRateLimit = async (email: string) => {
  return checkRateLimit(email, rateLimits.perUser);
};

export const checkIPRateLimit = async (ip: string) => {
  return checkRateLimit(ip, rateLimits.perIP);
};

export const checkGlobalRateLimit = async () => {
  return checkRateLimit('global', rateLimits.global);
};

export const checkAttemptsLimit = async (email: string) => {
  return checkRateLimit(email, rateLimits.attemptsPerUser);
};
