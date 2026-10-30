import { Router } from 'express';
import supplierController from '../controllers/supplier.controller.js';
import userController from '../controllers/user.controller.js';
import orderController from '../controllers/order.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('designer'));

// Catalog & Saved Designs
router.get('/catalog', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=5');
  next();
}, supplierController.getCatalog);

router.get('/products/:id', supplierController.getProduct);
router.get('/products/:id/purchase-status', orderController.getDesignerProductPurchaseStatus);
router.post('/orders/purchase-product', orderController.createDesignerPurchaseRequest);

router.get('/saved-designs', supplierController.listSavedDesigns);

// Orders
router.get('/orders', orderController.listSupplierOrders);
router.get('/orders/:id', orderController.getSupplierOrder);
router.post('/order', orderController.placeOrder);

// Providers
router.get('/providers', userController.getPublicProviders);

// Profile
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);

// Listings
router.get('/listings', supplierController.listListings);
router.post('/listings', supplierController.createListing);
router.patch('/listings/:id/status', supplierController.updateListingStatus);
router.delete('/listings/:id', supplierController.deleteListing);

// Store Settings
router.get('/store-settings', userController.getStoreSettings);
router.patch('/store-settings', userController.updateStoreSettings);

export default router;
