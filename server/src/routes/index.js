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
import b2bOrderRoutes from './b2bOrder.routes.js';
import userController from '../controllers/user.controller.js';
import supplierController from '../controllers/supplier.controller.js';
import portalController from '../controllers/portal.controller.js';
import { pool } from '../config/database.js';

export const API_PREFIX = '/t-shirt-printer/api/v1';

const router = Router();

// Modular Sub-routers
router.use(`${API_PREFIX}/auth`, authRoutes);
router.use(`${API_PREFIX}/portal`, portalRoutes);
router.use(`${API_PREFIX}/designs`, designRoutes);
router.use(`${API_PREFIX}/admin`, productRoutes);
router.use(`${API_PREFIX}/supplier`, supplierRoutes);
router.use(`${API_PREFIX}/assets`, assetRoutes);
router.use(`${API_PREFIX}/customer`, customerRoutes);
router.use(`${API_PREFIX}/orders`, orderRoutes);
router.use(`${API_PREFIX}/payments`, paymentRoutes);
router.use(`${API_PREFIX}/b2b-orders`, b2bOrderRoutes);

// Public Financial & Pricing Governance Rules
router.get(`${API_PREFIX}/settings/financial`, portalController.getPublicFinancialSettings);
router.get(`${API_PREFIX}/settings/b2b-financial`, portalController.getPublicB2BFinancialSettings);

// Public Providers & Storefront
router.get(`${API_PREFIX}/public/providers`, userController.getPublicProviders);
router.get(`${API_PREFIX}/store/:supplierId`, supplierController.getStoreFront);
router.get(`${API_PREFIX}/listing/:slug`, supplierController.getListingBySlugJson);
router.get(`${API_PREFIX}/listing/id/:id`, supplierController.getListingByIdJson);

// Diagnostics / Health
router.get(`${API_PREFIX}/healthz`, (_req, res) => res.status(200).send('ok'));
router.get(`${API_PREFIX}/ready`, (_req, res) => res.status(200).json({ ready: true }));
router.get(`${API_PREFIX}/_test`, (_req, res) => res.json({ ok: true, time: Date.now() }));
router.get(`${API_PREFIX}/storage-type`, (_req, res) => res.json({ type: pool ? 'postgres' : 'json' }));

export default router;
