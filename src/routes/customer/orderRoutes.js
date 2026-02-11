import express from "express";
import { createOrder, getMyOrders, getOrderById } from "../../controllers/products/orderController.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);

export default router;
