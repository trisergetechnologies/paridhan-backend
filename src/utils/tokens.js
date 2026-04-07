import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { AUTH_TOKEN_TYPE } from "../constants/auth.js";

const ACCESS_SECRET = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const ACCESS_TTL = () => process.env.JWT_ACCESS_TTL || "30m";
const REFRESH_TTL = () => process.env.JWT_REFRESH_TTL || "7d";

export const signAccessToken = ({ userId, activeRole, roles, sid }) => {
  const jti = randomUUID();
  const token = jwt.sign(
    {
      sub: String(userId),
      activeRole,
      roles,
      sid,
      type: AUTH_TOKEN_TYPE.ACCESS,
      jti,
    },
    ACCESS_SECRET(),
    { expiresIn: ACCESS_TTL() }
  );
  return { token, jti };
};

export const signRefreshToken = ({ userId, activeRole, sid }) => {
  const jti = randomUUID();
  const token = jwt.sign(
    {
      sub: String(userId),
      activeRole,
      sid,
      type: AUTH_TOKEN_TYPE.REFRESH,
      jti,
    },
    REFRESH_SECRET(),
    { expiresIn: REFRESH_TTL() }
  );
  return { token, jti };
};

export const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET());
export const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET());

export const getRefreshExpiryDate = () => {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};
