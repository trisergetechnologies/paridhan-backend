import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: String,
    image: String,

    price: {
      type: Number,
      required: true,
      min: 0
    },

    mrp: {
      type: Number,
      min: 0
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },

    subtotal: {
      type: Number,
      required: true
    },

    variantPublicId: {
      type: String,
      trim: true
    },

    variantLabel: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    items: [cartItemSchema],

    // ================= PRICE SUMMARY =================
    itemsTotal: {
      type: Number,
      default: 0
    },

    taxAmount: {
      type: Number,
      default: 0
    },

    deliveryCharge: {
      type: Number,
      default: 0
    },

    grandTotal: {
      type: Number,
      default: 0
    },

    // ================= METADATA =================
    currency: {
      type: String,
      default: "INR"
    }
  },
  {
    timestamps: true
  }
);

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
