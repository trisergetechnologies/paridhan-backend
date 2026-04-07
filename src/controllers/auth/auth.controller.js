import User from "../../models/User.js";
import { randomUUID } from "crypto";
import { AUTH_COOKIES, AUTH_ERRORS } from "../../constants/auth.js";
import {
  createSession,
  getActiveSession,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  validateRefreshTokenForSession,
} from "../../services/authSessionService.js";
import {
  getRefreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/tokens.js";

const cookieBaseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(AUTH_COOKIES.ACCESS, accessToken, {
    ...cookieBaseOptions,
    maxAge: 30 * 60 * 1000,
    path: "/",
  });
  res.cookie(AUTH_COOKIES.REFRESH, refreshToken, {
    ...cookieBaseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(AUTH_COOKIES.ACCESS, { ...cookieBaseOptions, path: "/" });
  res.clearCookie(AUTH_COOKIES.REFRESH, { ...cookieBaseOptions, path: "/api/v1/auth" });
};

const buildAuthResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  roles: user.roles || [user.role],
});

const resolveRequestedRole = (user, requestedRole) => {
  const effectiveRoles = user.roles?.length ? user.roles : [user.role];
  const activeRole = requestedRole || "customer";
  if (!effectiveRoles.includes(activeRole)) return null;
  return { activeRole, effectiveRoles };
};

const ensureUserRoles = async (user) => {
  const roles = Array.isArray(user.roles) ? [...user.roles] : [];
  const baseRole = user.role || "customer";
  if (!roles.includes(baseRole)) {
    roles.push(baseRole);
  }
  if (roles.length === 0) {
    roles.push("customer");
  }
  const normalized = Array.from(new Set(roles));
  if (JSON.stringify(normalized) !== JSON.stringify(user.roles || [])) {
    user.roles = normalized;
    await user.save();
  }
};

const createSessionAndTokens = async ({
  user,
  activeRole,
  req,
  res,
  sid = randomUUID(),
}) => {
  const { token: accessToken } = signAccessToken({
    userId: user._id,
    activeRole,
    roles: user.roles || [user.role],
    sid,
  });
  const { token: refreshToken, jti: refreshJti } = signRefreshToken({
    userId: user._id,
    activeRole,
    sid,
  });

  await createSession({
    userId: user._id,
    sid,
    refreshToken,
    refreshJti,
    activeRole,
    roles: user.roles || [user.role],
    userAgent: req.get("user-agent"),
    ip: req.ip,
    expiresAt: getRefreshExpiryDate(),
  });

  setAuthCookies(res, { accessToken, refreshToken });
};


/**
 * @route   POST /api/auth/register
 * @desc    Register customer
 * @access  Public
 */
export const registerCustomer = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(200).json({
        success: false,
        message: "Required fields missing",
        data: null
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(200).json({
        success: false,
        message: "User already exists",
        data: null
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: "customer",
      roles: ["customer"],
    });

    await createSessionAndTokens({ user, activeRole: "customer", req, res });

    return res.status(200).json({
      success: true,
      message: "Registration successful",
      data: {
        user: buildAuthResponse(user),
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


/**
 * @route   POST /api/auth/login
 * @desc    Login customer
 * @access  Public
 */
export const loginCustomer = async (req, res) => {
  try {
    const { email, password, requestedRole = "customer" } = req.body;

    if (!email || !password) {
      return res.status(200).json({
        success: false,
        message: "Email and password are required",
        data: null
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Invalid credentials",
        data: null
      });
    }

    if (user.isBlocked || user.isDeleted) {
      return res.status(200).json({
        success: false,
        message: "Account is disabled",
        data: null
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(200).json({
        success: false,
        message: "Invalid credentials",
        data: null
      });
    }

    await ensureUserRoles(user);
    user.lastLoginAt = new Date();
    await user.save();

    const roleContext = resolveRequestedRole(user, requestedRole);
    if (!roleContext) {
      return res.status(403).json({
        success: false,
        code: AUTH_ERRORS.ROLE_INVALID,
        message: "Requested role is not allowed for this user",
        data: null,
      });
    }

    await createSessionAndTokens({
      user,
      activeRole: roleContext.activeRole,
      req,
      res,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          ...buildAuthResponse(user),
          activeRole: roleContext.activeRole,
        },
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

export const refreshSession = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[AUTH_COOKIES.REFRESH];
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        code: AUTH_ERRORS.TOKEN_MISSING,
        message: "Refresh token missing",
        data: null,
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const session = await getActiveSession({ sid: decoded.sid, userId: decoded.sub });
    const isValid = await validateRefreshTokenForSession({
      session,
      refreshToken,
      refreshJti: decoded.jti,
    });

    if (!isValid) {
      return res.status(401).json({
        success: false,
        code: AUTH_ERRORS.SESSION_REVOKED,
        message: "Session invalid or expired",
        data: null,
      });
    }

    const user = await User.findById(decoded.sub);
    if (!user || user.isBlocked || user.isDeleted) {
      return res.status(401).json({
        success: false,
        code: AUTH_ERRORS.USER_BLOCKED,
        message: "Account is disabled",
        data: null,
      });
    }

    await ensureUserRoles(user);

    const { token: accessToken } = signAccessToken({
      userId: user._id,
      activeRole: decoded.activeRole || "customer",
      roles: user.roles || [user.role],
      sid: decoded.sid,
    });
    const { token: nextRefreshToken, jti: nextRefreshJti } = signRefreshToken({
      userId: user._id,
      activeRole: decoded.activeRole || "customer",
      sid: decoded.sid,
    });

    await rotateSession({
      session,
      refreshToken: nextRefreshToken,
      refreshJti: nextRefreshJti,
      activeRole: decoded.activeRole || "customer",
      roles: user.roles || [user.role],
    });

    setAuthCookies(res, { accessToken, refreshToken: nextRefreshToken });

    return res.status(200).json({
      success: true,
      message: "Session refreshed",
      data: {
        user: buildAuthResponse(user),
        activeRole: decoded.activeRole || "customer",
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: AUTH_ERRORS.TOKEN_INVALID,
      message: "Invalid or expired refresh token",
      data: null,
    });
  }
};

export const logoutSession = async (req, res) => {
  try {
    if (req.auth?.sid && req.auth?.userId) {
      await revokeSession({ sid: req.auth.sid, userId: req.auth.userId });
    }
    clearAuthCookies(res);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const logoutAllSessions = async (req, res) => {
  try {
    await revokeAllSessions(req.user._id);
    clearAuthCookies(res);
    return res.status(200).json({
      success: true,
      message: "All sessions revoked",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
