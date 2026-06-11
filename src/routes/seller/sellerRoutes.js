import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { authorizeRoles } from "../../middlewares/roleMiddleware.js";
import {
  createSellerProduct,
  getSellerProduct,
  listSellerProducts,
  softDeleteSellerProduct,
  updateSellerProduct,
} from "../../controllers/seller/sellerProductsController.js";
import {
  getSellerOrder,
  listSellerOrders,
  patchSellerOrder,
} from "../../controllers/seller/sellerOrdersController.js";
import { getSellerStats } from "../../controllers/seller/sellerStatsController.js";
import { getSellerProductFieldOptions } from "../../controllers/seller/sellerProductFieldOptionsController.js";
import { postDeleteFile, postUploadAuth } from "../../controllers/imagekit/imagekitController.js";

const router = express.Router();

router.use(protect, authorizeRoles("seller"));

router.get("/stats", getSellerStats);

router.get("/product-field-options", getSellerProductFieldOptions);

router.post("/imagekit/upload-auth", postUploadAuth);
router.post("/imagekit/delete-file", postDeleteFile);

router.get("/products", listSellerProducts);
router.post("/products", createSellerProduct);
router.get("/products/:id", getSellerProduct);
router.patch("/products/:id", updateSellerProduct);
router.delete("/products/:id", softDeleteSellerProduct);

router.get("/orders", listSellerOrders);
router.get("/orders/:id", getSellerOrder);
router.patch("/orders/:id", patchSellerOrder);

export default router;
