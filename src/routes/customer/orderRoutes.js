import express from "express";
import { verifyCashfreePayment } from "../../controllers/payments/paymentController.js";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getOrderCancelStatus,
} from "../../controllers/products/orderController.js";
import { createReturnRequest } from "../../controllers/returns/returnController.js";

const router = express.Router();

router.post("/verify-payment", verifyCashfreePayment);
router.post("/", createOrder);
router.get("/", getMyOrders);
router.post("/:id/cancel", cancelOrder);
router.get("/:id/eligibility", getOrderCancelStatus);
router.post("/:id/return", createReturnRequest);
router.get("/:id", getOrderById);

export default router;
