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

// Portal Admin B2B Wholesale Financial Governance
router.get('/b2b-financial-settings', requireAuth, requireRole('portal_admin'), portalController.getB2BFinancialSettings);
router.put('/b2b-financial-settings', requireAuth, requireRole('portal_admin'), portalController.updateB2BFinancialSettings);
router.get('/b2b-financial-settings/public', portalController.getPublicB2BFinancialSettings);

// Portal Admin Orders & Revenue Oversight
router.get('/orders', requireAuth, requireRole('portal_admin'), orderController.listAdminOrders);

// Partner Financial Ledger Reports (Print Providers & Designers)
router.get('/ledger/providers', requireAuth, requireRole('portal_admin'), portalController.getProviderLedger);
router.get('/ledger/designers', requireAuth, requireRole('portal_admin'), portalController.getDesignerLedger);
router.get('/ledger/statement/:id', requireAuth, requireRole('portal_admin'), portalController.getPartnerStatement);
router.get('/ledger/export/pdf', requireAuth, requireRole('portal_admin'), portalController.exportLedgerPdf);
router.get('/ledger/export/excel', requireAuth, requireRole('portal_admin'), portalController.exportLedgerExcel);

export default router;
