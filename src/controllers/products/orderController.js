import mongoose from "mongoose";
import Cart from "../../models/Cart.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import {
  createCashfreePaymentSession,
  getCashfreeCheckoutMode,
} from "../../services/cashfreeService.js";
import { discardDraftOrder } from "../../services/orderFulfillmentService.js";
import { calculateCartTotals, lineTaxForSubtotal } from "../../services/pricingService.js";

function buildReturnUrl(orderMongoId) {
  const base =
    process.env.STOREFRONT_URL ||
    process.env.CASHFREE_RETURN_URL_BASE ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/checkout/payment-return?orderId=${orderMongoId}`;
}

function buildNotifyUrl() {
  const base =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.CASHFREE_NOTIFY_URL_BASE ||
    `http://localhost:${process.env.PORT || 4600}`;
  return `${base.replace(/\/$/, "")}/api/v1/public/payments/cashfree/webhook`;
}

function isReplicaSetRequiredError(err) {
  const msg = String(err?.message || "");
  return msg.includes("replica set") || msg.includes("mongos");
}

/** Create a pending prepaid order. Cart and stock are untouched until payment succeeds. */
async function createPendingPrepaidOrder({ orderItems, totals, address, userId, session }) {
  const createOpts = session ? { session } : {};
  const [orderDoc] = await Order.create(
    [
      {
        user: userId,
        orderNumber: `ORD-${Date.now()}`,
        items: orderItems,
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          street: address.street,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
        itemsTotal: totals.itemsTotal,
        taxAmount: totals.taxAmount,
        deliveryCharge: totals.deliveryCharge,
        grandTotal: totals.grandTotal,
        paymentMethod: "online",
        paymentStatus: "pending",
        orderStatus: "awaiting_payment",
        inventoryFulfilled: false,
      },
    ],
    createOpts
  );

  return orderDoc;
}

export const createOrder = async (req, res) => {
  try {
    const { addressSlug } = req.body;

    if (!addressSlug) {
      return res.status(200).json({
        success: false,
        message: "Delivery address is required",
        data: null
      });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "publicId slug shippingUseDefault shippingCharge"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: false,
        message: "Cart is empty",
        data: null
      });
    }

    const user = await User.findById(req.user._id);

    const address = user.addresses.find(
      (addr) => addr.slug === addressSlug
    );

    if (!address) {
      return res.status(200).json({
        success: false,
        message: "Address not found",
        data: null
      });
    }

    const orderItems = cart.items.map((item) => {
      const lineTax = lineTaxForSubtotal(item.subtotal, item);
      const productDoc =
        item.product && typeof item.product === "object" ? item.product : null;
      const productRef = productDoc?._id ?? item.product;

      const row = {
        productId: productRef,
        name: item.name,
        image: item.image,
        price: item.price,
        mrp: item.mrp,
        quantity: item.quantity,
        subtotal: item.subtotal,
        seller: item.seller,
        lineTax,
      };
      if (item.gstPercent != null && item.gstPercent !== "") {
        row.gstPercent = Number(item.gstPercent);
      }
      if (item.hsnCode) {
        row.hsnCode = String(item.hsnCode);
      }
      if (item.variantPublicId) {
        row.variantPublicId = item.variantPublicId;
        row.variantLabel = item.variantLabel;
      }
      if (productDoc?.publicId) {
        row.productPublicId = productDoc.publicId;
      }
      if (productDoc?.slug) {
        row.productSlug = productDoc.slug;
      }
      return row;
    });
    const totals = calculateCartTotals(
      cart.items.map((item) => ({
        subtotal: item.subtotal,
        gstPercent: item.gstPercent,
        product: item.product,
        shippingUseDefault: item.shippingUseDefault,
        shippingCharge: item.shippingCharge,
      })),
    );

    let createdOrder = null;

    try {
      const session = await mongoose.startSession();
      try {
        try {
          await session.withTransaction(async () => {
            createdOrder = await createPendingPrepaidOrder({
              orderItems,
              totals,
              address,
              userId: req.user._id,
              session,
            });
          });
        } catch (txErr) {
          if (!isReplicaSetRequiredError(txErr)) throw txErr;
          createdOrder = await createPendingPrepaidOrder({
            orderItems,
            totals,
            address,
            userId: req.user._id,
            session: null,
          });
        }
      } finally {
        await session.endSession();
      }

      let payment = null;

      try {
        const cfOrderId = createdOrder.orderNumber;
        const sessionInfo = await createCashfreePaymentSession({
          orderId: cfOrderId,
          amount: createdOrder.grandTotal,
          customer: {
            id: user._id,
            name: address.fullName,
            email: user.email,
            phone: address.phone,
          },
          returnUrl: buildReturnUrl(createdOrder._id),
          notifyUrl: buildNotifyUrl(),
        });

        createdOrder.cashfreeOrderId = sessionInfo.cashfreeOrderId;
        createdOrder.paymentSessionId = sessionInfo.paymentSessionId;
        await createdOrder.save();

        payment = {
          provider: "cashfree",
          paymentSessionId: sessionInfo.paymentSessionId,
          cashfreeOrderId: sessionInfo.cashfreeOrderId,
          mode: getCashfreeCheckoutMode(),
        };
      } catch (err) {
        await discardDraftOrder(createdOrder._id);
        if (err?.code === "CASHFREE_NOT_CONFIGURED") {
          return res.status(200).json({
            success: false,
            message:
              "Online payment is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY to paridhan-backend/.env and restart the backend server.",
            data: null,
          });
        }
        return res.status(200).json({
          success: false,
          message: err.message || "Could not start online payment",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Complete payment to confirm your order. Your cart is saved until payment succeeds.",
        data: {
          order: createdOrder,
          payment,
        },
      });
    } catch (err) {
      if (err?.code === "INSUFFICIENT_STOCK") {
        return res.status(200).json({
          success: false,
          message: "Insufficient stock for one or more items",
          data: null
        });
      }
      throw err;
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const visibleOrderFilter = {
      user: req.user._id,
      $nor: [
        {
          paymentMethod: "online",
          paymentStatus: "pending",
          inventoryFulfilled: false,
        },
      ],
    };

    const [orders, total] = await Promise.all([
      Order.find(visibleOrderFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),

      Order.countDocuments(visibleOrderFilter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: {
        items: orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};



export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(200).json({
        success: false,
        message: "Order not found",
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};
