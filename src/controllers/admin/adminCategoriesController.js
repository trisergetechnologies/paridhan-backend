import mongoose from "mongoose";
import Category from "../../models/Category.js";
import Product from "../../models/Product.js";
import { parsePagination } from "../../utils/pagination.js";

function slugify(name) {
  const s = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s || "category";
}

export const listCategoriesAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { slug: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Categories",
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getCategoryAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const cat = await Category.findById(id).lean();
    if (!cat) {
      return res.status(200).json({ success: false, message: "Category not found", data: null });
    }
    const productCount = await Product.countDocuments({ categories: id, isDeleted: { $ne: true } });
    return res.status(200).json({
      success: true,
      message: "Category",
      data: { ...cat, productCount },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, slug: slugInput, isActive } = req.body;
    if (!name) {
      return res.status(200).json({ success: false, message: "name is required", data: null });
    }
    const slug = slugify(slugInput || name);
    const exists = await Category.findOne({ slug });
    if (exists) {
      return res.status(200).json({ success: false, message: "Slug already exists", data: null });
    }
    const cat = await Category.create({
      name: String(name).trim(),
      slug,
      description: description != null ? String(description) : "",
      isActive: isActive !== false,
    });
    return res.status(200).json({ success: true, message: "Category created", data: cat });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const cat = await Category.findById(id);
    if (!cat) {
      return res.status(200).json({ success: false, message: "Category not found", data: null });
    }

    const { name, description, slug: slugInput, isActive } = req.body;
    if (name !== undefined) cat.name = String(name).trim();
    if (description !== undefined) cat.description = String(description);
    if (typeof isActive === "boolean") cat.isActive = isActive;
    if (slugInput !== undefined && String(slugInput).trim()) {
      const next = slugify(slugInput);
      const taken = await Category.findOne({ slug: next, _id: { $ne: id } });
      if (taken) {
        return res.status(200).json({ success: false, message: "Slug already in use", data: null });
      }
      cat.slug = next;
    }

    await cat.save();
    return res.status(200).json({ success: true, message: "Category updated", data: cat });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const count = await Product.countDocuments({ categories: id, isDeleted: { $ne: true } });
    if (count > 0) {
      return res.status(200).json({
        success: false,
        message: `Cannot delete: ${count} product(s) still use this category. Deactivate instead.`,
        data: null,
      });
    }
    await Category.deleteOne({ _id: id });
    return res.status(200).json({ success: true, message: "Category deleted", data: null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
