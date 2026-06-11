import { ensureRedis } from "../config/redis.js";

const CACHE_PREFIX = process.env.REDIS_CACHE_PREFIX || "paridhan-gateway";

function singleProductCacheKeys({ _id, publicId, slug } = {}) {
  const keys = new Set();
  if (publicId) keys.add(`${CACHE_PREFIX}:products:single:${publicId}`);
  if (slug) keys.add(`${CACHE_PREFIX}:products:single:${String(slug).toLowerCase()}`);
  if (_id) keys.add(`${CACHE_PREFIX}:products:single:${String(_id)}`);
  return [...keys];
}

async function deleteKeys(redis, keys) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return;
  await redis.del(...unique);
}

async function deleteListCaches(redis) {
  const pattern = `${CACHE_PREFIX}:products:list:*`;
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== "0");
}

/**
 * Bust API-gateway Redis caches after seller catalog changes so storefront
 * shows fresh fabric / care / spec fields immediately.
 */
export async function invalidateProductPublicCache(product, { previousSlug } = {}) {
  const redis = await ensureRedis();
  if (!redis || !product) return;

  try {
    const keys = singleProductCacheKeys(product);
    if (previousSlug && previousSlug !== product.slug) {
      keys.push(`${CACHE_PREFIX}:products:single:${String(previousSlug).toLowerCase()}`);
    }
    await deleteKeys(redis, keys);
    await deleteListCaches(redis);
  } catch (error) {
    console.warn("[cache] product public cache invalidation failed:", error.message);
  }
}
