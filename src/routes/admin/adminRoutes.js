import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { authorizeRoles } from "../../middlewares/roleMiddleware.js";
import {
  createCategory,
  deleteCategory,
  getCategoryAdmin,
  listCategoriesAdmin,
  updateCategory,
} from "../../controllers/admin/adminCategoriesController.js";
import { getCustomer, listCustomers } from "../../controllers/admin/adminCustomersController.js";
import { getOrder, listOrders, patchOrder } from "../../controllers/admin/adminOrdersController.js";
import { getAdminStats } from "../../controllers/admin/adminStatsController.js";
import {
  createSeller,
  getSeller,
  listSellers,
  setSellerPassword,
  softDeleteSeller,
  updateSeller,
} from "../../controllers/admin/adminSellersController.js";
import { getAdminStorefrontMode, patchAdminStorefrontMode } from "../../controllers/admin/adminStorefrontController.js";
import {
  getAdminProductFieldOptions,
  patchAdminProductFieldOptions,
} from "../../controllers/admin/adminProductFieldOptionsController.js";
import { postDeleteFile, postUploadAuth } from "../../controllers/imagekit/imagekitController.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router.get("/site/storefront-mode", getAdminStorefrontMode);
router.patch("/site/storefront-mode", patchAdminStorefrontMode);

router.get("/product-field-options", getAdminProductFieldOptions);
router.patch("/product-field-options", patchAdminProductFieldOptions);

router.get("/stats", getAdminStats);

router.post("/imagekit/upload-auth", postUploadAuth);
router.post("/imagekit/delete-file", postDeleteFile);

router.get("/categories", listCategoriesAdmin);
router.post("/categories", createCategory);
router.get("/categories/:id", getCategoryAdmin);
router.patch("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

router.get("/sellers", listSellers);
router.post("/sellers", createSeller);
router.get("/sellers/:id", getSeller);
router.patch("/sellers/:id", updateSeller);
router.delete("/sellers/:id", softDeleteSeller);
router.patch("/sellers/:id/password", setSellerPassword);

router.get("/customers", listCustomers);
router.get("/customers/:id", getCustomer);

router.get("/orders", listOrders);
router.get("/orders/:id", getOrder);
router.patch("/orders/:id", patchOrder);

export default router;
