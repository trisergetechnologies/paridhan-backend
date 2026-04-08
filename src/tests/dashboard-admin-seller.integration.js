import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_API_URL || "http://127.0.0.1:4600/api/v1";

const dashboardHeaders = {
  "Content-Type": "application/json",
  "X-Paridhan-Client": "dashboard",
};

const postJson = async (path, body, extraHeaders = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...dashboardHeaders, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json };
};

const getBearer = async (path, token) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      ...dashboardHeaders,
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json();
  return { res, json };
};

const run = async () => {
  const adminLogin = await postJson("/auth/login", {
    email: "admin@paridhan.com",
    password: "123456",
    requestedRole: "admin",
  });
  assert.equal(adminLogin.res.status, 200);
  assert.equal(adminLogin.json.success, true);
  assert.ok(adminLogin.json.data.accessToken, "dashboard login should return accessToken");
  assert.ok(adminLogin.json.data.refreshToken, "dashboard login should return refreshToken");

  const adminToken = adminLogin.json.data.accessToken;

  const stats = await getBearer("/admin/stats", adminToken);
  assert.equal(stats.res.status, 200);
  assert.equal(stats.json.success, true);
  assert.ok(typeof stats.json.data.totalOrders === "number");

  const sellers = await getBearer("/admin/sellers?limit=5", adminToken);
  assert.equal(sellers.res.status, 200);
  assert.equal(sellers.json.success, true);
  assert.ok(Array.isArray(sellers.json.data.items));

  const sellerLogin = await postJson("/auth/login", {
    email: "seller@paridhan.com",
    password: "123456",
    requestedRole: "seller",
  });
  assert.equal(sellerLogin.res.status, 200);
  const sellerToken = sellerLogin.json.data.accessToken;

  const sellerStats = await getBearer("/seller/stats", sellerToken);
  assert.equal(sellerStats.res.status, 200);
  assert.equal(sellerStats.json.success, true);

  const products = await getBearer("/seller/products?limit=3", sellerToken);
  assert.equal(products.res.status, 200);
  assert.equal(products.json.success, true);

  const refresh = await postJson("/auth/refresh", {
    refreshToken: adminLogin.json.data.refreshToken,
  });
  assert.equal(refresh.res.status, 200);
  assert.equal(refresh.json.success, true);
  assert.ok(refresh.json.data.accessToken);

  console.log("dashboard integration assertions passed");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
