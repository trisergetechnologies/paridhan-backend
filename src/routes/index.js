import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import authRoutes from "./auth/authRoutes.js";
import customerRoutes from "./customer/index.js";
import publicRoutes from "./public/index.js";
import userRoutes from "./user/userRoutes.js";

const router = express.Router();

//Auth Routes
router.use('/auth', authRoutes);



//Common Routes
router.use("/user", protect, userRoutes);



//Customer Routes
router.use("/customer", protect, authorizeRoles("customer"), customerRoutes);

router.use("/public", publicRoutes);


export default router;