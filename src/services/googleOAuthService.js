import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { isGoogleOAuthConfigured as readGoogleOAuthConfigured } from "../config/loadEnv.js";
import { ensureRedis } from "../config/redis.js";

const OAUTH_STATE_TTL_SEC = 10 * 60;
const OAUTH_CODE_TTL_SEC = 2 * 60;
const OAUTH_CODE_PREFIX = `${process.env.REDIS_AUTH_PREFIX || "paridhan:auth"}:google:code:`;

const getStateSecret = () =>
  process.env.GOOGLE_OAUTH_STATE_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  "dev-google-oauth-state-secret";

export const isGoogleOAuthConfigured = () => readGoogleOAuthConfigured();

export const getGoogleRedirectUri = () =>
  process.env.GOOGLE_OAUTH_CALLBACK_URL ||
  "http://localhost:4601/api/v1/auth/google/callback";

const createOAuthClient = () =>
  new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: getGoogleRedirectUri(),
  });

export const signOAuthState = (payload) =>
  jwt.sign(payload, getStateSecret(), { expiresIn: OAUTH_STATE_TTL_SEC });

export const verifyOAuthState = (state) => {
  try {
    return jwt.verify(state, getStateSecret());
  } catch {
    return null;
  }
};

export const buildGoogleAuthUrl = (state) => {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });
};

export const exchangeGoogleCode = async (code) => {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token");
  }
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const profile = ticket.getPayload();
  if (!profile?.email || !profile.sub) {
    throw new Error("Google profile is incomplete");
  }
  if (profile.email_verified === false) {
    throw new Error("Google email is not verified");
  }
  return {
    googleId: profile.sub,
    email: String(profile.email).toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    avatar: profile.picture || "",
  };
};

export const storeOAuthExchangeCode = async ({ accessToken, refreshToken }) => {
  const redis = await ensureRedis();
  if (redis) {
    const code = randomBytes(24).toString("hex");
    await redis.setex(
      `${OAUTH_CODE_PREFIX}${code}`,
      OAUTH_CODE_TTL_SEC,
      JSON.stringify({ accessToken, refreshToken }),
    );
    return code;
  }

  return jwt.sign(
    { accessToken, refreshToken, kind: "google_oauth_exchange" },
    getStateSecret(),
    { expiresIn: OAUTH_CODE_TTL_SEC },
  );
};

export const consumeOAuthExchangeCode = async (code) => {
  if (!code || typeof code !== "string") return null;

  const redis = await ensureRedis();
  if (redis) {
    const key = `${OAUTH_CODE_PREFIX}${code.trim()}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    await redis.del(key);
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  try {
    const decoded = jwt.verify(code.trim(), getStateSecret());
    if (decoded?.kind !== "google_oauth_exchange") return null;
    return {
      accessToken: decoded.accessToken,
      refreshToken: decoded.refreshToken,
    };
  } catch {
    return null;
  }
};
