import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";
import * as designsController from "./src/controllers/designsController";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const safe = (fn: (req: any, res: any, next: any) => Promise<any>) => {
    return (req: any, res: any, next: any) =>
      Promise.resolve(fn(req, res, next)).catch(next);
  };

  // Simple in-memory cache for the designs list to reduce DB load and speed up repeated fetches.
  // Cached for short duration (1s) to keep data fresh while reducing frequent repeated queries.
  let designsCache: { ts: number; data: any } = { ts: 0, data: null };

  app.post(api.designs.create.path, safe(designsController.createDesign));

  app.get(api.designs.list.path, safe(designsController.listDesigns));

  app.get(`${api.designs.list.path}/:id`, safe(designsController.getDesign));
  app.get(`${api.designs.list.path}/:id/versions`, safe(designsController.listDesignVersions));

  app.put(`${api.designs.list.path}/:id`, safe(designsController.updateDesign));

  app.delete(`${api.designs.list.path}/:id`, safe(designsController.deleteDesign));

  // Serve stored asset files by id
  app.get('/api/assets/:id', safe(designsController.getAsset));

  // Quick unauthenticated test endpoint to verify proxy/routing in development
  app.get('/api/_test', safe(async (_req, res) => {
    return res.json({ ok: true, time: Date.now() });
  }));
  // Auth
  const auth = await import('./src/controllers/authController');
  const adminCtrl = await import('./src/controllers/adminController');
  const { requireAuth, requireRole } = await import('./src/middleware/auth');

  const assetsCtrl = await import('./src/controllers/assetsController');

  app.post('/api/auth/register', safe(auth.register));
  app.post('/api/auth/login', safe(auth.login));

  // Public upload endpoint that accepts JSON { dataUrl, filename } and returns { id, url }
  app.post('/api/assets', safe(assetsCtrl.uploadAsset));

  // Admin endpoints (protected)
  app.get('/api/admin/colors', requireAuth, requireRole('admin'), safe(adminCtrl.listColors));
  app.post('/api/admin/colors', requireAuth, requireRole('admin'), safe(adminCtrl.createColor));

  app.get('/api/admin/sizes', requireAuth, requireRole('admin'), safe(adminCtrl.listSizes));
  app.post('/api/admin/sizes', requireAuth, requireRole('admin'), safe(adminCtrl.createSize));

  app.post('/api/admin/inventory', requireAuth, requireRole('admin'), safe(adminCtrl.upsertInventory));
  app.get('/api/admin/inventory', requireAuth, requireRole('admin'), safe(async (req, res) => {
    const c = await import('./src/services/catalogStore');
    const data = await c.listCatalog();
    return res.json({ inventory: data.inventory });
  }));
  // Admin orders
  app.get('/api/admin/orders', requireAuth, requireRole('admin'), safe(adminCtrl.listOrders));
  app.get('/api/admin/orders/:id', requireAuth, requireRole('admin'), safe(adminCtrl.getOrder));
  app.get('/api/admin/size-chart', requireAuth, requireRole('admin'), safe(adminCtrl.listSizeChart));
  app.post('/api/admin/size-chart', requireAuth, requireRole('admin'), safe(adminCtrl.upsertSizeChart));
  app.delete('/api/admin/size-chart', requireAuth, requireRole('admin'), safe(adminCtrl.deleteSizeChart));

  app.post('/api/admin/sizes', requireAuth, requireRole('admin'), safe(adminCtrl.createSize));
  app.delete('/api/admin/sizes/:id', requireAuth, requireRole('admin'), safe(adminCtrl.deleteSize));

  const productsCtrl = await import('./src/controllers/productsController');
  app.post('/api/admin/products', requireAuth, requireRole('admin'), safe(productsCtrl.createProduct));
  app.get('/api/admin/products', requireAuth, requireRole('admin'), safe(productsCtrl.listProducts));
  app.get('/api/admin/products/:id', requireAuth, requireRole('admin'), safe(productsCtrl.getProduct));
  app.put('/api/admin/products/:id', requireAuth, requireRole('admin'), safe(productsCtrl.updateProduct));
  app.delete('/api/admin/products/:id', requireAuth, requireRole('admin'), safe(productsCtrl.deleteProduct));

  // Supplier endpoints
  const supplierCtrl = await import('./src/controllers/supplierController');
  app.get('/api/supplier/catalog', requireAuth, requireRole('supplier'), (req,res,next) => { res.set('Cache-Control','public, max-age=5'); return next(); }, safe(supplierCtrl.getCatalog));
  // Order creation temporarily disabled for suppliers. Re-enable when supplier ordering workflow is ready.
  // app.post('/api/supplier/order', requireAuth, requireRole('supplier'), safe(supplierCtrl.placeOrder));
  app.get('/api/supplier/orders', requireAuth, requireRole('supplier'), safe(supplierCtrl.listOrders));
  app.get('/api/supplier/orders/:id', requireAuth, requireRole('supplier'), safe(supplierCtrl.getOrder));
  app.get('/api/supplier/saved-designs', requireAuth, requireRole('supplier'), safe(supplierCtrl.listSavedDesigns));

  // Unauthenticated quick check for the supplier saved-designs path to validate routing/proxy
  app.get('/api/supplier/saved-designs/_test', safe(async (_req, res) => {
    return res.json({ ok: true, path: '/api/supplier/saved-designs/_test' });
  }));
  // Development-only public listing (no auth) for quick debugging
  app.get('/api/supplier/saved-designs/public', safe(supplierCtrl.listSavedDesignsPublic));

  app.get('/api/storage-type', async (_req, res) => {
    try {
      const mod = await import('./src/services/storage');
      const getStorageType = mod.getStorageType;
      return res.json({ type: getStorageType() });
    } catch {
      return res.json({ type: 'json' });
    }
  });

  return httpServer;
}
