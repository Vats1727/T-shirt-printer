import { Router } from 'express';
import authRoutes from './auth.routes.js';
import portalRoutes from './portal.routes.js';
import designRoutes from './design.routes.js';
import productRoutes from './product.routes.js';
import supplierRoutes from './supplier.routes.js';
import assetRoutes from './asset.routes.js';
import customerRoutes from './customer.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import userController from '../controllers/user.controller.js';
import supplierController from '../controllers/supplier.controller.js';
import portalController from '../controllers/portal.controller.js';
import { pool } from '../config/database.js';

const router = Router();

// Modular Sub-routers
router.use('/auth', authRoutes);
router.use('/portal', portalRoutes);
router.use('/designs', designRoutes);
router.use('/admin', productRoutes);
router.use('/supplier', supplierRoutes);
router.use('/assets', assetRoutes);
router.use('/customer', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);

// Public Financial & Pricing Governance Rules
router.get('/settings/financial', portalController.getPublicFinancialSettings);

// Public Providers & Storefront
router.get('/public/providers', userController.getPublicProviders);
router.get('/store/:supplierId', supplierController.getStoreFront);
router.get('/listing/:slug', supplierController.getListingBySlugJson);
router.get('/listing/id/:id', supplierController.getListingByIdJson);

// Diagnostics / Health
router.get('/_test', (_req, res) => res.json({ ok: true, time: Date.now() }));
router.get('/storage-type', (_req, res) => res.json({ type: pool ? 'postgres' : 'json' }));

export default router;
