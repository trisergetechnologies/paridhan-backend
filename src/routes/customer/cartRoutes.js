import express from "express";
import { addToCart, clearCart, getCart, removeFromCart } from "../../controllers/products/cartController.js";

const router = express.Router();

router.get("/", getCart);
router.post("/", addToCart);
router.delete("/:productId", removeFromCart);
router.delete("/", clearCart);

export default router;
