import dotenv from "dotenv";
import mongoose from "mongoose";

import Cart from "./models/Cart.js";
import Category from "./models/Category.js";
import AuthSession from "./models/AuthSession.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import StorefrontSettings from "./models/StorefrontSettings.js";
import { calculateCartTotals } from "./services/pricingService.js";
import {
  effectiveImages,
  getEffectiveVariantPrice,
  variantLabel,
} from "./services/productVariantHelpers.js";

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

const DEV_PRODUCT_COUNT = Number(process.env.SEED_PRODUCT_COUNT || 300);
/** Match HERO_SLIDE_LIMIT (default 5) so GET /public/hero always has featured rows after seed. */
const HERO_FEATURED_COUNT = Math.min(Math.max(Math.floor(Number(process.env.HERO_SLIDE_LIMIT) || 5), 1), 12);
/** Shared default for all seeded users unless SEED_PASSWORD is set. */
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "123456";

/** Platform admin — use with dashboard “Platform admin” login (requestedRole: admin). */
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@paridhan.com";

/** Primary seller — use with dashboard “Seller” login (requestedRole: seller). */
const SEED_SELLER_EMAIL = process.env.SEED_SELLER_EMAIL || "seller@paridhan.com";

/** Secondary seller account (optional second storefront). */
const SEED_SELLER2_EMAIL = process.env.SEED_SELLER2_EMAIL || "seller2@paridhan.com";

const fabrics = ["Silk", "Cotton", "Georgette", "Organza", "Linen", "Chiffon"];
const colors = ["Red", "Blue", "Green", "Maroon", "Black", "Pink", "Gold", "Purple"];
const adjectives = ["Royal", "Elegant", "Classic", "Premium", "Heritage", "Graceful", "Regal", "Luxe"];
const collections = ["Banarasi", "Wedding", "Festive", "Daily Wear", "Party Wear", "Handloom"];

const baseCategories = [
  { name: "Banarasi Saree", slug: "banarasi-saree", description: "Traditional Banarasi sarees." },
  { name: "Wedding Wear", slug: "wedding-wear", description: "Premium wedding collection." },
  { name: "New Arrivals", slug: "new-arrivals", description: "Latest products." },
  { name: "Festive Collection", slug: "festive-collection", description: "For festive seasons." },
  { name: "Party Wear", slug: "party-wear", description: "Party looks for events." },
  { name: "Handloom", slug: "handloom", description: "Handloom crafted drapes." },
  { name: "Cotton Sarees", slug: "cotton-sarees", description: "Breathable everyday cottons." },
  { name: "Silk Sarees", slug: "silk-sarees", description: "Rich silk textures." }
];

const pick = (arr, i) => arr[i % arr.length];

const blouseOpts = ["Unstitched", "Ready-made", "No blouse piece"];
const borderOpts = ["Zari border", "Contrast border", "Minimal border"];

