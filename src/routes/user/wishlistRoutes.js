import express from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../../controllers/products/wishlistController.js";

const router = express.Router();

router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.delete("/remove/:productId", removeFromWishlist);

export default router;
