import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { PayoutController } from '../controllers/payout.controller.js';

const router = Router();

// All payout routes require authentication
router.use(requireAuth);

// Provider Margin & Settlement Routes
router.get('/provider/margins', requireRole('print_provider', 'admin', 'portal_admin'), PayoutController.getProviderMargins);
router.put('/provider/margins', requireRole('print_provider', 'admin', 'portal_admin'), PayoutController.updateProviderMargins);
router.get('/provider/requests', requireRole('print_provider', 'admin', 'portal_admin'), PayoutController.getProviderPayoutRequests);
router.post('/provider/requests/:id/settle', requireRole('print_provider', 'admin', 'portal_admin'), PayoutController.settlePayoutRequest);
router.post('/provider/requests/:id/reject', requireRole('print_provider', 'admin', 'portal_admin'), PayoutController.rejectPayoutRequest);
router.get('/provider/ledger', requireRole('print_provider', 'admin', 'portal_admin'), PayoutController.getProviderLedger);

// Designer Royalty & Payout Routes
router.get('/designer/profile', requireRole('designer', 'supplier', 'admin', 'portal_admin'), PayoutController.getDesignerPayoutProfile);
router.put('/designer/profile', requireRole('designer', 'supplier', 'admin', 'portal_admin'), PayoutController.updateDesignerPayoutProfile);
router.get('/designer/summary', requireRole('designer', 'supplier', 'admin', 'portal_admin'), PayoutController.getDesignerPayoutSummary);
router.post('/designer/request', requireRole('designer', 'supplier', 'admin', 'portal_admin'), PayoutController.requestPayout);
router.get('/designer/ledger', requireRole('designer', 'supplier', 'admin', 'portal_admin'), PayoutController.getDesignerLedger);

export default router;
