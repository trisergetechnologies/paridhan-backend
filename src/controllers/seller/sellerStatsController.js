import Order from "../../models/Order.js";
import Product from "../../models/Product.js";

const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export const getSellerStats = async (req, res) => {
  try {
    const sellerId = req.user._id;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [productCount, orderCount, openOrders, revenueAgg, ordersLast30Days, statusAgg] =
      await Promise.all([
        Product.countDocuments({ seller: sellerId, isDeleted: { $ne: true } }),
        Order.countDocuments({ "items.seller": sellerId }),
        Order.countDocuments({
          "items.seller": sellerId,
          orderStatus: { $nin: ["delivered", "cancelled"] },
        }),
        Order.aggregate([
          { $match: { "items.seller": sellerId, paymentStatus: "paid" } },
          { $unwind: "$items" },
          { $match: { "items.seller": sellerId } },
          { $group: { _id: null, total: { $sum: "$items.subtotal" } } },
        ]),
        Order.countDocuments({
          "items.seller": sellerId,
          createdAt: { $gte: thirtyDaysAgo },
        }),
        Order.aggregate([
          { $match: { "items.seller": sellerId } },
          { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
        ]),
      ]);

    const revenueFromLines = revenueAgg[0]?.total ?? 0;
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
        productCount,
        orderCount,
        openOrders,
        revenuePaidLines: revenueFromLines,
        ordersLast30Days,
        ordersByStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
