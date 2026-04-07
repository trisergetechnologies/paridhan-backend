import express from "express";
import { getMyProfile, updateMyProfile } from "../../controllers/user/userController.js";
import wishlistRoutes from "./wishlistRoutes.js";

const router = express.Router();

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);
router.use("/wishlist", wishlistRoutes);

export default router;
