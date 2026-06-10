import express from "express";
import {
  loginCustomer,
  logoutAllSessions,
  logoutSession,
  refreshSession,
  registerCustomer,
} from "../../controllers/auth/auth.controller.js";
import { isGoogleOAuthConfigured } from "../../config/loadEnv.js";
import {
  exchangeGoogleOAuthCode,
  googleOAuthCallback,
  startGoogleOAuth,
} from "../../controllers/auth/googleOAuth.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.get("/google/status", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: isGoogleOAuthConfigured()
      ? "Google OAuth is configured"
      : "Google OAuth is not configured",
    data: {
      configured: isGoogleOAuthConfigured(),
      callbackUrl:
        process.env.GOOGLE_OAUTH_CALLBACK_URL ||
        "http://localhost:4601/api/v1/auth/google/callback",
    },
  });
});
router.get("/google", startGoogleOAuth);
router.get("/google/callback", googleOAuthCallback);
router.post("/google/exchange", exchangeGoogleOAuthCode);
router.post("/refresh", refreshSession);
router.post("/logout", protect, logoutSession);
router.post("/logout-all", protect, logoutAllSessions);

export default router;
