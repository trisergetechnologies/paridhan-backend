import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";

const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export const getAdminStats = async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalOrders,
      revenueAgg,
      sellerCount,
      customerCount,
      productCount,
      ordersLast30Days,
      statusAgg,
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]),
      User.countDocuments({ roles: "seller", isDeleted: { $ne: true } }),
      User.countDocuments({ role: "customer", isDeleted: { $ne: true } }),
      Product.countDocuments({ isDeleted: { $ne: true } }),
      Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
    ]);

    const revenue = revenueAgg[0]?.total ?? 0;
    const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const row of statusAgg) {
      if (row._id && ordersByStatus[row._id] !== undefined) {
        ordersByStatus[row._id] = row.count;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Stats",
      data: {
        totalOrders,
        revenuePaidOrders: revenue,
        sellerCount,
        customerCount,
        productCount,
        ordersLast30Days,
        ordersByStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
