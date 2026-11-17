import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ProviderGatewayController } from '../controllers/providerGateway.controller.js';

const router = Router();

// Gated to print_provider, admin, and portal_admin
router.use(requireAuth);
router.use(requireRole('print_provider'));

// Get current gateway configuration status
router.get('/status', ProviderGatewayController.getGatewayStatus);

// Configure and verify Razorpay credentials with live handshake ping
router.post('/configure', ProviderGatewayController.configureGateway);

// Run on-demand test ping
router.post('/test-ping', ProviderGatewayController.testGatewayPing);

// Disconnect / reset gateway
router.post('/disconnect', ProviderGatewayController.disconnectGateway);

export default router;

