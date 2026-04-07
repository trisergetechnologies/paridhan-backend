const TAX_RATE = Number(process.env.TAX_RATE_PERCENT || 5);
const SHIPPING_FREE_THRESHOLD = Number(process.env.SHIPPING_FREE_THRESHOLD || 999);
const SHIPPING_BASE_FEE = Number(process.env.SHIPPING_BASE_FEE || 80);

/** Effective GST % for a cart/order line (product-specific or platform default). */
export function lineGstRate(item, defaultRate = TAX_RATE) {
  if (item?.gstPercent != null && item.gstPercent !== "" && !Number.isNaN(Number(item.gstPercent))) {
    return Number(item.gstPercent);
  }
  return defaultRate;
}

export function lineTaxForSubtotal(subtotal, item) {
  const rate = lineGstRate(item);
  return Math.round((Number(subtotal) * rate) / 100);
}

export const calculateCartTotals = (items) => {
  const itemsTotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const taxAmount = items.reduce((sum, item) => sum + lineTaxForSubtotal(item.subtotal, item), 0);
  const deliveryCharge = itemsTotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_BASE_FEE;
  const grandTotal = itemsTotal + taxAmount + deliveryCharge;

  return {
    itemsTotal,
    taxAmount,
    deliveryCharge,
    grandTotal,
  };
};
