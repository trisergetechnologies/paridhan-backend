const TAX_RATE = Number(process.env.TAX_RATE_PERCENT || 5);
const SHIPPING_FREE_THRESHOLD = Number(process.env.SHIPPING_FREE_THRESHOLD || 999);
const SHIPPING_BASE_FEE = Number(process.env.SHIPPING_BASE_FEE || 80);

export function getPlatformShippingDefaults() {
  return {
    freeThreshold: SHIPPING_FREE_THRESHOLD,
    baseFee: SHIPPING_BASE_FEE,
  };
}

function platformDeliveryCharge(itemsTotal) {
  return itemsTotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_BASE_FEE;
}

/** Resolve shipping fields for a cart/order line (snapshot or product fallback). */
export function resolveLineShipping(item) {
  const product = item?.product && typeof item.product === "object" ? item.product : null;
  const useDefault =
    item?.shippingUseDefault !== undefined
      ? item.shippingUseDefault !== false
      : product?.shippingUseDefault !== false;

  if (useDefault) {
    return { shippingUseDefault: true, shippingCharge: undefined };
  }

  const charge =
    item?.shippingCharge != null && item.shippingCharge !== ""
      ? Number(item.shippingCharge)
      : product?.shippingCharge != null
        ? Number(product.shippingCharge)
        : platformDeliveryCharge(Number(item?.subtotal || 0));

  return {
    shippingUseDefault: false,
    shippingCharge: Number.isFinite(charge) ? Math.max(0, charge) : 0,
  };
}

export function calculateDeliveryCharge(items, itemsTotal) {
  const customCharges = items
    .map((item) => resolveLineShipping(item))
    .filter((line) => line.shippingUseDefault === false)
    .map((line) => line.shippingCharge ?? 0);

  if (customCharges.length > 0) {
    return Math.max(...customCharges);
  }

  return platformDeliveryCharge(itemsTotal);
}

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
  const deliveryCharge = calculateDeliveryCharge(items, itemsTotal);
  const grandTotal = itemsTotal + taxAmount + deliveryCharge;

  return {
    itemsTotal,
    taxAmount,
    deliveryCharge,
    grandTotal,
  };
};
