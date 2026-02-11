import express from "express";
import { getAllProducts, getSingleProduct } from "../../controllers/products/productController.js";

const router = express.Router();


router.get("/products", getAllProducts);
router.get("/products/single/:productId", getSingleProduct);

export default router;
