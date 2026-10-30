import { Router } from 'express';
import productController from '../controllers/product.controller.js';
import userController from '../controllers/user.controller.js';
import orderController from '../controllers/order.controller.js';
import supplierController from '../controllers/supplier.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Admin / Print Provider routes
router.use(requireAuth);
router.use(requireRole('print_provider'));

// Colors
router.get('/colors', productController.listColors);
router.post('/colors', productController.createColor);
router.delete('/colors/:id', productController.deleteColor);

// Sizes
router.get('/sizes', productController.listSizes);
router.post('/sizes', productController.createSize);
router.delete('/sizes/:id', productController.deleteSize);

// Inventory
router.get('/inventory', productController.listInventory);
router.post('/inventory', productController.upsertInventory);

// Size Chart
router.get('/size-chart', productController.listSizeChart);
router.post('/size-chart', productController.upsertSizeChart);
router.delete('/size-chart', productController.deleteSizeChart);

// Products
router.get('/products', productController.listProducts);
router.post('/products', productController.createProduct);
router.get('/products/:id', productController.getProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Designers & Profile
router.get('/designers', userController.listDesigners);
router.get('/designer-designs', productController.listProviderDesigns);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);

// Admin Orders
router.get('/orders', orderController.listAdminOrders);
router.get('/orders/:id', orderController.getAdminOrder);
router.patch('/orders/:id/status', orderController.updateOrderStatus);

// Store Listings & Customizer
router.get('/listings', supplierController.listListings);
router.post('/listings', supplierController.createListing);
router.patch('/listings/:id/status', supplierController.updateListingStatus);
router.delete('/listings/:id', supplierController.deleteListing);
router.get('/store-settings', userController.getStoreSettings);
router.patch('/store-settings', userController.updateStoreSettings);

export default router;
