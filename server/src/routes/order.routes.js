import { Router } from 'express';
import orderController from '../controllers/order.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// Public / Guest checkout & order creation
router.post('/', (req, res, next) => {
  // Try authenticating if token is present, but allow guest checkout if not
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, () => orderController.createCustomerOrder(req, res, next));
  }
  return orderController.createCustomerOrder(req, res, next);
});

// Public order tracking by order number (e.g. ORD-20261029-XXXX)
router.get('/track/:orderNumber', orderController.trackOrderByNumber);

// Get order by ID (requires auth)
router.get('/:id', authenticateToken, orderController.getCustomerOrder);

export default router;

