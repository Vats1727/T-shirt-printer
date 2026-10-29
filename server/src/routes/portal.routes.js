import { Router } from 'express';
import portalController from '../controllers/portal.controller.js';
import orderController from '../controllers/order.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/providers', requireAuth, requireRole('portal_admin'), portalController.listProviders);
router.patch('/providers/:id', requireAuth, requireRole('portal_admin'), portalController.updateProviderStatus);

// Portal Admin Global Financial Governance
router.get('/financial-settings', requireAuth, requireRole('portal_admin'), portalController.getFinancialSettings);
router.put('/financial-settings', requireAuth, requireRole('portal_admin'), portalController.updateFinancialSettings);

// Portal Admin Orders & Revenue Oversight
router.get('/orders', requireAuth, requireRole('portal_admin'), orderController.listAdminOrders);

export default router;
