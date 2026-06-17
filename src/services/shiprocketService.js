const SHIPROCKET_BASE = "https://apiv2.shiprocket.in";

let cachedToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
  return Boolean(
    String(process.env.SHIPROCKET_EMAIL || "").trim() &&
      String(process.env.SHIPROCKET_PASSWORD || "").trim()
  );
}

function getPickupLocation() {
  return String(process.env.SHIPROCKET_PICKUP_LOCATION || "Primary").trim();
}

function getDefaultDimensions() {
  return {
    length: Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM) || 30,
    breadth: Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM) || 25,
    height: Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM) || 5,
    weight: Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG) || 0.5,
  };
}

async function shiprocketFetch(path, { method = "GET", body } = {}) {
  if (!isConfigured()) {
    throw Object.assign(new Error("Shiprocket is not configured"), {
      code: "SHIPROCKET_NOT_CONFIGURED",
    });
  }

  const token = await getAuthToken();
  const res = await fetch(`${SHIPROCKET_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.errors) ? json.errors.join(", ") : null) ||
      `Shiprocket API error (${res.status})`;
    throw Object.assign(new Error(msg), { code: "SHIPROCKET_API_ERROR", status: res.status, body: json });
  }

  return json;
}

export async function getAuthToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const email = String(process.env.SHIPROCKET_EMAIL || "").trim();
  const password = String(process.env.SHIPROCKET_PASSWORD || "").trim();

  const res = await fetch(`${SHIPROCKET_BASE}/v1/external/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.token) {
    throw Object.assign(new Error(json.message || "Shiprocket authentication failed"), {
      code: "SHIPROCKET_AUTH_FAILED",
    });
  }

  cachedToken = json.token;
  tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

export function shiprocketIsConfigured() {
  return isConfigured();
}

export async function checkServiceability({ pickupPin, deliveryPin, weight, cod = 0 }) {
  const params = new URLSearchParams({
    pickup_postcode: String(pickupPin),
    delivery_postcode: String(deliveryPin),
    weight: String(weight || getDefaultDimensions().weight),
    cod: String(cod ? 1 : 0),
  });
  return shiprocketFetch(`/v1/external/courier/serviceability/?${params}`);
}

function buildOrderItems(order) {
  return (order.items || []).map((line) => ({
    name: String(line.name || "Product").slice(0, 100),
    sku: String(line.productPublicId || line.productSlug || line.productId || "SKU").slice(0, 50),
    units: line.quantity,
    selling_price: line.price,
    discount: 0,
    tax: line.lineTax || 0,
    hsn: line.hsnCode || undefined,
  }));
}

function formatOrderDate(date) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export async function createForwardOrder(order) {
  const addr = order.shippingAddress || {};
  const dims = getDefaultDimensions();
  const paymentMethod = order.paymentMethod === "cod" ? "COD" : "Prepaid";

  const payload = {
    order_id: String(order.orderNumber).slice(0, 50),
    order_date: formatOrderDate(order.createdAt),
    pickup_location: getPickupLocation(),
    billing_customer_name: addr.fullName || "Customer",
    billing_last_name: "",
    billing_address: addr.street || "",
    billing_city: addr.city || "",
    billing_pincode: String(addr.postalCode || ""),
    billing_state: addr.state || "",
    billing_country: addr.country || "India",
    billing_email: order.user?.email || "customer@paridhanemporium.com",
    billing_phone: String(addr.phone || "").replace(/\D/g, "").slice(-10),
    shipping_is_billing: true,
    order_items: buildOrderItems(order),
    payment_method: paymentMethod,
    sub_total: order.itemsTotal,
    length: dims.length,
    breadth: dims.breadth,
    height: dims.height,
    weight: dims.weight,
  };

  return shiprocketFetch("/v1/external/orders/create/adhoc", { method: "POST", body: payload });
}

export async function assignAwb({ shipmentId, courierId }) {
  const body = { shipment_id: shipmentId };
  if (courierId) body.courier_id = courierId;
  return shiprocketFetch("/v1/external/courier/assign/awb", { method: "POST", body });
}

export async function generatePickup({ shipmentId, pickupDate }) {
  const body = { shipment_id: [shipmentId] };
  if (pickupDate) body.pickup_date = [pickupDate];
  return shiprocketFetch("/v1/external/courier/generate/pickup", { method: "POST", body });
}

export async function cancelShipment(shipmentId) {
  return shiprocketFetch(`/v1/external/orders/cancel/shipment/${shipmentId}`, { method: "POST" });
}

export async function getTrackingByAwb(awb) {
  return shiprocketFetch(`/v1/external/courier/track/awb/${awb}`);
}

export async function createReturnOrder(order, returnRequest) {
  const addr = order.shippingAddress || {};
  const dims = getDefaultDimensions();
  const returnItems = (returnRequest.items || []).map((line) => ({
    name: String(line.name || "Product").slice(0, 100),
    sku: String(line.productPublicId || line.productSlug || "SKU").slice(0, 50),
    units: line.quantity,
    selling_price: line.price,
    discount: 0,
    tax: line.lineTax || 0,
  }));

  const subTotal = returnItems.reduce(
    (sum, item) => sum + Number(item.selling_price) * Number(item.units),
    0
  );

  const payload = {
    order_id: `RET-${returnRequest.returnNumber}`.slice(0, 50),
    order_date: formatOrderDate(returnRequest.createdAt),
    pickup_customer_name: addr.fullName || "Customer",
    pickup_last_name: "",
    pickup_address: addr.street || "",
    pickup_city: addr.city || "",
    pickup_state: addr.state || "",
    pickup_pincode: String(addr.postalCode || ""),
    pickup_country: addr.country || "India",
    pickup_email: returnRequest.customerEmail || "customer@paridhanemporium.com",
    pickup_phone: String(addr.phone || "").replace(/\D/g, "").slice(-10),
    shipping_customer_name: process.env.SHIPROCKET_WAREHOUSE_NAME || "Paridhan Emporium",
    shipping_address: process.env.SHIPROCKET_WAREHOUSE_ADDRESS || "",
    shipping_city: process.env.SHIPROCKET_WAREHOUSE_CITY || "",
    shipping_state: process.env.SHIPROCKET_WAREHOUSE_STATE || "",
    shipping_pincode: process.env.SHIPROCKET_WAREHOUSE_PINCODE || "",
    shipping_country: "India",
    shipping_phone: process.env.SHIPROCKET_WAREHOUSE_PHONE || "",
    order_items: returnItems,
    payment_method: "Prepaid",
    sub_total: subTotal || order.itemsTotal,
    length: dims.length,
    breadth: dims.breadth,
    height: dims.height,
    weight: dims.weight,
  };

  return shiprocketFetch("/v1/external/orders/create/return", { method: "POST", body: payload });
}

/** Create forward order, assign AWB, and schedule pickup in one flow. */
export async function createForwardShipment(order) {
  const created = await createForwardOrder(order);
  const shipmentId =
    created?.shipment_id ||
    created?.payload?.shipment_id ||
    created?.order_id;

  if (!shipmentId) {
    throw Object.assign(new Error("Shiprocket did not return a shipment id"), {
      code: "SHIPROCKET_NO_SHIPMENT",
      body: created,
    });
  }

  const awbResult = await assignAwb({ shipmentId });
  const awb =
    awbResult?.response?.data?.awb_code ||
    awbResult?.awb_code ||
    awbResult?.awb_assign_status;

  let pickupResult = null;
  try {
    pickupResult = await generatePickup({ shipmentId });
  } catch {
    // Pickup can be scheduled later from dashboard
  }

  return {
    shiprocketOrderId: String(created.order_id || created.channel_order_id || ""),
    shipmentId: Number(shipmentId),
    awb: awbResult?.response?.data?.awb_code || awbResult?.awb_code || null,
    courierName: awbResult?.response?.data?.courier_name || null,
    trackingUrl: awb ? `https://shiprocket.co/tracking/${awb}` : null,
    raw: { created, awbResult, pickupResult },
  };
}
