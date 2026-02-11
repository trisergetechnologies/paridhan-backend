import mongoose from "mongoose";

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
  },
  {
    timestamps: true,
  },
);

productSchema.virtual("discountPercentageCalculated").get(function () {
  if (!this.mrp || this.mrp <= this.price) return 0;
  return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});

const Product = mongoose.model("Product", productSchema);
export default Product;
