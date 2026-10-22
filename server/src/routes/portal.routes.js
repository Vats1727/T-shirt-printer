import { Router } from 'express';
import portalController from '../controllers/portal.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/providers', requireAuth, requireRole('portal_admin'), portalController.listProviders);
router.patch('/providers/:id', requireAuth, requireRole('portal_admin'), portalController.updateProviderStatus);

export default router;
