import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/webhook.controller.js';
import { handlePlatformWebhook } from '../controllers/subscription.controller.js';

const router = Router();

// Phase 3: SaaS Subscription Platform Webhook (isolated ledger)
router.post('/razorpay/platform', handlePlatformWebhook);

// Phase 2: Multi-Provider Customer Order Webhooks (Merchant-of-Record ledger)
router.post('/razorpay/providers/:providerSlug', handleRazorpayWebhook);
router.post('/razorpay/:providerSlug', handleRazorpayWebhook); // Backwards-compatible alias

export default router;
