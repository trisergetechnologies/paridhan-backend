import Order from "../models/Order.js";
import { canTransitionOrderStatus } from "../utils/orderTransitions.js";
import { restoreOrderInventory } from "./orderInventoryService.js";
import { cancelShipment, shiprocketIsConfigured } from "./shiprocketService.js";

const CANCELLABLE_STATUSES = new Set(["placed", "confirmed", "packed"]);

function getCancelWindowHours() {
  return Number(process.env.ORDER_CANCEL_WINDOW_HOURS) || 24;
}

export function getOrderCancelEligibility(order) {
  if (!order) {
    return { eligible: false, reason: "Order not found" };
  }

  if (order.orderStatus === "cancelled") {
    return { eligible: false, reason: "Order is already cancelled" };
  }

  if (!CANCELLABLE_STATUSES.has(order.orderStatus)) {
    return {
      eligible: false,
      reason: "Orders can only be cancelled before they are shipped",
    };
  }

  const windowMs = getCancelWindowHours() * 60 * 60 * 1000;
  const placedAt = new Date(order.createdAt).getTime();
  if (Date.now() - placedAt > windowMs) {
    return {
      eligible: false,
      reason: `Cancellation window expired (${getCancelWindowHours()} hours from order placement)`,
    };
  }

  return { eligible: true, reason: null };
}

export async function cancelCustomerOrder(order, { reason, userId }) {
  const eligibility = getOrderCancelEligibility(order);
  if (!eligibility.eligible) {
    throw Object.assign(new Error(eligibility.reason), { code: "CANCEL_NOT_ALLOWED" });
  }

  if (String(order.user) !== String(userId)) {
    throw Object.assign(new Error("Order not found"), { code: "ORDER_NOT_FOUND" });
  }

  if (order.shipping?.mode === "shiprocket" && order.shipping?.shipmentId) {
    if (shiprocketIsConfigured()) {
      try {
        await cancelShipment(order.shipping.shipmentId);
      } catch (err) {
        // If shipment already picked up, block cancellation
        if (order.orderStatus === "packed") {
          throw Object.assign(
            new Error("Shipment is in progress; please request a return after delivery"),
            { code: "SHIPMENT_IN_PROGRESS" }
          );
        }
      }
    }
  }

  if (!canTransitionOrderStatus(order.orderStatus, "cancelled")) {
    throw Object.assign(new Error("Cannot cancel this order"), { code: "CANCEL_NOT_ALLOWED" });
  }

  order.orderStatus = "cancelled";
  order.cancelledAt = new Date();
  order.cancelReason = reason ? String(reason).trim().slice(0, 500) : undefined;

  if (order.inventoryFulfilled) {
    await restoreOrderInventory(order);
    order.inventoryFulfilled = false;
  }

  if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
    order.paymentStatus = "refund_pending";
    order.refund = {
      amount: order.grandTotal,
      refundPendingAt: new Date(),
      refundedAt: null,
      referenceNote: null,
    };
  }

  await order.save();
  return order;
}

export async function markOrderRefunded(order, { adminId, referenceNote }) {
  if (!["refund_pending", "paid"].includes(order.paymentStatus)) {
    throw Object.assign(new Error("Order is not awaiting refund"), { code: "REFUND_NOT_PENDING" });
  }

  order.paymentStatus = "refunded";
  order.refund = {
    ...order.refund,
    amount: order.refund?.amount ?? order.grandTotal,
    refundPendingAt: order.refund?.refundPendingAt ?? new Date(),
    refundedAt: new Date(),
    refundedBy: adminId,
    referenceNote: referenceNote ? String(referenceNote).trim().slice(0, 500) : undefined,
  };

  await order.save();
  return order;
}
