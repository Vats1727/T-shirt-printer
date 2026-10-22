import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/change-password', requireAuth, authController.changePassword);

export default router;
