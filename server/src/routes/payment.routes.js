import { Router } from 'express';
import paymentController from '../controllers/payment.controller.js';
import { authenticateOptional } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/config', paymentController.getConfig);
router.post('/razorpay/create-order', paymentController.createCheckoutOrder);
router.post('/razorpay/create-attempt', authenticateOptional, paymentController.createPaymentAttempt);
router.post('/razorpay/verify', authenticateOptional, paymentController.verifyPayment);
router.post('/refund', authenticateOptional, paymentController.createRefund);

export default router;

