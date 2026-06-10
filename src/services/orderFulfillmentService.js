import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import { decrementStockForLine } from "./orderInventoryService.js";

/** Decrement stock from a placed order's line items (after payment succeeds). */
export async function fulfillOrderInventory(order, session = null) {
  for (const line of order.items) {
    const ok = await decrementStockForLine(
      {
        product: line.productId,
        quantity: line.quantity,
        variantPublicId: line.variantPublicId,
      },
      session
    );
    if (!ok) {
      throw Object.assign(new Error("INSUFFICIENT_STOCK"), { code: "INSUFFICIENT_STOCK" });
    }
  }
}

/** Clear the customer's cart after a successful prepaid order. */
export async function clearUserCart(userId, session = null) {
  const q = Cart.deleteOne({ user: userId });
  if (session) q.session(session);
  await q;
}

/**
 * Finalize a prepaid order after Cashfree confirms payment.
 * Idempotent: skips if already paid and inventory was fulfilled.
 */
export async function finalizePaidOrder(order) {
  if (order.paymentStatus === "paid" && order.inventoryFulfilled) {
    return order;
  }

  if (order.paymentStatus !== "paid") {
    throw Object.assign(new Error("Order is not paid"), { code: "ORDER_NOT_PAID" });
  }

  if (!order.inventoryFulfilled) {
    await fulfillOrderInventory(order);
    order.inventoryFulfilled = true;
  }

  await clearUserCart(order.user);
  order.orderStatus = order.orderStatus === "cancelled" ? "cancelled" : "confirmed";
  await order.save();
  return order;
}

/** Mark a pending prepaid order as failed/cancelled; cart is left untouched. */
export async function cancelPendingPrepaidOrder(order) {
  if (order.paymentStatus === "paid") return order;
  order.paymentStatus = "failed";
  order.orderStatus = "cancelled";
  await order.save();
  return order;
}

/** Remove a draft order when payment session could not be created. */
export async function discardDraftOrder(orderId) {
  await Order.deleteOne({
    _id: orderId,
    paymentStatus: "pending",
    inventoryFulfilled: { $ne: true },
  });
}
