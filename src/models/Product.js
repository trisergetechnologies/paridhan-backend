import mongoose from "mongoose";
import { randomUUID } from "crypto";

const variantImageSchema = new mongoose.Schema(
  {
    url: String,
    alt: String,
    fileId: { type: String, trim: true },
  },
  { _id: false }
);

const variantAttributeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    value: { type: String, trim: true },
  },
  { _id: false }
);

const productVariantSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    attributes: [variantAttributeSchema],
    sku: { type: String, trim: true },
    price: { type: Number, min: 0 },
    mrp: { type: Number, min: 0 },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    images: [variantImageSchema],
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // ================= CORE INFO =================
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    publicId: {
      type: String,
      unique: true,
      index: true,
      required: true,
      default: () => `prd_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    },

    description: {
      type: String,
      required: true,
    },

    // ================= PRICING =================
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    mrp: {
      type: Number,
      min: 0,
    },

    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    /** GST % applied to this product’s line subtotal at checkout; omit to use platform TAX_RATE. */
    gstPercent: {
      type: Number,
      min: 0,
      max: 100,
    },

    /** HSN code for invoicing / display (optional). */
    hsnCode: {
      type: String,
      trim: true,
      maxlength: 16,
    },

    // ================= INVENTORY =================
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    sku: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ================= SAREE SPECIFIC =================
    fabric: String,
    color: String,
    blouseIncluded: {
      type: Boolean,
      default: true,
    },

    length: {
      type: String,
      default: "5.5m",
    },

    // ================= MEDIA =================
    images: [
      {
        url: String,
        alt: String,
        fileId: { type: String, trim: true },
      },
    ],

    // ================= CATEGORY RELATION =================
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
    ],

    // ================= STATUS =================
    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    variants: {
      type: [productVariantSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ "variants.publicId": 1 }, { unique: true, sparse: true });

productSchema.virtual("discountPercentageCalculated").get(function () {
  if (!this.mrp || this.mrp <= this.price) return 0;
  return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});

const Product = mongoose.model("Product", productSchema);
export default Product;