const makeProduct = ({ index, categories, sellerIds }) => {
  const adjective = pick(adjectives, index);
  const collection = pick(collections, index + 2);
  const fabric = pick(fabrics, index + 3);
  const color = pick(colors, index + 5);

  const basePrice = 900 + ((index * 37) % 3800);
  const mrp = basePrice + 400 + ((index * 13) % 1200);
  const categoryA = categories[index % categories.length]._id;
  const categoryB = categories[(index + 1) % categories.length]._id;
  const seller = sellerIds[index % sellerIds.length];

  const name = `${adjective} ${collection} Saree ${index + 1}`;
  const imageCount = 2 + (index % 4);
  const images = Array.from({ length: imageCount }, (_, i) => ({
    url: `https://picsum.photos/seed/paridhan-${index + 1}-v${i}/800/1000`,
    alt: `${name} — view ${i + 1}`,
  }));

  const variantCount = 3 + (index % 3);
  const variants = Array.from({ length: variantCount }, (_, v) => {
    const publicId = `var_seed_${index + 1}_${v}`;
    const attributes = [
      { name: "Blouse", value: blouseOpts[(index + v) % blouseOpts.length] },
      { name: "Border", value: borderOpts[(index + v * 2) % borderOpts.length] },
    ];
    const stock = 3 + ((index * 7 + v * 5) % 45);
    const withPriceBump = v === 1 && variantCount > 1;
    const variantImages =
      v % 2 === 0
        ? []
        : [
            {
              url: `https://picsum.photos/seed/var-${index + 1}-${v}-a/800/1000`,
              alt: `${name} — variant ${v + 1}`,
            },
            {
              url: `https://picsum.photos/seed/var-${index + 1}-${v}-b/800/1000`,
              alt: `${name} — variant ${v + 1} detail`,
            },
          ];

    return {
      publicId,
      attributes,
      stock,
      ...(withPriceBump ? { price: basePrice + 200, mrp: mrp + 250 } : {}),
      ...(variantImages.length ? { images: variantImages } : {}),
      isActive: true,
    };
  });

  const totalVariantStock = variants.reduce((sum, x) => sum + x.stock, 0);

  return {
    publicId: `prd_seed_${String(index + 1).padStart(6, "0")}`,
    name,
    slug: `seed-saree-${index + 1}`,
    description: `${adjective} ${collection.toLowerCase()} saree in ${fabric.toLowerCase()} fabric with ${color.toLowerCase()} tone.`,
    price: basePrice,
    mrp,
    stock: totalVariantStock,
    sku: `SKU-${String(index + 1).padStart(5, "0")}`,
    fabric,
    color,
    images,
    variants,
    categories: [categoryA, categoryB],
    seller,
    isFeatured: index < HERO_FEATURED_COUNT || index % 10 === 0,
    isActive: true
  };
};

const createCartFromProducts = (products, sellerId) => {
  const first = products[0];
  const second = products[1];
  const v1 = first.variants[0];
  const v2 = second.variants[0];
  const p1 = getEffectiveVariantPrice(v1, first);
  const p2 = getEffectiveVariantPrice(v2, second);
  const img1 = effectiveImages(first, v1)[0]?.url || "";
  const img2 = effectiveImages(second, v2)[0]?.url || "";

  const items = [
    {
      product: first._id,
      seller: sellerId,
      name: first.name,
      image: img1,
      price: p1.price,
      mrp: p1.mrp ?? first.mrp,
      quantity: 2,
      subtotal: p1.price * 2,
      variantPublicId: v1.publicId,
      variantLabel: variantLabel(v1),
    },
    {
      product: second._id,
      seller: sellerId,
      name: second.name,
      image: img2,
      price: p2.price,
      mrp: p2.mrp ?? second.mrp,
      quantity: 1,
      subtotal: p2.price,
      variantPublicId: v2.publicId,
      variantLabel: variantLabel(v2),
    }
  ];

  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const totals = calculateCartTotals(items);

  return {
    items,
    ...totals
  };
};

const createOrders = ({ customerId, sellerId, products }) => {
  const now = Date.now();
  const shippingAddress = {
    fullName: "Customer One",
    phone: "9999999999",
    street: "123 Silk Street",
    city: "Varanasi",
    state: "Uttar Pradesh",
    postalCode: "221001",
    country: "India"
  };

  return Array.from({ length: 10 }).map((_, i) => {
    const p1 = products[(i * 3) % products.length];
    const p2 = products[(i * 3 + 1) % products.length];
    const va = p1.variants[(i % p1.variants.length) || 0];
    const vb = p2.variants[(i % p2.variants.length) || 0];
    const ea = getEffectiveVariantPrice(va, p1);
    const eb = getEffectiveVariantPrice(vb, p2);
    const qa = 1 + (i % 2);

    const items = [
      {
        productId: p1._id,
        name: p1.name,
        image: effectiveImages(p1, va)[0]?.url || "",
        price: ea.price,
        mrp: ea.mrp ?? p1.mrp,
        quantity: qa,
        subtotal: ea.price * qa,
        seller: sellerId,
        variantPublicId: va.publicId,
        variantLabel: variantLabel(va),
      },
      {
        productId: p2._id,
        name: p2.name,
        image: effectiveImages(p2, vb)[0]?.url || "",
        price: eb.price,
        mrp: eb.mrp ?? p2.mrp,
        quantity: 1,
        subtotal: eb.price,
        seller: sellerId,
        variantPublicId: vb.publicId,
        variantLabel: variantLabel(vb),
      }
    ];

    const totals = calculateCartTotals(items);

    return {
      user: customerId,
      orderNumber: `ORD-${now}-${String(i + 1).padStart(3, "0")}`,
      items,
      shippingAddress,
      ...totals,
      paymentMethod: i % 3 === 0 ? "online" : "cod",
      paymentStatus: i % 3 === 0 ? "paid" : "pending",
      orderStatus: i % 4 === 0 ? "confirmed" : "placed"
    };
  });
};

