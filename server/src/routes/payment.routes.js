import { Router } from 'express';
import paymentController from '../controllers/payment.controller.js';

const router = Router();

router.get('/config', paymentController.getConfig);
router.post('/razorpay/create-order', paymentController.createCheckoutOrder);
router.post('/razorpay/verify', paymentController.verifyPayment);

export default router;

