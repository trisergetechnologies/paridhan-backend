import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import { revokeAllSessions } from "../../services/authSessionService.js";
import { parsePagination } from "../../utils/pagination.js";

const sellerSelect = "-password";

const toSellerDto = (u) => {
  const o = u.toObject ? u.toObject() : { ...u };
  delete o.password;
  return o;
};

export const listSellers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const q = String(req.query.q || "").trim();
    const includeDeleted = req.query.includeDeleted === "true";

    const filter = {
      roles: "seller",
      ...(includeDeleted ? {} : { isDeleted: { $ne: true } }),
    };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).select(sellerSelect).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Sellers fetched",
      data: {
        items: items.map(toSellerDto),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getSeller = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const user = await User.findOne({ _id: id, roles: "seller" }).select(sellerSelect);
    if (!user) {
      return res.status(200).json({ success: false, message: "Seller not found", data: null });
    }
    const [productCount, ordersWithSellerLines] = await Promise.all([
      Product.countDocuments({ seller: id, isDeleted: { $ne: true } }),
      Order.countDocuments({ "items.seller": id }),
    ]);
    const data = { ...toSellerDto(user), productCount, ordersWithSellerLines };
    return res.status(200).json({
      success: true,
      message: "Seller fetched",
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const createSeller = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(200).json({
        success: false,
        message: "name, email, and password are required",
        data: null,
      });
    }

    const existing = await User.findOne({ $or: [{ email }, ...(phone ? [{ phone }] : [])] });
    if (existing) {
      return res.status(200).json({
        success: false,
        message: "User with this email or phone already exists",
        data: null,
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: "seller",
      roles: ["seller"],
    });

    const fresh = await User.findById(user._id).select(sellerSelect);
    return res.status(200).json({
      success: true,
      message: "Seller created",
      data: toSellerDto(fresh),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const updateSeller = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const user = await User.findOne({ _id: id, roles: "seller" });
    if (!user || user.isDeleted) {
      return res.status(200).json({ success: false, message: "Seller not found", data: null });
    }

    const { name, email, phone, isBlocked } = req.body;

    if (email && email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: id } });
      if (taken) {
        return res.status(200).json({ success: false, message: "Email already in use", data: null });
      }
      user.email = email;
    }
    if (phone !== undefined) {
      if (phone) {
        const taken = await User.findOne({ phone, _id: { $ne: id } });
        if (taken) {
          return res.status(200).json({ success: false, message: "Phone already in use", data: null });
        }
      }
      user.phone = phone || undefined;
    }
    if (name !== undefined) user.name = name;
    if (typeof isBlocked === "boolean") user.isBlocked = isBlocked;

    await user.save();
    const fresh = await User.findById(user._id).select(sellerSelect);
    return res.status(200).json({
      success: true,
      message: "Seller updated",
      data: toSellerDto(fresh),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const softDeleteSeller = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const user = await User.findOne({ _id: id, roles: "seller" });
    if (!user) {
      return res.status(200).json({ success: false, message: "Seller not found", data: null });
    }

    user.isDeleted = true;
    await user.save();
    await revokeAllSessions(user._id);

    return res.status(200).json({
      success: true,
      message: "Seller deactivated (soft delete)",
      data: { id: user._id },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const setSellerPassword = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(200).json({
        success: false,
        message: "Password must be at least 6 characters",
        data: null,
      });
    }

    const user = await User.findOne({ _id: id, roles: "seller" }).select("+password");
    if (!user || user.isDeleted) {
      return res.status(200).json({ success: false, message: "Seller not found", data: null });
    }

    user.password = password;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
