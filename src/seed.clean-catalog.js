/**
 * Client handoff prep — keeps categories & storefront settings.
 * Removes products, orders, carts, all customers, and all old accounts.
 * Creates one fresh admin + one seller "Paridhan Emporium".
 *
 *   npm run seed:clean
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

import AuthSession from "./models/AuthSession.js";
import Cart from "./models/Cart.js";
import Category from "./models/Category.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import StorefrontSettings from "./models/StorefrontSettings.js";
import User from "./models/User.js";

dotenv.config();

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "123456";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@paridhanemporium.com";
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Platform Admin";
const SEED_SELLER_EMAIL = process.env.SEED_SELLER_EMAIL || "seller@paridhanemporium.com";
const SELLER_DISPLAY_NAME = "Paridhan Emporium";

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

const cleanForClient = async () => {
  try {
    await connectDB();

    const [productResult, orderResult, cartResult, userResult, sessionResult, categoryCount] =
      await Promise.all([
        Product.deleteMany({}),
        Order.deleteMany({}),
        Cart.deleteMany({}),
        User.deleteMany({}),
        AuthSession.deleteMany({}),
        Category.countDocuments(),
      ]);

    let settings = await StorefrontSettings.findOne();
    if (!settings) {
      settings = await StorefrontSettings.create({ mode: "live" });
    }

    const admin = await User.create({
      name: SEED_ADMIN_NAME,
      email: SEED_ADMIN_EMAIL,
      password: DEFAULT_PASSWORD,
      role: "admin",
      roles: ["admin"],
    });

    const seller = await User.create({
      name: SELLER_DISPLAY_NAME,
      email: SEED_SELLER_EMAIL,
      password: DEFAULT_PASSWORD,
      role: "seller",
      roles: ["seller"],
    });

    console.log("");
    console.log("✅ Client prep complete.");
    console.log("");
    console.log("Removed:");
    console.log(`  Products:  ${productResult.deletedCount}`);
    console.log(`  Orders:    ${orderResult.deletedCount}`);
    console.log(`  Carts:     ${cartResult.deletedCount}`);
    console.log(`  Users:     ${userResult.deletedCount} (all customers + old accounts)`);
    console.log(`  Sessions:  ${sessionResult.deletedCount}`);
    console.log("");
    console.log("Kept:");
    console.log(`  Categories:      ${categoryCount}`);
    console.log(`  Storefront mode: ${settings.mode}`);
    console.log("");
    if (DEFAULT_PASSWORD === "123456" && !process.env.SEED_PASSWORD) {
      console.log("⚠️  Using default password 123456 — set SEED_PASSWORD before production.");
      console.log("");
    }
    console.log("═══ Platform admin ═══");
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("");
    console.log("═══ Seller — Paridhan Emporium ═══");
    console.log(`  Email:    ${seller.email}`);
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

cleanForClient();
