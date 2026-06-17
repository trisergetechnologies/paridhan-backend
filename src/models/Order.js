import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    // ===== PRODUCT SNAPSHOT =====
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    productPublicId: {
      type: String,
      trim: true
    },

    productSlug: {
      type: String,
      trim: true
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

    gstPercent: {
      type: Number,
      min: 0,
      max: 100
    },

    hsnCode: {
      type: String,
      trim: true
    },

    /** Tax amount for this line at order time (GST % × subtotal, rounded). */
    lineTax: {
      type: Number,
      min: 0
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

const shippingSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["shiprocket", "manual"],
      default: "manual"
    },
    shiprocketOrderId: String,
    shipmentId: Number,
    awb: String,
    courierName: String,
    trackingUrl: String,
    shiprocketError: String
  },
  { _id: false }
);

const refundSchema = new mongoose.Schema(
  {
    amount: Number,
    refundPendingAt: Date,
    refundedAt: Date,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    referenceNote: String
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
      enum: ["pending", "paid", "failed", "refund_pending", "refunded"],
      default: "pending"
    },

    cashfreeOrderId: {
      type: String,
      trim: true,
      index: true,
      sparse: true
    },

    paymentSessionId: {
      type: String,
      trim: true
    },

    /** Stock decremented only after prepaid payment succeeds. */
    inventoryFulfilled: {
      type: Boolean,
      default: false
    },

    // ================= ORDER STATUS =================
    orderStatus: {
      type: String,
      enum: [
        "awaiting_payment",
        "placed",
        "confirmed",
        "packed",
        "shipped",
        "delivered",
        "cancelled"
      ],
      default: "placed"
    },

    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,

    shipping: shippingSchema,
    refund: refundSchema
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
