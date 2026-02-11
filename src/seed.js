import dotenv from "dotenv";
import mongoose from "mongoose";

import Cart from "./models/Cart.js";
import Category from "./models/Category.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import User from "./models/User.js";

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

// ================= PASSWORD =================
const hashedPassword = "123456"

// ================= SEED DATA =================
const seedData = async () => {
  try {
    await connectDB();

    // ===== CLEAN DB =====
    await Promise.all([
      User.deleteMany(),
      Category.deleteMany(),
      Product.deleteMany(),
      Cart.deleteMany(),
      Order.deleteMany()
    ]);

    console.log("Database cleaned");

    // ===== USERS =====
    const admin = await User.create({
      name: "Admin User",
      email: "admin@paridhan.com",
      password: hashedPassword,
      role: "admin"
    });

    const seller = await User.create({
      name: "Seller One",
      email: "seller@paridhan.com",
      password: hashedPassword,
      role: "seller"
    });

    const customer = await User.create({
      name: "Customer One",
      email: "customer@paridhan.com",
      password: hashedPassword,
      role: "customer",
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
        }
      ]
    });

    console.log("Users seeded");

    // ===== CATEGORIES =====
    const categories = await Category.insertMany([
      { name: "Banarasi Saree", slug: "banarasi-saree" },
      { name: "Wedding Wear", slug: "wedding-wear" },
      { name: "New Arrivals", slug: "new-arrivals" }
    ]);

    console.log("Categories seeded");

    // ===== PRODUCTS =====
    const products = await Product.insertMany([
      {
        name: "Royal Banarasi Silk Saree",
        slug: "royal-banarasi-silk-saree",
        description: "Pure silk Banarasi saree for weddings.",
        price: 2499,
        mrp: 3499,
        stock: 20,
        fabric: "Silk",
        color: "Red",
        images: [
          { url: "https://dummyimage.com/600x600", alt: "Banarasi Saree" }
        ],
        categories: [categories[0]._id, categories[1]._id],
        seller: seller._id,
        isFeatured: true
      },
      {
        name: "Elegant Party Wear Saree",
        slug: "elegant-party-wear-saree",
        description: "Lightweight party wear saree.",
        price: 1599,
        mrp: 2199,
        stock: 15,
        fabric: "Georgette",
        color: "Blue",
        images: [
          { url: "https://dummyimage.com/600x600", alt: "Party Saree" }
        ],
        categories: [categories[2]._id],
        seller: seller._id
      }
    ]);

    console.log("Products seeded");

    // ===== CART =====
    const cart = await Cart.create({
      user: customer._id,
      items: [
        {
          product: products[0]._id,
          seller: seller._id,
          name: products[0].name,
          image: products[0].images[0].url,
          price: products[0].price,
          mrp: products[0].mrp,
          quantity: 1,
          subtotal: products[0].price
        }
      ],
      itemsTotal: products[0].price,
      taxAmount: Math.round(products[0].price * 0.05),
      deliveryCharge: 80,
      grandTotal:
        products[0].price +
        Math.round(products[0].price * 0.05) +
        80
    });

    console.log("Cart seeded");

    // ===== ORDER =====
    await Order.create({
      user: customer._id,
      orderNumber: `ORD-${Date.now()}`,
      items: [
        {
          productId: products[0]._id,
          name: products[0].name,
          image: products[0].images[0].url,
          price: products[0].price,
          mrp: products[0].mrp,
          quantity: 1,
          subtotal: products[0].price,
          seller: seller._id
        }
      ],
      shippingAddress: {
        fullName: "Customer One",
        phone: "9999999999",
        street: "123 Silk Street",
        city: "Varanasi",
        state: "Uttar Pradesh",
        postalCode: "221001",
        country: "India"
      },
      itemsTotal: products[0].price,
      taxAmount: Math.round(products[0].price * 0.05),
      deliveryCharge: 80,
      grandTotal:
        products[0].price +
        Math.round(products[0].price * 0.05) +
        80,
      paymentMethod: "cod",
      paymentStatus: "pending"
    });

    console.log("Orders seeded");

    console.log("✅ Seeding completed successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

// ================= DESTROY =================
if (process.argv[2] === "--destroy") {
  connectDB().then(async () => {
    await Promise.all([
      User.deleteMany(),
      Category.deleteMany(),
      Product.deleteMany(),
      Cart.deleteMany(),
      Order.deleteMany()
    ]);
    console.log("❌ All data destroyed");
    process.exit();
  });
} else {
  seedData();
}
