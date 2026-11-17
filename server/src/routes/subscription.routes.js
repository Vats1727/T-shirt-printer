import { Router } from 'express';
import { requireAuth, requireRole, authenticateOptional } from '../middleware/auth.middleware.js';
import * as subController from '../controllers/subscription.controller.js';

const router = Router();

router.get('/plans', authenticateOptional, subController.getPlans);
router.get('/my-subscription', requireAuth, subController.getMySubscription);
router.get('/my', requireAuth, subController.getMySubscription);
router.get('/me', requireAuth, subController.getMySubscription);
router.post('/checkout-order', requireAuth, subController.checkoutOrder);
router.post('/checkout', requireAuth, subController.checkoutOrder);
router.post('/verify', requireAuth, subController.verifyPayment);
router.post('/verify-payment', requireAuth, subController.verifyPayment);

// Portal Admin Subscriptions & Invoices
router.get('/portal/invoices', requireAuth, requireRole('portal_admin'), subController.portalGetInvoices);
router.get('/portal/revenue-stats', requireAuth, requireRole('portal_admin'), subController.portalGetUnifiedRevenueStats);
router.get('/portal/stats', requireAuth, requireRole('portal_admin'), subController.portalGetStats);
router.post('/portal/grant', requireAuth, requireRole('portal_admin'), subController.portalGrantTier);
router.post('/portal/suspend', requireAuth, requireRole('portal_admin'), subController.portalSuspendSubscription);
router.post('/portal/resume', requireAuth, requireRole('portal_admin'), subController.portalResumeSubscription);
router.post('/portal/extend', requireAuth, requireRole('portal_admin'), subController.portalUpdateSubscriptionExpiry);

export default router;

