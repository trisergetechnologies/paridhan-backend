import User from "../../models/User.js";
import {
  buildGoogleAuthUrl,
  consumeOAuthExchangeCode,
  exchangeGoogleCode,
  isGoogleOAuthConfigured,
  signOAuthState,
  storeOAuthExchangeCode,
  verifyOAuthState,
} from "../../services/googleOAuthService.js";
import {
  createSessionAndTokens,
  ensureUserRoles,
  resolveRequestedRole,
} from "./auth.controller.js";

const STOREFRONT_URL = (process.env.STOREFRONT_URL || "http://localhost:3000").replace(/\/$/, "");
const DASHBOARD_URL = (process.env.DASHBOARD_URL || "http://localhost:3001").replace(/\/$/, "");

const redirectWithError = (res, client, message) => {
  const encoded = encodeURIComponent(message);
  if (client === "dashboard") {
    return res.redirect(`${DASHBOARD_URL}/auth/google/callback?error=${encoded}`);
  }
  return res.redirect(`${STOREFRONT_URL}/auth/google/callback?error=${encoded}`);
};

const findOrCreateGoogleUser = async (profile) => {
  let user =
    (await User.findOne({ googleId: profile.googleId })) ||
    (await User.findOne({ email: profile.email }));

  if (user) {
    if (user.isBlocked || user.isDeleted) {
      throw new Error("Account is disabled");
    }
    if (!user.googleId) {
      user.googleId = profile.googleId;
    }
    if (profile.avatar && !user.avatar) {
      user.avatar = profile.avatar;
    }
    user.isEmailVerified = true;
    user.authProvider = user.password ? user.authProvider : "google";
    user.lastLoginAt = new Date();
    await user.save();
    await ensureUserRoles(user);
    return user;
  }

  user = await User.create({
    name: profile.name,
    email: profile.email,
    googleId: profile.googleId,
    avatar: profile.avatar || "",
    role: "customer",
    roles: ["customer"],
    authProvider: "google",
    isEmailVerified: true,
    lastLoginAt: new Date(),
  });
  return user;
};

export const startGoogleOAuth = async (req, res) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Google sign-in is not configured on the server",
        data: null,
      });
    }

    const client = String(req.query.client || "storefront").toLowerCase();
    const requestedRole = String(req.query.role || "customer").toLowerCase();
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";

    if (client === "dashboard" || requestedRole === "admin" || requestedRole === "seller") {
      return res.status(403).json({
        success: false,
        message: "Google sign-in is only available for customer accounts on the storefront.",
        data: null,
      });
    }

    if (!["storefront", "dashboard"].includes(client)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OAuth client",
        data: null,
      });
    }

    const state = signOAuthState({
      client,
      requestedRole,
      returnTo: returnTo.startsWith("/") ? returnTo : "/",
      nonce: Date.now(),
    });

    return res.redirect(buildGoogleAuthUrl(state));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const googleOAuthCallback = async (req, res) => {
  const clientHint = String(req.query.state ? "storefront" : "storefront");
  let client = clientHint;

  try {
    if (req.query.error) {
      const state = verifyOAuthState(req.query.state);
      client = state?.client || "storefront";
      return redirectWithError(res, client, req.query.error_description || "Google sign-in cancelled");
    }

    const { code, state: stateToken } = req.query;
    if (!code || !stateToken) {
      return redirectWithError(res, client, "Missing Google OAuth response");
    }

    const state = verifyOAuthState(stateToken);
    if (!state) {
      return redirectWithError(res, client, "OAuth session expired. Please try again.");
    }

    client = state.client || "storefront";
    const requestedRole = state.requestedRole || (client === "dashboard" ? "admin" : "customer");
    const returnTo = state.returnTo || "/";

    const profile = await exchangeGoogleCode(code);
    const user = await findOrCreateGoogleUser(profile);

    const roleContext = resolveRequestedRole(user, requestedRole);
    if (!roleContext) {
      const msg =
        client === "dashboard"
          ? "This Google account is not authorized for the selected dashboard role"
          : "Requested role is not allowed for this account";
      return redirectWithError(res, client, msg);
    }

    const tokens = await createSessionAndTokens({
      user,
      activeRole: roleContext.activeRole,
      req,
      res,
    });

    if (client === "dashboard") {
      const exchangeCode = await storeOAuthExchangeCode({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      return res.redirect(`${DASHBOARD_URL}/auth/google/callback?code=${exchangeCode}`);
    }

    const safePath = returnTo.startsWith("/") ? returnTo : "/";
    return res.redirect(`${STOREFRONT_URL}/auth/google/callback?success=1&returnTo=${encodeURIComponent(safePath)}`);
  } catch (error) {
    return redirectWithError(res, client, error.message || "Google sign-in failed");
  }
};

export const exchangeGoogleOAuthCode = async (req, res) => {
  try {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Exchange code is required",
        data: null,
      });
    }

    const tokens = await consumeOAuthExchangeCode(code);
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OAuth exchange code",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Google sign-in successful",
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
