import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { AUTH_ERRORS } from "../constants/auth.js";

export const protect = async (req, res, next) => {
  try {
    // Gateway-first auth contract: trusted headers from gateway.
    const gatewayUserId = req.headers["x-auth-user-id"];
    const gatewayRole = req.headers["x-auth-role"];
    const gatewayActiveRole = req.headers["x-auth-active-role"];
    const gatewayRoles = req.headers["x-auth-roles"];
    const gatewaySid = req.headers["x-auth-session-id"];
    const gatewayJti = req.headers["x-auth-jti"];

    if (gatewayUserId && gatewayRole && gatewaySid) {
      const user = await User.findById(gatewayUserId).select("-password");
      if (!user || user.isBlocked || user.isDeleted) {
        return res.status(401).json({
          success: false,
          code: AUTH_ERRORS.USER_BLOCKED,
          message: "Not authorized",
          data: null,
        });
      }
      req.auth = {
        userId: String(gatewayUserId),
        role: String(gatewayRole || ""),
        activeRole: String(gatewayActiveRole || gatewayRole || ""),
        roles: gatewayRoles ? String(gatewayRoles).split(",").filter(Boolean) : user.roles || [user.role],
        sid: String(gatewaySid),
        jti: gatewayJti ? String(gatewayJti) : null,
      };
      req.user = user;
      return next();
    }

    // Fallback verification (useful for direct backend calls).
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        code: AUTH_ERRORS.TOKEN_MISSING,
        message: "Not authorized, token missing",
        data: null
      });
    }

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub).select("-password");

    if (!user || user.isBlocked || user.isDeleted) {
      return res.status(401).json({
        success: false,
        code: AUTH_ERRORS.USER_BLOCKED,
        message: "Not authorized",
        data: null
      });
    }

    req.auth = {
      userId: String(decoded.sub),
      role: String(decoded.activeRole || decoded.role || ""),
      activeRole: String(decoded.activeRole || decoded.role || ""),
      roles: Array.isArray(decoded.roles) ? decoded.roles : user.roles || [user.role],
      sid: String(decoded.sid),
      jti: decoded.jti ? String(decoded.jti) : null,
    };
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: AUTH_ERRORS.TOKEN_INVALID,
      message: "Invalid or expired token",
      data: null
    });
  }
};
