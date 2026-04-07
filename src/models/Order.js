import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    // ===== PRODUCT SNAPSHOT =====
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    name: String,
    image: String,

    price: {
      type: Number,
      required: true
    },

    mrp: Number,

    quantity: {
      type: Number,
      required: true
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
    },

    // ===== SELLER SNAPSHOT =====
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { _id: false }
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // ================= CORE =================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    orderNumber: {
      type: String,
      unique: true,
      index: true
    },

    // ================= SNAPSHOTS =================
    items: [orderItemSchema],

    shippingAddress: addressSnapshotSchema,

    // ================= PRICING =================
    itemsTotal: {
      type: Number,
      required: true
    },

    taxAmount: {
      type: Number,
      required: true
    },

    deliveryCharge: {
      type: Number,
      required: true
    },

    grandTotal: {
      type: Number,
      required: true
    },

    currency: {
      type: String,
      default: "INR"
    },

    // ================= PAYMENT =================
    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      required: true
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending"
    },

    // ================= ORDER STATUS =================
    orderStatus: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "packed",
        "shipped",
        "delivered",
        "cancelled"
      ],
      default: "placed"
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
