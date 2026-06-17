import ReturnRequest from "../models/ReturnRequest.js";

function getReturnWindowDays() {
  return Number(process.env.ORDER_RETURN_WINDOW_DAYS) || 7;
}

export function getReturnEligibility(order, existingReturns = []) {
  if (!order) {
    return { eligible: false, reason: "Order not found" };
  }

  if (order.orderStatus !== "delivered") {
    return { eligible: false, reason: "Returns are only available for delivered orders" };
  }

  if (!order.deliveredAt) {
    return { eligible: false, reason: "Delivery date is not recorded for this order" };
  }

  const windowMs = getReturnWindowDays() * 24 * 60 * 60 * 1000;
  const deliveredAt = new Date(order.deliveredAt).getTime();
  if (Date.now() - deliveredAt > windowMs) {
    return {
      eligible: false,
      reason: `Return window expired (${getReturnWindowDays()} days from delivery)`,
    };
  }

  const openReturn = existingReturns.find((r) =>
    ["requested", "approved", "pickup_scheduled", "in_transit", "received", "inspected"].includes(
      r.status
    )
  );
  if (openReturn) {
    return { eligible: false, reason: "A return request is already in progress for this order" };
  }

  return { eligible: true, reason: null };
}

export async function getExistingReturnsForOrder(orderId) {
  return ReturnRequest.find({ order: orderId }).lean();
}
