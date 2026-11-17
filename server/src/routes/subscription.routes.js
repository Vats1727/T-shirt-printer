import { Router } from 'express';
import { requireAuth, authenticateOptional } from '../middleware/auth.middleware.js';
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

export default router;

