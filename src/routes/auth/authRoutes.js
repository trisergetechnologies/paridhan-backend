import express from "express";
import {
  loginCustomer,
  logoutAllSessions,
  logoutSession,
  refreshSession,
  registerCustomer,
} from "../../controllers/auth/auth.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/refresh", refreshSession);
router.post("/logout", protect, logoutSession);
router.post("/logout-all", protect, logoutAllSessions);

export default router;
