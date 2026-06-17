import express from "express";
import addressRoutes from './addressRoutes.js';
import cartRoutes from './cartRoutes.js';
import orderRoutes from './orderRoutes.js';
import returnRoutes from './returnRoutes.js';

const router = express.Router();

router.use('/cart', cartRoutes);
router.use('/address', addressRoutes);
router.use('/order', orderRoutes);
router.use('/returns', returnRoutes);

export default router;
