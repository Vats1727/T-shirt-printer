import { Router } from 'express';
import assetController from '../controllers/asset.controller.js';
import designController from '../controllers/design.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/', assetController.uploadAsset);
router.post('/delete-file', assetController.deleteFile);
router.delete('/delete-file', assetController.deleteFile);
router.get('/:id', designController.getAsset);
router.delete('/:id', requireAuth, assetController.deleteAsset);

export default router;
