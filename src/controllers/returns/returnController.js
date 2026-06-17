import mongoose from "mongoose";
import ReturnRequest from "../../models/ReturnRequest.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import { parsePagination } from "../../utils/pagination.js";
import {
  tryCreateShiprocketReturn,
  setManualReturnShipping,
} from "../../services/orderShippingService.js";
import { getReturnEligibility } from "../../utils/returnEligibility.js";

const RETURN_STATUS_TRANSITIONS = {
  requested: new Set(["approved", "rejected"]),
  approved: new Set(["pickup_scheduled", "rejected"]),
  pickup_scheduled: new Set(["in_transit", "received", "rejected"]),
  in_transit: new Set(["received", "rejected"]),
  received: new Set(["inspected", "rejected"]),
  inspected: new Set(["refunded", "rejected"]),
  refunded: new Set([]),
  rejected: new Set([]),
};

function canTransitionReturnStatus(from, to) {
  if (from === to) return true;
  return RETURN_STATUS_TRANSITIONS[from]?.has(to) ?? false;
}

export const createReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(200).json({ success: false, message: "Invalid order id", data: null });
    }

    const { reason, photos, itemIndexes } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(200).json({ success: false, message: "Return reason is required", data: null });
    }

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    const existingReturns = await ReturnRequest.find({ order: order._id }).lean();
    const eligibility = getReturnEligibility(order, existingReturns);
    if (!eligibility.eligible) {
      return res.status(200).json({ success: false, message: eligibility.reason, data: null });
    }

    const indexes = Array.isArray(itemIndexes) ? itemIndexes.map(Number) : null;
    const selectedItems =
      indexes && indexes.length > 0
        ? order.items.filter((_, i) => indexes.includes(i))
        : order.items;

    if (selectedItems.length === 0) {
      return res.status(200).json({ success: false, message: "No items selected for return", data: null });
    }

    const user = await User.findById(req.user._id).select("email").lean();

    const returnDoc = await ReturnRequest.create({
      returnNumber: `RET-${Date.now()}`,
      order: order._id,
      user: req.user._id,
      items: selectedItems.map((line) => ({
        productId: line.productId,
        productPublicId: line.productPublicId,
        productSlug: line.productSlug,
        name: line.name,
        image: line.image,
        price: line.price,
        quantity: line.quantity,
        subtotal: line.subtotal,
        variantPublicId: line.variantPublicId,
        variantLabel: line.variantLabel,
        lineTax: line.lineTax,
      })),
      reason: String(reason).trim().slice(0, 500),
      photos: Array.isArray(photos) ? photos.map(String).slice(0, 5) : [],
      customerEmail: user?.email,
      status: "requested",
    });

    return res.status(200).json({
      success: true,
      message: "Return request submitted. We will review it shortly.",
      data: returnDoc,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getMyReturns = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { user: req.user._id };

    const [items, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("order", "orderNumber orderStatus grandTotal")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReturnRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Returns fetched",
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getReturnById = async (req, res) => {
  try {
    const ret = await ReturnRequest.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate("order", "orderNumber orderStatus grandTotal deliveredAt")
      .lean();

    if (!ret) {
      return res.status(200).json({ success: false, message: "Return not found", data: null });
    }

    return res.status(200).json({ success: true, message: "Return fetched", data: ret });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ── Admin ──

export const adminListReturns = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("user", "name email phone")
        .populate("order", "orderNumber orderStatus grandTotal paymentStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReturnRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Returns fetched",
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const adminGetReturn = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const ret = await ReturnRequest.findById(id)
      .populate("user", "name email phone")
      .populate("order")
      .lean();

    if (!ret) {
      return res.status(200).json({ success: false, message: "Return not found", data: null });
    }

    return res.status(200).json({ success: true, message: "Return fetched", data: ret });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const adminPatchReturn = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { status, adminNote } = req.body;
    const ret = await ReturnRequest.findById(id);
    if (!ret) {
      return res.status(200).json({ success: false, message: "Return not found", data: null });
    }

    if (status !== undefined) {
      if (!canTransitionReturnStatus(ret.status, status)) {
        return res.status(200).json({
          success: false,
          message: `Cannot change return status from ${ret.status} to ${status}`,
          data: null,
        });
      }
      ret.status = status;

      if (status === "refunded" && !ret.refund?.refundedAt) {
        const order = await Order.findById(ret.order);
        const refundAmount =
          ret.items.reduce((s, l) => s + Number(l.subtotal || 0), 0) || order?.grandTotal || 0;
        ret.refund = {
          amount: refundAmount,
          refundPendingAt: ret.refund?.refundPendingAt ?? new Date(),
          refundedAt: new Date(),
          refundedBy: req.user._id,
          referenceNote: ret.refund?.referenceNote,
        };
      }
    }

    if (adminNote !== undefined) {
      ret.adminNote = String(adminNote).trim().slice(0, 1000);
    }

    await ret.save();
    const fresh = await ReturnRequest.findById(id)
      .populate("user", "name email phone")
      .populate("order", "orderNumber orderStatus grandTotal paymentStatus")
      .lean();

    return res.status(200).json({ success: true, message: "Return updated", data: fresh });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const adminScheduleReturnPickup = async (req, res) => {
  try {
    const id = req.params.id;
    const { useManual, reverseAwb, courierName, trackingUrl, instructions } = req.body;

    const ret = await ReturnRequest.findById(id);
    if (!ret) {
      return res.status(200).json({ success: false, message: "Return not found", data: null });
    }

    if (!["approved", "requested"].includes(ret.status)) {
      return res.status(200).json({
        success: false,
        message: "Return must be approved before scheduling pickup",
        data: null,
      });
    }

    if (ret.status === "requested") {
      ret.status = "approved";
    }

    const order = await Order.findById(ret.order);
    if (!order) {
      return res.status(200).json({ success: false, message: "Order not found", data: null });
    }

    if (useManual) {
      setManualReturnShipping(ret, { reverseAwb, courierName, trackingUrl, instructions });
      await ret.save();
      return res.status(200).json({
        success: true,
        message: "Manual return shipping saved",
        data: ret,
      });
    }

    try {
      const result = await tryCreateShiprocketReturn(order, ret);
      return res.status(200).json({
        success: true,
        message: "Shiprocket return pickup scheduled",
        data: result.returnRequest,
      });
    } catch (err) {
      ret.shipping = {
        mode: "manual",
        shiprocketError: err.message,
      };
      await ret.save();
      return res.status(200).json({
        success: false,
        message: `Shiprocket failed: ${err.message}. Use manual return shipping instead.`,
        data: ret,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const adminMarkReturnRefunded = async (req, res) => {
  try {
    const id = req.params.id;
    const { referenceNote } = req.body;

    const ret = await ReturnRequest.findById(id);
    if (!ret) {
      return res.status(200).json({ success: false, message: "Return not found", data: null });
    }

    if (!["inspected", "received", "pickup_scheduled", "in_transit"].includes(ret.status)) {
      return res.status(200).json({
        success: false,
        message: "Return must be received and inspected before marking refunded",
        data: null,
      });
    }

    const order = await Order.findById(ret.order);
    const refundAmount =
      ret.items.reduce((s, l) => s + Number(l.subtotal || 0), 0) || order?.grandTotal || 0;

    ret.status = "refunded";
    ret.refund = {
      amount: refundAmount,
      refundPendingAt: ret.refund?.refundPendingAt ?? new Date(),
      refundedAt: new Date(),
      refundedBy: req.user._id,
      referenceNote: referenceNote ? String(referenceNote).trim().slice(0, 500) : undefined,
    };
    await ret.save();

    if (order && order.paymentStatus === "paid") {
      order.paymentStatus = "refund_pending";
      order.refund = {
        amount: refundAmount,
        refundPendingAt: new Date(),
      };
      await order.save();
    }

    return res.status(200).json({
      success: true,
      message: "Return marked as refunded. Process refund in Cashfree panel if not done yet.",
      data: ret,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
