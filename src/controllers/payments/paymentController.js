import Order from "../../models/Order.js";
import {
  cancelPendingPrepaidOrder,
  finalizePaidOrder,
} from "../../services/orderFulfillmentService.js";
import {
  fetchCashfreeOrder,
  mapCashfreePaymentStatus,
  verifyCashfreeWebhookSignature,
} from "../../services/cashfreeService.js";

async function applyPaymentStatus(order, mapped) {
  if (mapped === "paid") {
    order.paymentStatus = "paid";
    await finalizePaidOrder(order);
    return "paid";
  }
  if (mapped === "failed") {
    await cancelPendingPrepaidOrder(order);
    return "failed";
  }
  return "pending";
}

/** Cashfree server webhook — signature verified via CASHFREE_WEBHOOK_SECRET. */
export const cashfreeWebhook = async (req, res) => {
  try {
    const verification = verifyCashfreeWebhookSignature({
      timestamp: req.headers["x-webhook-timestamp"],
      signature: req.headers["x-webhook-signature"],
      rawBody: req.rawBody,
    });

    if (!verification.ok) {
      return res.status(401).json({
        success: false,
        message: verification.error || "Webhook signature verification failed",
      });
    }

    const payload = req.body?.data || req.body;
    const orderId = payload?.order?.order_id || payload?.order_id;
    const paymentStatus = payload?.payment?.payment_status || payload?.order?.order_status;

    if (!orderId) {
      return res.status(200).json({ success: false, message: "Missing order id" });
    }

    const order = await Order.findOne({
      $or: [{ cashfreeOrderId: orderId }, { orderNumber: orderId }],
    });

    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found" });
    }

    const mapped = mapCashfreePaymentStatus(paymentStatus);
    await applyPaymentStatus(order, mapped);

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** Customer verifies payment after Cashfree redirect. */
export const verifyCashfreePayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(200).json({
        success: false,
        message: "Order id is required",
        data: null,
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(200).json({
        success: false,
        message: "Order not found",
        data: null,
      });
    }

    if (order.paymentMethod !== "online") {
      return res.status(200).json({
        success: true,
        message: "Order is not a prepaid order",
        data: { order, paymentStatus: order.paymentStatus },
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already confirmed",
        data: { order, paymentStatus: "paid" },
      });
    }

    if (!order.cashfreeOrderId) {
      return res.status(200).json({
        success: false,
        message: "Payment session not found for this order",
        data: null,
      });
    }

    const cfOrder = await fetchCashfreeOrder(order.cashfreeOrderId);
    const mapped = mapCashfreePaymentStatus(cfOrder.order_status);
    const finalStatus = await applyPaymentStatus(order, mapped);
    const fresh = await Order.findById(order._id);

    return res.status(200).json({
      success: finalStatus === "paid",
      message:
        finalStatus === "paid"
          ? "Payment successful"
          : finalStatus === "pending"
            ? "Payment is still processing"
            : "Payment failed — your cart is unchanged",
      data: { order: fresh, paymentStatus: fresh?.paymentStatus ?? finalStatus },
    });
  } catch (error) {
    if (error?.code === "CASHFREE_NOT_CONFIGURED") {
      return res.status(200).json({
        success: false,
        message: "Online payments are not configured on the server",
        data: null,
      });
    }
    if (error?.code === "INSUFFICIENT_STOCK") {
      return res.status(200).json({
        success: false,
        message: "Payment received but an item is now out of stock. Please contact support.",
        data: null,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
