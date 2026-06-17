import Order from "../../models/Order.js";
import ReturnRequest from "../../models/ReturnRequest.js";
import { canTransitionOrderStatus } from "../../utils/orderTransitions.js";

const SHIPPED_KEYWORDS = ["shipped", "in transit", "out for delivery", "picked up"];
const DELIVERED_KEYWORDS = ["delivered", "delivery completed"];
const IN_TRANSIT_KEYWORDS = ["in transit", "picked up", "out for delivery"];

function normalizeStatus(value) {
  return String(value || "").toLowerCase();
}

function matchesAny(text, keywords) {
  const t = normalizeStatus(text);
  return keywords.some((k) => t.includes(k));
}

async function updateOrderFromWebhook({ awb, shipmentId, statusText }) {
  const filter = awb
    ? { "shipping.awb": String(awb) }
    : shipmentId
      ? { "shipping.shipmentId": Number(shipmentId) }
      : null;

  if (!filter) return null;

  const order = await Order.findOne(filter);
  if (!order) return null;

  if (matchesAny(statusText, DELIVERED_KEYWORDS)) {
    if (canTransitionOrderStatus(order.orderStatus, "delivered")) {
      order.orderStatus = "delivered";
      order.deliveredAt = new Date();
    }
  } else if (matchesAny(statusText, SHIPPED_KEYWORDS)) {
    if (canTransitionOrderStatus(order.orderStatus, "shipped")) {
      order.orderStatus = "shipped";
      order.shippedAt = order.shippedAt || new Date();
    }
  }

  await order.save();
  return order;
}

async function updateReturnFromWebhook({ awb, shipmentId, statusText }) {
  const filter = awb
    ? { "shipping.reverseAwb": String(awb) }
    : shipmentId
      ? { "shipping.shipmentId": Number(shipmentId) }
      : null;

  if (!filter) return null;

  const ret = await ReturnRequest.findOne(filter);
  if (!ret) return null;

  if (matchesAny(statusText, DELIVERED_KEYWORDS)) {
    if (["pickup_scheduled", "in_transit", "approved"].includes(ret.status)) {
      ret.status = "received";
    }
  } else if (matchesAny(statusText, IN_TRANSIT_KEYWORDS)) {
    if (["pickup_scheduled", "approved"].includes(ret.status)) {
      ret.status = "in_transit";
    }
  }

  await ret.save();
  return ret;
}

export const shiprocketWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const awb = payload.awb || payload.awb_code || payload?.shipment?.awb;
    const shipmentId = payload.shipment_id || payload?.shipment?.id;
    const statusText =
      payload.current_status ||
      payload.shipment_status ||
      payload.status ||
      payload.event ||
      "";

    await updateOrderFromWebhook({ awb, shipmentId, statusText });
    await updateReturnFromWebhook({ awb, shipmentId, statusText });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
