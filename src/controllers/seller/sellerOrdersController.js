import mongoose from "mongoose";
import Order from "../../models/Order.js";
import {
  canTransitionOrderStatus,
  isValidOrderStatus,
  isValidPaymentStatus,
} from "../../utils/orderTransitions.js";
import { parsePagination } from "../../utils/pagination.js";

const sellerIdMatches = (order, sellerId) =>
  Array.isArray(order.items) && order.items.some((line) => String(line.seller) === String(sellerId));

export const listSellerOrders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const sellerId = req.user._id;
    const filter = { "items.seller": sellerId };

    if (req.query.orderStatus && isValidOrderStatus(req.query.orderStatus)) {
      filter.orderStatus = req.query.orderStatus;
    }
    if (req.query.paymentStatus && isValidPaymentStatus(req.query.paymentStatus)) {
      filter.paymentStatus = req.query.paymentStatus;
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

export const getSellerOrder = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const order = await Order.findById(id).populate("user", "name email phone").lean();
    if (!order || !sellerIdMatches(order, req.user._id)) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    return res.status(200).json({ success: true, message: "Order fetched", data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const patchSellerOrder = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(id);
    if (!order || !sellerIdMatches(order, req.user._id)) {
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
