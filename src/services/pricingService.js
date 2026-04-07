const TAX_RATE = Number(process.env.TAX_RATE_PERCENT || 5);
const SHIPPING_FREE_THRESHOLD = Number(process.env.SHIPPING_FREE_THRESHOLD || 999);
const SHIPPING_BASE_FEE = Number(process.env.SHIPPING_BASE_FEE || 80);

export const calculateCartTotals = (items) => {
  const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = Math.round((itemsTotal * TAX_RATE) / 100);
  const deliveryCharge = itemsTotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_BASE_FEE;
  const grandTotal = itemsTotal + taxAmount + deliveryCharge;

  return {
    itemsTotal,
    taxAmount,
    deliveryCharge,
    grandTotal,
  };
};
