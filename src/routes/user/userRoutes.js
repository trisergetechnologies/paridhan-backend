import express from "express";
import { getMyProfile, updateMyProfile } from "../../controllers/user/userController.js";

const router = express.Router();

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);

export default router;
