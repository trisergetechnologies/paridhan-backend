import mongoose from "mongoose";
import Cart from "../../models/Cart.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import { calculateCartTotals, lineTaxForSubtotal } from "../../services/pricingService.js";
import { decrementStockForLine } from "../../services/orderInventoryService.js";

export const createOrder = async (req, res) => {
  try {
    const { addressSlug, paymentMethod } = req.body;

    if (!addressSlug || !paymentMethod) {
      return res.status(200).json({
        success: false,
        message: "Address slug and payment method are required",
        data: null
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });

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
      const row = {
        productId: item.product,
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
      return row;
    });
    const totals = calculateCartTotals(orderItems);

    const session = await mongoose.startSession();
    let createdOrder = null;

    try {
      await session.withTransaction(async () => {
        for (const line of cart.items) {
          const ok = await decrementStockForLine(line, session);
          if (!ok) {
            throw Object.assign(new Error("INSUFFICIENT_STOCK"), { code: "INSUFFICIENT_STOCK" });
          }
        }

        const [orderDoc] = await Order.create(
          [
            {
              user: req.user._id,
              orderNumber: `ORD-${Date.now()}`,
              items: orderItems,
              shippingAddress: {
                fullName: address.fullName,
                phone: address.phone,
                street: address.street,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country
              },
              itemsTotal: totals.itemsTotal,
              taxAmount: totals.taxAmount,
              deliveryCharge: totals.deliveryCharge,
              grandTotal: totals.grandTotal,
              paymentMethod
            }
          ],
          { session }
        );

        createdOrder = orderDoc;
        await Cart.deleteOne({ user: req.user._id }).session(session);
      });

      return res.status(200).json({
        success: true,
        message: "Order placed successfully",
        data: createdOrder
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
    } finally {
      await session.endSession();
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

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Order.countDocuments({ user: req.user._id })
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
