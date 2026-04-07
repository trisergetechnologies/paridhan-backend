import bcrypt from "bcryptjs";
import AuthSession from "../models/AuthSession.js";
import { ensureRedis } from "../config/redis.js";

const REDIS_PREFIX = process.env.REDIS_AUTH_PREFIX || "paridhan:auth";
const REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;

const keyForSid = (sid) => `${REDIS_PREFIX}:sid:${sid}`;

export const createSession = async ({
  userId,
  sid,
  refreshToken,
  refreshJti,
  userAgent,
  ip,
  expiresAt,
  activeRole,
  roles,
}) => {
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await AuthSession.create({
    user: userId,
    sid,
    refreshTokenHash,
    refreshJti,
    userAgent,
    ip,
    expiresAt,
  });

  const redis = await ensureRedis();
  if (redis) {
    await redis.set(
      keyForSid(sid),
      JSON.stringify({
        userId: String(userId),
        sid,
        activeRole,
        roles,
        refreshJti,
        revoked: false,
      }),
      "EX",
      REDIS_TTL_SECONDS
    );
  }
};

export const getActiveSession = async ({ sid, userId }) => {
  return AuthSession.findOne({
    sid,
    user: userId,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
};

export const validateRefreshTokenForSession = async ({ session, refreshToken, refreshJti }) => {
  if (!session) return false;
  if (session.refreshJti !== refreshJti) return false;
  return bcrypt.compare(refreshToken, session.refreshTokenHash);
};

export const rotateSession = async ({ session, refreshToken, refreshJti, activeRole, roles }) => {
  session.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  session.refreshJti = refreshJti;
  session.lastRotatedAt = new Date();
  await session.save();

  const redis = await ensureRedis();
  if (redis) {
    await redis.set(
      keyForSid(session.sid),
      JSON.stringify({
        userId: String(session.user),
        sid: session.sid,
        activeRole,
        roles,
        refreshJti,
        revoked: false,
      }),
      "EX",
      REDIS_TTL_SECONDS
    );
  }
};

export const revokeSession = async ({ sid, userId }) => {
  await AuthSession.updateOne(
    { sid, user: userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  const redis = await ensureRedis();
  if (redis) {
    await redis.del(keyForSid(sid));
  }
};

export const revokeAllSessions = async (userId) => {
  const sessions = await AuthSession.find({
    user: userId,
    revokedAt: { $exists: false },
  }).select("sid");

  await AuthSession.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );

  const redis = await ensureRedis();
  if (redis && sessions.length) {
    await redis.del(...sessions.map((s) => keyForSid(s.sid)));
  }
};

export const getSessionFromRedis = async (sid) => {
  const redis = await ensureRedis();
  if (!redis) return null;
  const raw = await redis.get(keyForSid(sid));
  return raw ? JSON.parse(raw) : null;
};
