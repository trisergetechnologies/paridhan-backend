import Order from "../models/Order.js";
import { canTransitionOrderStatus } from "../utils/orderTransitions.js";
import {
  createForwardShipment,
  createReturnOrder,
  assignAwb,
  generatePickup,
  shiprocketIsConfigured,
} from "./shiprocketService.js";

export async function tryCreateShiprocketForwardShipment(order) {
  if (!shiprocketIsConfigured()) {
    throw Object.assign(new Error("Shiprocket is not configured"), {
      code: "SHIPROCKET_NOT_CONFIGURED",
    });
  }

  const populated = await Order.findById(order._id).populate("user", "email").lean();
  const result = await createForwardShipment(populated);

  order.shipping = {
    mode: "shiprocket",
    shiprocketOrderId: result.shiprocketOrderId,
    shipmentId: result.shipmentId,
    awb: result.awb,
    courierName: result.courierName,
    trackingUrl: result.trackingUrl,
    shiprocketError: null,
  };

  if (canTransitionOrderStatus(order.orderStatus, "shipped")) {
    order.orderStatus = "shipped";
    order.shippedAt = new Date();
  }

  await order.save();
  return { order, shiprocket: result };
}

export async function setManualShipping(order, { awb, courierName, trackingUrl, markShipped = true }) {
  order.shipping = {
    mode: "manual",
    shiprocketOrderId: order.shipping?.shiprocketOrderId,
    shipmentId: order.shipping?.shipmentId,
    awb: awb ? String(awb).trim() : undefined,
    courierName: courierName ? String(courierName).trim() : undefined,
    trackingUrl: trackingUrl ? String(trackingUrl).trim() : undefined,
    shiprocketError: order.shipping?.shiprocketError,
  };

  if (markShipped && canTransitionOrderStatus(order.orderStatus, "shipped")) {
    order.orderStatus = "shipped";
    order.shippedAt = new Date();
  }

  await order.save();
  return order;
}

export async function tryCreateShiprocketReturn(order, returnRequest) {
  if (!shiprocketIsConfigured()) {
    throw Object.assign(new Error("Shiprocket is not configured"), {
      code: "SHIPROCKET_NOT_CONFIGURED",
    });
  }

  const populated = await Order.findById(order._id).lean();
  const created = await createReturnOrder(populated, returnRequest);

  const shipmentId =
    created?.shipment_id ||
    created?.payload?.shipment_id ||
    created?.order_id;

  let awb = null;
  let courierName = null;
  let trackingUrl = null;

  if (shipmentId) {
    try {
      const awbResult = await assignAwb({ shipmentId });
      awb = awbResult?.response?.data?.awb_code || awbResult?.awb_code || null;
      courierName = awbResult?.response?.data?.courier_name || null;
      trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : null;
      await generatePickup({ shipmentId });
    } catch {
      // AWB/pickup can be retried from dashboard
    }
  }

  returnRequest.shipping = {
    mode: "shiprocket",
    reverseAwb: awb,
    courierName,
    trackingUrl,
    shiprocketOrderId: String(created?.order_id || ""),
    shipmentId: shipmentId ? Number(shipmentId) : undefined,
    shiprocketError: null,
  };
  returnRequest.status = "pickup_scheduled";
  await returnRequest.save();

  return { returnRequest, shiprocket: created };
}

export function setManualReturnShipping(returnRequest, { reverseAwb, courierName, trackingUrl, instructions }) {
  returnRequest.shipping = {
    mode: "manual",
    reverseAwb: reverseAwb ? String(reverseAwb).trim() : undefined,
    courierName: courierName ? String(courierName).trim() : undefined,
    trackingUrl: trackingUrl ? String(trackingUrl).trim() : undefined,
    instructions: instructions ? String(instructions).trim().slice(0, 1000) : undefined,
  };
  returnRequest.status = "pickup_scheduled";
  return returnRequest;
}
