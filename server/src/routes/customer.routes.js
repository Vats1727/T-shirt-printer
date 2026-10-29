import { Router } from 'express';
import customerController from '../controllers/customer.controller.js';
import orderController from '../controllers/order.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Storefront directory endpoints for customers
router.get('/stores', customerController.listStores);
router.get('/stores/:storeId', customerController.getStore);

// Customer Orders & Tracking
router.get('/orders', authenticateToken, requireRole('customer', 'admin'), orderController.listCustomerOrders);
router.get('/orders/:id', authenticateToken, requireRole('customer', 'admin'), orderController.getCustomerOrder);

export default router;

