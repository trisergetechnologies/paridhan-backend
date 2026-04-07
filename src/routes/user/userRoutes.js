import express from "express";
import {
  changeMyPassword,
  getMyProfile,
  updateMyProfile,
} from "../../controllers/user/userController.js";
import wishlistRoutes from "./wishlistRoutes.js";

const router = express.Router();

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);
router.patch("/me/password", changeMyPassword);
router.use("/wishlist", wishlistRoutes);

export default router;
