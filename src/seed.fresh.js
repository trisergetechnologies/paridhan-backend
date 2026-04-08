/**
 * Fresh platform seed — delivery / production bootstrap.
 *
 * - Wipes transactional and catalog data (same scope as full seed clean).
 * - Creates one platform admin only (no sellers, no customers, no categories/products).
 * - Ensures storefront settings (mode: live).
 *
 * Sellers: create via admin dashboard.
 * Customers: self-registration on the storefront.
 *
 * Full dev dataset (admin + sellers + customer + categories + products + cart + orders):
 *   npm run seed
 *
 * Wipe database only (no re-seed): npm run seed:destroy
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

import AuthSession from "./models/AuthSession.js";
import Cart from "./models/Cart.js";
import Category from "./models/Category.js";
import ContactMessage from "./models/ContactMessage.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import StorefrontSettings from "./models/StorefrontSettings.js";
import User from "./models/User.js";

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "123456";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@paridhan.com";

const wipeAll = async () => {
  await Promise.all([
    User.deleteMany(),
    Category.deleteMany(),
    Product.deleteMany(),
    Cart.deleteMany(),
    Order.deleteMany(),
    AuthSession.deleteMany(),
    StorefrontSettings.deleteMany(),
    ContactMessage.deleteMany(),
  ]);
};

const seedFresh = async () => {
  try {
    await connectDB();
    await wipeAll();
    console.log("Database cleaned (fresh seed).");

    const admin = await User.create({
      name: process.env.SEED_ADMIN_NAME || "Platform Admin",
      email: SEED_ADMIN_EMAIL,
      password: DEFAULT_PASSWORD,
      role: "admin",
      roles: ["admin", "customer"],
    });

    await StorefrontSettings.create({ mode: "live" });

    console.log("");
    console.log("✅ Fresh platform seed complete.");
    console.log("");
    console.log("Only the platform admin exists. Add sellers from the dashboard;");
    console.log("customers register on the customer site. Create categories before sellers add products.");
    console.log("");
    console.log("═══ Dashboard login (Platform admin) ═══");
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("");
    console.log("API base (example):");
    console.log("  NEXT_PUBLIC_API_URL=http://localhost:4601/api/v1");
    console.log("");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedFresh();
