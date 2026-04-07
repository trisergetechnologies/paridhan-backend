import Redis from "ioredis";

let redisClient = null;

export const getRedis = () => {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisClient = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
  });

  redisClient.on("error", (err) => {
    console.warn("Backend Redis error:", err.message);
  });

  return redisClient;
};

export const ensureRedis = async () => {
  const redis = getRedis();
  if (!redis) return null;
  if (redis.status === "ready" || redis.status === "connecting") return redis;
  try {
    await redis.connect();
    return redis;
  } catch {
    return null;
  }
};
