import Redis from "ioredis";

let redisClient = null;
let redisDisabled = false;
let redisErrorLogged = false;

const logRedisUnavailable = (message) => {
  if (redisErrorLogged) return;
  redisErrorLogged = true;
  console.warn("Backend Redis unavailable; continuing without Redis:", message);
};

export const getRedis = () => {
  if (redisDisabled) return null;
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisClient = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy: null,
  });

  redisClient.on("error", (err) => {
    logRedisUnavailable(err.message);
  });

  return redisClient;
};

export const ensureRedis = async () => {
  const redis = getRedis();
  if (!redis) return null;
  if (redis.status === "ready") return redis;
  if (redis.status === "connecting") return null;
  try {
    await redis.connect();
    return redis;
  } catch (error) {
    logRedisUnavailable(error instanceof Error ? error.message : "connection failed");
    redis.disconnect();
    redisClient = null;
    redisDisabled = true;
    return null;
  }
};
