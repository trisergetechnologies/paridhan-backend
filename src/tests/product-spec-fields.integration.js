import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_API_URL || "http://127.0.0.1:4600/api/v1";

const dashboardHeaders = {
  "Content-Type": "application/json",
  "X-Paridhan-Client": "dashboard",
};

async function postJson(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...dashboardHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

async function patchJson(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      ...dashboardHeaders,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

async function getJson(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...dashboardHeaders,
      Authorization: `Bearer ${token}`,
    },
  });
  return { res, json: await res.json() };
}

const run = async () => {
  const sellerLogin = await postJson("/auth/login", {
    email: "seller@paridhan.com",
    password: "123456",
    requestedRole: "seller",
  });
  assert.equal(sellerLogin.json.success, true, sellerLogin.json.message || "seller login failed");
  const token = sellerLogin.json.data.accessToken;

  const cats = await getJson("/seller/products?limit=1", token);
  assert.equal(cats.json.success, true);

  const adminLogin = await postJson("/auth/login", {
    email: "admin@paridhan.com",
    password: "123456",
    requestedRole: "admin",
  });
  assert.equal(adminLogin.json.success, true);
  const adminToken = adminLogin.json.data.accessToken;

  const categoryList = await getJson("/admin/categories?limit=1", adminToken);
  assert.equal(categoryList.json.success, true);
  const categoryId = categoryList.json.data.items[0]?._id;
  assert.ok(categoryId, "need at least one category for test");

  const create = await postJson(
    "/seller/products",
    {
      name: `Spec fields test ${Date.now()}`,
      description: "Integration test product for spec fields",
      price: 1999,
      stock: 5,
      categories: [categoryId],
      fabric: "Kanjivaram Silk",
      color: "Mustard Yellow",
      length: "5.5m",
      occasion: "Wedding",
      pattern: "Banarasi jacquard",
      fit: "Ready to drape",
      texture: "Soft, premium finish",
      washCare: "Dry clean recommended",
      ironing: "Low heat on reverse",
      storage: "Fold in muslin cloth",
      images: [],
      variants: [],
    },
    token,
  );
  assert.equal(create.json.success, true, create.json.message || "create failed");
  const productId = create.json.data._id;

  const get1 = await getJson(`/seller/products/${productId}`, token);
  assert.equal(get1.json.success, true);
  const p1 = get1.json.data;
  assert.equal(p1.fabric, "Kanjivaram Silk");
  assert.equal(p1.color, "Mustard Yellow");
  assert.equal(p1.occasion, "Wedding");
  assert.equal(p1.pattern, "Banarasi jacquard");
  assert.equal(p1.fit, "Ready to drape");
  assert.equal(p1.texture, "Soft, premium finish");
  assert.equal(p1.washCare, "Dry clean recommended");
  assert.equal(p1.ironing, "Low heat on reverse");
  assert.equal(p1.storage, "Fold in muslin cloth");

  const patch = await patchJson(
    `/seller/products/${productId}`,
    {
      name: p1.name,
      description: p1.description,
      price: p1.price,
      stock: p1.stock,
      categories: [categoryId],
      isActive: true,
      images: [],
      variants: [],
      fabric: "Georgette",
      color: "Peach",
      length: "6.3m",
      occasion: "Festive",
      pattern: "Digital print",
      fit: "Lightweight drape",
      texture: "Lightweight sheer",
      washCare: "Hand wash cold",
      ironing: "Steam iron on low",
      storage: "Store in breathable bag",
      blouseIncluded: true,
      shippingUseDefault: true,
      discountPercentage: null,
      gstPercent: null,
      hsnCode: null,
    },
    token,
  );
  assert.equal(patch.json.success, true, patch.json.message || "patch failed");

  const get2 = await getJson(`/seller/products/${productId}`, token);
  assert.equal(get2.json.success, true);
  const p2 = get2.json.data;
  assert.equal(p2.fabric, "Georgette");
  assert.equal(p2.color, "Peach");
  assert.equal(p2.length, "6.3m");
  assert.equal(p2.occasion, "Festive");
  assert.equal(p2.pattern, "Digital print");
  assert.equal(p2.fit, "Lightweight drape");
  assert.equal(p2.texture, "Lightweight sheer");
  assert.equal(p2.washCare, "Hand wash cold");
  assert.equal(p2.ironing, "Steam iron on low");
  assert.equal(p2.storage, "Store in breathable bag");

  console.log("product spec fields integration passed");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
