import { randomUUID } from "crypto";
import mongoose from "mongoose";
import Category from "../../models/Category.js";
import Product from "../../models/Product.js";
import { deleteManyImageKitFiles } from "../../services/imagekitService.js";
import { parsePagination } from "../../utils/pagination.js";

function normalizeVariantImage(img) {
  if (!img || !img.url) return null;
  return {
    url: String(img.url),
    alt: String(img.alt || ""),
    ...(img.fileId ? { fileId: String(img.fileId) } : {}),
  };
}

function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants.map((v) => {
    const attrs = Array.isArray(v.attributes)
      ? v.attributes
          .filter((a) => a && (String(a.name || "").trim() || String(a.value || "").trim()))
          .map((a) => ({
            name: String(a.name || "").trim(),
            value: String(a.value || "").trim(),
          }))
      : [];
    const images = Array.isArray(v.images)
      ? v.images.map(normalizeVariantImage).filter(Boolean)
      : [];
    const publicId =
      v.publicId && String(v.publicId).trim() ? String(v.publicId).trim() : `var_${randomUUID().replace(/-/g, "")}`;
    return {
      publicId,
      attributes: attrs,
      sku: v.sku ? String(v.sku).trim() : undefined,
      price: v.price !== undefined && v.price !== "" && v.price != null ? Number(v.price) : undefined,
      mrp: v.mrp !== undefined && v.mrp !== "" && v.mrp != null ? Number(v.mrp) : undefined,
      stock: Math.max(0, Number(v.stock) || 0),
      isActive: v.isActive !== false,
      images,
    };
  });
}

function variantImageFileIds(variants) {
  const ids = [];
  for (const v of variants || []) {
    for (const im of v.images || []) {
      if (im?.fileId) ids.push(String(im.fileId));
    }
  }
  return ids;
}

function slugify(name) {
  const s = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s || "product";
}

async function ensureUniqueSlug(base) {
  let slug = base;
  let n = 0;
  while (await Product.exists({ slug })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

async function validateCategoryIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, message: "categories required" };
  const clean = ids.map((id) => String(id)).filter((id) => mongoose.isValidObjectId(id));
  if (clean.length === 0) return { ok: false, message: "Invalid category ids" };
  const count = await Category.countDocuments({ _id: { $in: clean }, isActive: true });
  if (count !== clean.length) {
    return { ok: false, message: "One or more categories not found or inactive" };
  }
  return { ok: true, ids: clean };
}

const sellerScope = (userId, extra = {}) => ({
  seller: userId,
  ...extra,
});