const seedData = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany(),
      Category.deleteMany(),
      Product.deleteMany(),
      Cart.deleteMany(),
      Order.deleteMany(),
      AuthSession.deleteMany(),
      StorefrontSettings.deleteMany(),
    ]);

    console.log("Database cleaned");

    const admin = await User.create({
      name: "Admin User",
      email: SEED_ADMIN_EMAIL,
      password: DEFAULT_PASSWORD,
      role: "admin",
      roles: ["admin", "customer"],
    });

    const seller1 = await User.create({
      name: "Seller One",
      email: SEED_SELLER_EMAIL,
      password: DEFAULT_PASSWORD,
      role: "seller",
      roles: ["seller", "customer"],
      phone: "9000000001"
    });

    const seller2 = await User.create({
      name: "Seller Two",
      email: SEED_SELLER2_EMAIL,
      password: DEFAULT_PASSWORD,
      role: "seller",
      roles: ["seller", "customer"],
      phone: "9000000002"
    });

    const customer = await User.create({
      name: "Customer One",
      email: "customer@paridhan.com",
      password: DEFAULT_PASSWORD,
      role: "customer",
      roles: ["customer"],
      phone: "9999999999",
      addresses: [
        {
          slug: "home",
          fullName: "Customer One",
          phone: "9999999999",
          street: "123 Silk Street",
          city: "Varanasi",
          state: "Uttar Pradesh",
          postalCode: "221001",
          country: "India",
          isDefault: true
        },
        {
          slug: "office",
          fullName: "Customer One",
          phone: "9999999999",
          street: "Corporate Road 12",
          city: "Lucknow",
          state: "Uttar Pradesh",
          postalCode: "226001",
          country: "India",
          isDefault: false
        }
      ]
    });

    console.log("Users seeded", { admin: admin.email, sellers: 2, customer: customer.email });

    const categories = await Category.insertMany(baseCategories);
    console.log(`Categories seeded: ${categories.length}`);

    const productsInput = Array.from({ length: DEV_PRODUCT_COUNT }).map((_, i) =>
      makeProduct({
        index: i,
        categories,
        sellerIds: [seller1._id, seller2._id]
      })
    );

    const products = await Product.insertMany(productsInput);
    console.log(`Products seeded: ${products.length}`);

    const cartPayload = createCartFromProducts(products, seller1._id);
    await Cart.create({
      user: customer._id,
      ...cartPayload
    });
    console.log("Cart seeded");

    const ordersPayload = createOrders({
      customerId: customer._id,
      sellerId: seller1._id,
      products
    });

    await Order.insertMany(ordersPayload);
    console.log(`Orders seeded: ${ordersPayload.length}`);

    const existingSf = await StorefrontSettings.findOne();
    if (!existingSf) {
      await StorefrontSettings.create({ mode: "live" });
      console.log("Storefront settings: created (mode: live)");
    }

    console.log("✅ Seeding completed successfully");
    console.log("");
    console.log("═══ Paridhan dashboard (local dev) ═══");
    console.log("Point paridhan-dashboard-web at the API, e.g. in .env.local:");
    console.log("  NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1");
    console.log("");
    console.log("Platform admin — choose “Platform admin” on /auth:");
    console.log(`  Email:    ${SEED_ADMIN_EMAIL}`);
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("");
    console.log("Seller — choose “Seller” on /auth:");
    console.log(`  Email:    ${SEED_SELLER_EMAIL}  (or ${SEED_SELLER2_EMAIL})`);
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (process.argv[2] === "--destroy") {
  connectDB().then(async () => {
    await Promise.all([
      User.deleteMany(),
      Category.deleteMany(),
      Product.deleteMany(),
      Cart.deleteMany(),
      Order.deleteMany(),
      AuthSession.deleteMany(),
      StorefrontSettings.deleteMany(),
    ]);
    console.log("❌ All data destroyed");
    process.exit(0);
  });
} else {
  seedData();
}
