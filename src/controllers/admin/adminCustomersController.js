import mongoose from "mongoose";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import { parsePagination } from "../../utils/pagination.js";

const customerSelect = "-password";

export const listCustomers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const q = String(req.query.q || "").trim();

    const filter = {
      role: "customer",
      isDeleted: { $ne: true },
    };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).select(customerSelect).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Customers fetched",
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getCustomer = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const user = await User.findOne({
      _id: id,
      role: "customer",
      isDeleted: { $ne: true },
    }).select(customerSelect);

    if (!user) {
      return res.status(200).json({ success: false, message: "Customer not found", data: null });
    }

    const [orderCount, lastOrder] = await Promise.all([
      Order.countDocuments({ user: id }),
      Order.findOne({ user: id }).sort({ createdAt: -1 }).select("orderNumber createdAt grandTotal orderStatus").lean(),
    ]);

    const data = user.toObject ? user.toObject() : user;
    data.orderCount = orderCount;
    data.lastOrder = lastOrder;

    return res.status(200).json({
      success: true,
      message: "Customer",
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
