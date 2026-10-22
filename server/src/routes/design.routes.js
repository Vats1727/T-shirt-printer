import { Router } from 'express';
import designController from '../controllers/design.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/', requireAuth, designController.createDesign);
router.get('/', requireAuth, designController.listDesigns);
router.get('/:id', requireAuth, designController.getDesign);
router.get('/:id/versions', requireAuth, designController.listDesignVersions);
router.put('/:id', requireAuth, designController.updateDesign);
router.delete('/:id', requireAuth, designController.deleteDesign);

export default router;
