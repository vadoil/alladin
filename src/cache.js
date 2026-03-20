import Redis from "ioredis";

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 30);
const REDIS_URL = process.env.REDIS_URL;

let redis = null;
if (REDIS_URL) {
  redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.connect().catch((err) => {
    console.error("[cache] redis_connect_failed", err.message);
    redis = null;
  });
}

const memoryCache = new Map();

export async function cacheGet(key) {
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error("[cache] redis_get_failed", err.message);
    }
  }

  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

export async function cacheSet(key, data) {
  if (redis) {
    try {
      const ttlSeconds = Math.max(1, Math.floor(CACHE_TTL_MS / 1000));
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
      return;
    } catch (err) {
      console.error("[cache] redis_set_failed", err.message);
    }
  }

  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
