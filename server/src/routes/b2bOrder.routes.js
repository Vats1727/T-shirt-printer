import { Router } from 'express';
import b2bOrderController from '../controllers/b2bOrder.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Live quotation calculation (open to authenticated designers, providers, portal admins)
router.post('/quote', requireAuth, b2bOrderController.getB2BQuote);

// Designer ordering & Razorpay payment verification
router.post('/checkout', requireAuth, requireRole('designer', 'supplier'), b2bOrderController.checkoutB2BOrder);
router.post('/verify-payment', requireAuth, requireRole('designer', 'supplier'), b2bOrderController.verifyB2BPayment);
router.get('/designer', requireAuth, requireRole('designer', 'supplier'), b2bOrderController.listDesignerB2BOrders);

// Print Provider B2B Production Queue
router.get('/provider', requireAuth, requireRole('print_provider', 'admin'), b2bOrderController.listProviderB2BOrders);
router.patch('/:id/status', requireAuth, b2bOrderController.updateB2BOrderStatus);

// Portal Admin B2B Oversight
router.get('/admin', requireAuth, requireRole('portal_admin'), b2bOrderController.listAdminB2BOrders);

export default router;

