import mongoose from "mongoose";
import Order from "../../models/Order.js";
import {
  canTransitionOrderStatus,
  isValidOrderStatus,
  isValidPaymentStatus,
} from "../../utils/orderTransitions.js";
import { parsePagination } from "../../utils/pagination.js";
import { markOrderRefunded } from "../../services/orderCancellationService.js";
import {
  tryCreateShiprocketForwardShipment,
  setManualShipping,
} from "../../services/orderShippingService.js";

export const listOrders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = {};

    if (req.query.orderStatus && isValidOrderStatus(req.query.orderStatus)) {
      filter.orderStatus = req.query.orderStatus;
    }
    if (req.query.paymentStatus && isValidPaymentStatus(req.query.paymentStatus)) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.userId && mongoose.isValidObjectId(req.query.userId)) {
      filter.user = req.query.userId;
    }
    if (req.query.sellerId && mongoose.isValidObjectId(req.query.sellerId)) {
      filter["items.seller"] = req.query.sellerId;
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched",
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getOrder = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const order = await Order.findById(id).populate("user", "name email phone").lean();
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }
    return res.status(200).json({
      success: true,
      message: "Order fetched",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const patchOrder = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    if (orderStatus !== undefined) {
      if (!isValidOrderStatus(orderStatus)) {
        return res.status(200).json({ success: false, message: "Invalid orderStatus", data: null });
      }
      if (!canTransitionOrderStatus(order.orderStatus, orderStatus)) {
        return res.status(200).json({
          success: false,
          message: `Cannot change order status from ${order.orderStatus} to ${orderStatus}`,
          data: null,
        });
      }
      order.orderStatus = orderStatus;
      if (orderStatus === "shipped" && !order.shippedAt) {
        order.shippedAt = new Date();
      }
      if (orderStatus === "delivered") {
        order.deliveredAt = new Date();
        if (!order.shippedAt) order.shippedAt = new Date();
      }
      if (orderStatus === "cancelled" && !order.cancelledAt) {
        order.cancelledAt = new Date();
      }
    }

    if (paymentStatus !== undefined) {
      if (!isValidPaymentStatus(paymentStatus)) {
        return res.status(200).json({ success: false, message: "Invalid paymentStatus", data: null });
      }
      order.paymentStatus = paymentStatus;
    }

    if (orderStatus === undefined && paymentStatus === undefined) {
      return res.status(200).json({ success: false, message: "Nothing to update", data: null });
    }

    await order.save();
    const fresh = await Order.findById(id).populate("user", "name email phone").lean();

    return res.status(200).json({
      success: true,
      message: "Order updated",
      data: fresh,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const createShipment = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { useManual } = req.body || {};
    const order = await Order.findById(id);
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    if (!["confirmed", "packed"].includes(order.orderStatus)) {
      return res.status(200).json({
        success: false,
        message: "Shipment can only be created for confirmed or packed orders",
        data: null,
      });
    }

    if (useManual) {
      order.shipping = { mode: "manual", ...(order.shipping || {}) };
      if (order.orderStatus === "confirmed" && canTransitionOrderStatus("confirmed", "packed")) {
        order.orderStatus = "packed";
      }
      await order.save();
      const fresh = await Order.findById(id).populate("user", "name email phone").lean();
      return res.status(200).json({
        success: true,
        message: "Manual shipping mode enabled. Download label and enter AWB when shipped.",
        data: fresh,
      });
    }

    try {
      const result = await tryCreateShiprocketForwardShipment(order);
      const fresh = await Order.findById(id).populate("user", "name email phone").lean();
      return res.status(200).json({
        success: true,
        message: "Shiprocket shipment created",
        data: fresh,
        shiprocket: result.shiprocket,
      });
    } catch (err) {
      order.shipping = {
        mode: "manual",
        shiprocketError: err.message,
      };
      if (order.orderStatus === "confirmed") {
        order.orderStatus = "packed";
      }
      await order.save();
      const fresh = await Order.findById(id).populate("user", "name email phone").lean();
      return res.status(200).json({
        success: false,
        message: `Shiprocket failed: ${err.message}. Use manual shipping instead.`,
        data: fresh,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const patchOrderShipping = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { awb, courierName, trackingUrl, markShipped } = req.body;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    await setManualShipping(order, {
      awb,
      courierName,
      trackingUrl,
      markShipped: markShipped !== false,
    });

    const fresh = await Order.findById(id).populate("user", "name email phone").lean();
    return res.status(200).json({
      success: true,
      message: "Shipping details updated",
      data: fresh,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const markOrderRefundedHandler = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { referenceNote } = req.body || {};
    const order = await Order.findById(id);
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    try {
      await markOrderRefunded(order, {
        adminId: req.user._id,
        referenceNote,
      });
    } catch (err) {
      return res.status(200).json({ success: false, message: err.message, data: null });
    }

    const fresh = await Order.findById(id).populate("user", "name email phone").lean();
    return res.status(200).json({
      success: true,
      message: "Order marked as refunded",
      data: fresh,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
