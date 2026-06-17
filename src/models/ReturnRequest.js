import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
  {
    productId: mongoose.Schema.Types.ObjectId,
    productPublicId: String,
    productSlug: String,
    name: String,
    image: String,
    price: Number,
    quantity: Number,
    subtotal: Number,
    variantPublicId: String,
    variantLabel: String,
    lineTax: Number
  },
  { _id: false }
);

const returnShippingSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["shiprocket", "manual"],
      default: "manual"
    },
    reverseAwb: String,
    courierName: String,
    trackingUrl: String,
    shiprocketOrderId: String,
    shipmentId: Number,
    instructions: String,
    shiprocketError: String
  },
  { _id: false }
);

const returnRefundSchema = new mongoose.Schema(
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

const returnRequestSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      unique: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    items: [returnItemSchema],
    reason: {
      type: String,
      required: true,
      trim: true
    },
    photos: [String],
    customerEmail: String,
    status: {
      type: String,
      enum: [
        "requested",
        "approved",
        "pickup_scheduled",
        "in_transit",
        "received",
        "inspected",
        "refunded",
        "rejected"
      ],
      default: "requested"
    },
    adminNote: String,
    shipping: returnShippingSchema,
    refund: returnRefundSchema
  },
  { timestamps: true }
);

const ReturnRequest = mongoose.model("ReturnRequest", returnRequestSchema);
export default ReturnRequest;
