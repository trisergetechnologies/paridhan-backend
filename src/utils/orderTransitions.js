const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed"];

const ALLOWED_FROM = {
  placed: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["packed", "cancelled"]),
  packed: new Set(["shipped", "cancelled"]),
  shipped: new Set(["delivered", "cancelled"]),
  delivered: new Set([]),
  cancelled: new Set([]),
};

export const isValidOrderStatus = (s) => ORDER_STATUSES.includes(s);
export const isValidPaymentStatus = (s) => PAYMENT_STATUSES.includes(s);

export const canTransitionOrderStatus = (from, to) => {
  if (from === to) return true;
  if (!ORDER_STATUSES.includes(from) || !ORDER_STATUSES.includes(to)) return false;
  return ALLOWED_FROM[from]?.has(to) ?? false;
};
