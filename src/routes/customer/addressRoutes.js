import express from "express";
import { addAddress, deleteAddress, getMyAddresses, setDefaultAddress, updateAddress } from "../../controllers/profile/addressController.js";

const router = express.Router();

router.get("/", getMyAddresses);
router.post("/", addAddress);
router.put("/:slug", updateAddress);
router.delete("/:slug", deleteAddress);
router.patch("/:slug/default", setDefaultAddress);

export default router;
