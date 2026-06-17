import express from "express";
import {
  createReturnRequest,
  getMyReturns,
  getReturnById,
} from "../../controllers/returns/returnController.js";

const router = express.Router();

router.get("/", getMyReturns);
router.get("/:id", getReturnById);

export default router;
