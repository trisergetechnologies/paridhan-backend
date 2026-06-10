import crypto from "crypto";

const CASHFREE_API_VERSION = "2023-08-01";

function getWebhookSecret() {
  return String(process.env.CASHFREE_WEBHOOK_SECRET || "").trim();
}

/**
 * Verify Cashfree webhook HMAC (timestamp + raw JSON body).
 * @see https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 */
export function verifyCashfreeWebhookSignature({ timestamp, signature, rawBody }) {
  const secret = getWebhookSecret();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "CASHFREE_WEBHOOK_SECRET is not configured" };
    }
    return { ok: true, skipped: true };
  }

  if (!timestamp || !signature || rawBody == null || rawBody === "") {
    return { ok: false, error: "Missing Cashfree webhook signature headers or body" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(String(timestamp) + String(rawBody))
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(String(signature));

  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { ok: false, error: "Invalid Cashfree webhook signature" };
  }

  return { ok: true };
}

/** Infer live vs sandbox from secret shape when CASHFREE_ENV is wrong. */
export function resolveCashfreeEnvironment() {
  const configured = String(process.env.CASHFREE_ENV || "").trim().toLowerCase();
  const secret = String(process.env.CASHFREE_SECRET_KEY || "");
  const appId = String(process.env.CASHFREE_APP_ID || "");

  const looksProduction = /cfsk_ma_prod|_prod_/i.test(secret);
  const looksSandbox =
    /cfsk_ma_test|_test_/i.test(secret) || /^TEST/i.test(appId);

  if (looksProduction) return "production";
  if (looksSandbox) return "sandbox";
  if (configured === "production" || configured === "sandbox") return configured;
  return "sandbox";
}

export function getCashfreeCheckoutMode() {
  return resolveCashfreeEnvironment() === "production" ? "production" : "sandbox";
}

function cashfreeBaseUrl() {
  return resolveCashfreeEnvironment() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function cashfreeHeaders() {
  const clientId = process.env.CASHFREE_APP_ID;
  const clientSecret = process.env.CASHFREE_SECRET_KEY;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error("Cashfree credentials are not configured"), {
      code: "CASHFREE_NOT_CONFIGURED",
    });
  }
  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
  };
}

/**
 * Create a Cashfree PG order and return payment session id.
 * @see https://docs.cashfree.com/reference/pgcreateorder
 */
export async function createCashfreePaymentSession({
  orderId,
  amount,
  customer,
  returnUrl,
  notifyUrl,
}) {
  const payload = {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: "INR",
    customer_details: {
      customer_id: String(customer.id),
      customer_name: customer.name || "Customer",
      customer_email: customer.email || "customer@paridhan.com",
      customer_phone: customer.phone || "9999999999",
    },
    order_meta: {
      return_url: returnUrl,
      notify_url: notifyUrl,
    },
  };

  const res = await fetch(`${cashfreeBaseUrl()}/orders`, {
    method: "POST",
    headers: cashfreeHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rawMessage =
      data?.message || data?.error?.message || "Cashfree order creation failed";
    const isAuthError =
      res.status === 401 ||
      /authentication|unauthorized|invalid.*credential|verify credential/i.test(
        String(rawMessage),
      );
    const message = isAuthError
      ? `Cashfree authentication failed (${resolveCashfreeEnvironment()} API). ` +
        "Use sandbox keys with CASHFREE_ENV=sandbox, or live keys with CASHFREE_ENV=production."
      : rawMessage;
    throw Object.assign(new Error(message), { code: "CASHFREE_API_ERROR", data });
  }

  if (!data.payment_session_id) {
    throw Object.assign(new Error("Cashfree did not return a payment session"), {
      code: "CASHFREE_API_ERROR",
      data,
    });
  }

  return {
    paymentSessionId: data.payment_session_id,
    cashfreeOrderId: data.order_id || orderId,
    cfOrderId: data.cf_order_id,
  };
}

/** Fetch order payment status from Cashfree. */
export async function fetchCashfreeOrder(cashfreeOrderId) {
  const res = await fetch(`${cashfreeBaseUrl()}/orders/${cashfreeOrderId}`, {
    method: "GET",
    headers: cashfreeHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.message || data?.error?.message || "Cashfree order fetch failed";
    throw Object.assign(new Error(message), { code: "CASHFREE_API_ERROR", data });
  }
  return data;
}

export function mapCashfreePaymentStatus(orderStatus) {
  const status = String(orderStatus || "").toUpperCase();
  if (status === "PAID") return "paid";
  if (status === "ACTIVE" || status === "PENDING") return "pending";
  if (
    ["EXPIRED", "TERMINATED", "CANCELLED", "FAILED", "VOID", "USER_DROPPED"].includes(
      status,
    )
  ) {
    return "failed";
  }
  if (!status) return "pending";
  return "pending";
}
