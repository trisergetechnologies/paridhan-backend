import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_GATEWAY_URL || "http://127.0.0.1:4601/api/v1";

const parseCookies = (headers) => {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((entry) => entry.split(";")[0]).join("; ");
};

const postJson = async (path, body, cookie = "") => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json, cookie: parseCookies(res.headers) || cookie };
};

const getJson = async (path, cookie = "") => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
  });
  const json = await res.json();
  return { res, json };
};

const run = async () => {
  const sellerCreds = { email: "seller@paridhan.com", password: "123456" };

  const customerLogin = await postJson("/auth/login", {
    ...sellerCreds,
    requestedRole: "customer",
  });
  assert.equal(customerLogin.res.status, 200);
  assert.equal(customerLogin.json.success, true);
  assert.equal(customerLogin.json.data.user.activeRole, "customer");
  assert.ok(customerLogin.json.data.user.roles.includes("seller"));

  const sellerLogin = await postJson("/auth/login", {
    ...sellerCreds,
    requestedRole: "seller",
  });
  assert.equal(sellerLogin.res.status, 200);
  assert.equal(sellerLogin.json.success, true);
  assert.equal(sellerLogin.json.data.user.activeRole, "seller");

  const sellerCart = await getJson("/customer/cart", sellerLogin.cookie);
  assert.equal(sellerCart.res.status, 403);
  assert.equal(sellerCart.json.success, false);

  const customerCart = await getJson("/customer/cart", customerLogin.cookie);
  assert.equal(customerCart.res.status, 200);
  assert.equal(customerCart.json.success, true);
  assert.ok(typeof customerCart.json.data.taxAmount === "number");
  assert.ok(typeof customerCart.json.data.deliveryCharge === "number");
  assert.ok(typeof customerCart.json.data.grandTotal === "number");

  console.log("integration assertions passed");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
