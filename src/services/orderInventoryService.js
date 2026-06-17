import Product from "../models/Product.js";

/**
 * Decrements stock for one cart line. Variant lines require variantPublicId.
 * @returns {Promise<boolean>} true if stock was updated
 */
export async function decrementStockForLine(item, session) {
  const pid = item.product;
  const qty = item.quantity;
  const vid = item.variantPublicId ? String(item.variantPublicId).trim() : "";

  const product = await Product.findById(pid).session(session).lean();
  if (!product) return false;

  const hasVar = Array.isArray(product.variants) && product.variants.length > 0;

  if (hasVar) {
    if (!vid) return false;
    const result = await Product.updateOne(
      { _id: pid },
      { $inc: { "variants.$[v].stock": -qty } },
      {
        arrayFilters: [{ "v.publicId": vid, "v.stock": { $gte: qty } }],
        session,
      }
    );
    return result.modifiedCount === 1;
  }

  const result = await Product.updateOne(
    { _id: pid, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { session }
  );
  return result.modifiedCount === 1;
}

/**
 * Increments stock for one order line (cancellation / return).
 * @returns {Promise<boolean>} true if stock was updated
 */
export async function incrementStockForLine(item, session) {
  const pid = item.productId ?? item.product;
  const qty = item.quantity;
  const vid = item.variantPublicId ? String(item.variantPublicId).trim() : "";

  const product = await Product.findById(pid).session(session).lean();
  if (!product) return false;

  const hasVar = Array.isArray(product.variants) && product.variants.length > 0;

  if (hasVar) {
    if (!vid) return false;
    const result = await Product.updateOne(
      { _id: pid },
      { $inc: { "variants.$[v].stock": qty } },
      {
        arrayFilters: [{ "v.publicId": vid }],
        session,
      }
    );
    return result.modifiedCount === 1;
  }

  const result = await Product.updateOne(
    { _id: pid },
    { $inc: { stock: qty } },
    { session }
  );
  return result.modifiedCount === 1;
}

/** Restore all lines on a cancelled order. */
export async function restoreOrderInventory(order, session = null) {
  for (const line of order.items) {
    await incrementStockForLine(
      {
        productId: line.productId,
        quantity: line.quantity,
        variantPublicId: line.variantPublicId,
      },
      session
    );
  }
}