export const listSellerProducts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const includeDeleted = req.query.includeDeleted === "true";
    const filter = sellerScope(req.user._id, includeDeleted ? {} : { isDeleted: { $ne: true } });

    const [items, total] = await Promise.all([
      Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate("categories", "name slug"),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched",
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getSellerProduct = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }
    const product = await Product.findOne(sellerScope(req.user._id, { _id: id })).populate(
      "categories",
      "name slug"
    );
    if (!product) {
      return res.status(200).json({ success: false, message: "Product not found", data: null });
    }
    return res.status(200).json({ success: true, message: "Product fetched", data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const createSellerProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      mrp,
      stock,
      sku,
      categories,
      images,
      fabric,
      color,
      blouseIncluded,
      length,
      variants,
      isFeatured,
      slug: slugInput,
      discountPercentage,
      gstPercent,
      hsnCode,
    } = req.body;

    if (!name || !description || price === undefined || stock === undefined) {
      return res.status(200).json({
        success: false,
        message: "name, description, price, and stock are required",
        data: null,
      });
    }

    const cat = await validateCategoryIds(categories);
    if (!cat.ok) {
      return res.status(200).json({ success: false, message: cat.message, data: null });
    }

    const baseSlug = slugify(slugInput || name);
    const slug = await ensureUniqueSlug(baseSlug);

    const product = await Product.create({
      name,
      slug,
      description,
      price: Number(price),
      mrp: mrp !== undefined && mrp !== "" ? Number(mrp) : undefined,
      stock: Number(stock),
      sku: sku || undefined,
      categories: cat.ids,
      images: Array.isArray(images)
        ? images.map((i) => ({
            url: i.url,
            alt: i.alt || "",
            ...(i.fileId ? { fileId: String(i.fileId) } : {}),
          }))
        : [],
      fabric,
      color,
      blouseIncluded,
      length,
      variants: normalizeVariants(variants),
      discountPercentage:
        discountPercentage != null && discountPercentage !== ""
          ? Number(discountPercentage)
          : undefined,
      gstPercent: gstPercent != null && gstPercent !== "" ? Number(gstPercent) : undefined,
      hsnCode: hsnCode != null && String(hsnCode).trim() ? String(hsnCode).trim() : undefined,
      isFeatured: Boolean(isFeatured),
      seller: req.user._id,
      isActive: true,
      isDeleted: false,
    });

    const fresh = await Product.findById(product._id).populate("categories", "name slug");
    return res.status(200).json({ success: true, message: "Product created", data: fresh });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const updateSellerProduct = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const product = await Product.findOne(sellerScope(req.user._id, { _id: id, isDeleted: { $ne: true } }));
    if (!product) {
      return res.status(200).json({ success: false, message: "Product not found", data: null });
    }

    const allowed = [
      "name",
      "description",
      "price",
      "mrp",
      "stock",
      "sku",
      "fabric",
      "color",
      "blouseIncluded",
      "length",
      "isActive",
      "isFeatured",
      "discountPercentage",
      "gstPercent",
      "hsnCode",
    ];

    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      if (key === "discountPercentage" || key === "gstPercent") {
        const v = req.body[key];
        product[key] = v === null || v === "" ? undefined : Number(v);
        continue;
      }
      if (key === "hsnCode") {
        product.hsnCode = req.body.hsnCode ? String(req.body.hsnCode).trim() : undefined;
        continue;
      }
      if (key === "price" || key === "mrp" || key === "stock") {
        product[key] = Number(req.body[key]);
      } else {
        product[key] = req.body[key];
      }
    }

    if (req.body.variants !== undefined) {
      const oldV = variantImageFileIds(product.variants);
      const normalized = normalizeVariants(req.body.variants);
      const newV = variantImageFileIds(normalized);
      const nextSet = new Set(newV);
      const toDel = oldV.filter((fid) => !nextSet.has(fid));
      await deleteManyImageKitFiles(toDel);
      product.variants = normalized;
    }

    if (req.body.categories !== undefined) {
      const cat = await validateCategoryIds(req.body.categories);
      if (!cat.ok) {
        return res.status(200).json({ success: false, message: cat.message, data: null });
      }
      product.categories = cat.ids;
    }

    if (typeof req.body.slug === "string" && req.body.slug.trim()) {
      const next = slugify(req.body.slug);
      const exists = await Product.findOne({ slug: next, _id: { $ne: product._id } });
      if (exists) {
        return res.status(200).json({ success: false, message: "Slug already in use", data: null });
      }
      product.slug = next;
    }

    if (req.body.images !== undefined) {
      const oldImages = product.images || [];
      const newImages = Array.isArray(req.body.images) ? req.body.images : [];
      const oldIds = new Set(oldImages.map((i) => i.fileId).filter(Boolean).map(String));
      const newIds = new Set(newImages.map((i) => i.fileId).filter(Boolean).map(String));
      const toDelete = [...oldIds].filter((fid) => !newIds.has(fid));
      await deleteManyImageKitFiles(toDelete);
      product.images = newImages.map((i) => ({
        url: i.url,
        alt: i.alt || "",
        ...(i.fileId ? { fileId: String(i.fileId) } : {}),
      }));
    }

    await product.save();
    const fresh = await Product.findById(product._id).populate("categories", "name slug");
    return res.status(200).json({ success: true, message: "Product updated", data: fresh });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const softDeleteSellerProduct = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(200).json({ success: false, message: "Invalid id", data: null });
    }

    const product = await Product.findOne(sellerScope(req.user._id, { _id: id }));
    if (!product) {
      return res.status(200).json({ success: false, message: "Product not found", data: null });
    }

    const fileIds = (product.images || []).map((i) => i.fileId).filter(Boolean);
    const variantFids = variantImageFileIds(product.variants);
    await deleteManyImageKitFiles([...fileIds, ...variantFids]);

    product.isDeleted = true;
    product.isActive = false;
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from catalog",
      data: { id: product._id },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
