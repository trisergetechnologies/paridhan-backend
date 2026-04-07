import express from "express";
import { submitContactMessage } from "../../controllers/public/contactController.js";
import {
  getAllProducts,
  getHeroSlides,
  getSingleProduct,
} from "../../controllers/products/productController.js";

const router = express.Router();

router.post("/contact", submitContactMessage);
router.get("/hero", getHeroSlides);
router.get("/products", getAllProducts);
router.get("/products/single/:slug", getSingleProduct);

export default router;
