import express from "express";
import { listPublicCategories } from "../../controllers/public/categoryController.js";
import { submitContactMessage } from "../../controllers/public/contactController.js";
import { getPublicStorefrontMode } from "../../controllers/public/storefrontController.js";
import {
  getAllProducts,
  getHeroSlides,
  getSingleProduct,
} from "../../controllers/products/productController.js";

const router = express.Router();

router.get("/storefront-mode", getPublicStorefrontMode);

router.post("/contact", submitContactMessage);
router.get("/categories", listPublicCategories);
router.get("/hero", getHeroSlides);
router.get("/products", getAllProducts);
router.get("/products/single/:slug", getSingleProduct);

export default router;
