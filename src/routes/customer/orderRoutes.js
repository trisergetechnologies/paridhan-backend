import express from "express";
import { verifyCashfreePayment } from "../../controllers/payments/paymentController.js";
import { createOrder, getMyOrders, getOrderById } from "../../controllers/products/orderController.js";

const router = express.Router();

router.post("/verify-payment", verifyCashfreePayment);
router.post("/", createOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);

export default router;
