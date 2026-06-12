import express from "express";
import { listPublicCategories } from "../../controllers/public/categoryController.js";
import { submitContactMessage } from "../../controllers/public/contactController.js";
import { getPublicStorefrontMode } from "../../controllers/public/storefrontController.js";
import { cashfreeWebhook } from "../../controllers/payments/paymentController.js";
import { lookupPincode } from "../../controllers/public/pincodeController.js";
import {
  getAllProducts,
  getSingleProduct,
} from "../../controllers/products/productController.js";
import { getHeroSlides } from "../../controllers/public/heroController.js";

const router = express.Router();

router.get("/storefront-mode", getPublicStorefrontMode);

router.post("/contact", submitContactMessage);
router.get("/categories", listPublicCategories);
router.get("/hero", getHeroSlides);
router.get("/products", getAllProducts);
router.get("/products/single/:slug", getSingleProduct);

router.post("/payments/cashfree/webhook", cashfreeWebhook);
router.get("/pincode/:pin", lookupPincode);

export default router;
