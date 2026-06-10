const looksLocal = (value) => {
  if (!value || typeof value !== "string") return false;
  return /localhost|127\.0\.0\.1/i.test(value);
};

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const warnings = [];
  const errors = [];

  const checkUrl = (name, value, { allowLocal = false } = {}) => {
    if (!value) {
      warnings.push(`${name} is not set`);
      return;
    }
    if (!allowLocal && looksLocal(value)) {
      errors.push(`${name} still points to localhost: ${value}`);
    }
  };

  checkUrl("STOREFRONT_URL", process.env.STOREFRONT_URL);
  checkUrl("DASHBOARD_URL", process.env.DASHBOARD_URL);
  checkUrl("BACKEND_PUBLIC_URL", process.env.BACKEND_PUBLIC_URL);
  checkUrl("GOOGLE_OAUTH_CALLBACK_URL", process.env.GOOGLE_OAUTH_CALLBACK_URL);

  const cfSecret = String(process.env.CASHFREE_SECRET_KEY || "");
  const cfEnv = String(process.env.CASHFREE_ENV || "").toLowerCase();
  if (/cfsk_ma_prod|_prod_/i.test(cfSecret) && cfEnv === "sandbox") {
    errors.push(
      "CASHFREE_ENV=sandbox but production Cashfree secret detected — set CASHFREE_ENV=production",
    );
  }
  if (process.env.CASHFREE_ENV !== "production" && /cfsk_ma_prod|_prod_/i.test(cfSecret)) {
    warnings.push("Using production Cashfree keys — set CASHFREE_ENV=production");
  }

  if (
    process.env.JWT_REFRESH_SECRET === "your_super_secret_refresh_key_change_in_production" ||
    !String(process.env.JWT_REFRESH_SECRET || "").trim()
  ) {
    errors.push("JWT_REFRESH_SECRET is missing or still using the placeholder");
  }

  if (!String(process.env.CASHFREE_WEBHOOK_SECRET || "").trim()) {
    warnings.push("CASHFREE_WEBHOOK_SECRET is not set — webhooks will be rejected");
  }

  for (const msg of warnings) {
    console.warn(`[env] WARNING: ${msg}`);
  }
  for (const msg of errors) {
    console.error(`[env] ERROR: ${msg}`);
  }

  if (errors.length) {
    console.error(
      "[env] Production misconfiguration detected. Fix paridhan-backend/.env and restart.",
    );
  }
}
