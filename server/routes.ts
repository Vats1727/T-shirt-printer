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

  const { requireAuth, requireRole } = await import('./src/middleware/auth');

  // Portal Admin routes moved to the top for priority
  app.get('/api/portal/providers', requireAuth, requireRole('portal_admin'), safe(async (_req, res) => {
    const userStore = await import('./src/services/userStore');
    const allUsers = await userStore.getAllUsers();
    const providers = allUsers.filter((u: any) => u.role === 'print_provider' || u.role === 'admin');
    return res.json(providers);
  }));

  app.patch('/api/portal/providers/:id', requireAuth, requireRole('portal_admin'), safe(async (req, res) => {
    const id = Number(req.params.id);
    const data = req.body;
    const userStore = await import('./src/services/userStore');
    // Sanitize status
    if (data.status && !['active', 'pending', 'suspended', 'deactivated'].includes(data.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    await userStore.updateUser(id, data);
    return res.json({ ok: true });
  }));

  app.get('/api/public/providers', safe(async (_req, res) => {
    const userStore = await import('./src/services/userStore');
    const providers = (await userStore.getAllUsers())
      .filter((u: any) => u.role === 'print_provider' || u.role === 'admin')
      .map((u: any) => ({ id: u.id, name: u.name || u.email }));
    return res.json(providers);
  }));

  // Simple in-memory cache for the designs list to reduce DB load and speed up repeated fetches.
  // Cached for short duration (1s) to keep data fresh while reducing frequent repeated queries.
  let designsCache: { ts: number; data: any } = { ts: 0, data: null };

  app.post(api.designs.create.path, requireAuth, safe(designsController.createDesign));

  app.get(api.designs.list.path, requireAuth, safe(designsController.listDesigns));

  app.get(`${api.designs.list.path}/:id`, requireAuth, safe(designsController.getDesign));
  app.get(`${api.designs.list.path}/:id/versions`, requireAuth, safe(designsController.listDesignVersions));

  app.put(`${api.designs.list.path}/:id`, requireAuth, safe(designsController.updateDesign));

  app.delete(`${api.designs.list.path}/:id`, requireAuth, safe(designsController.deleteDesign));

  // Serve stored asset files by id
  app.get('/api/assets/:id', safe(designsController.getAsset));

  // Quick unauthenticated test endpoint to verify proxy/routing in development
  app.get('/api/_test', safe(async (_req, res) => {
    return res.json({ ok: true, time: Date.now() });
  }));
  // Auth
  const auth = await import('./src/controllers/authController');
  const adminCtrl = await import('./src/controllers/adminController');

  const assetsCtrl = await import('./src/controllers/assetsController');

  app.post('/api/auth/register', safe(auth.register));
  app.post('/api/auth/login', safe(auth.login));
  app.post('/api/auth/change-password', requireAuth, safe(auth.changePassword));

  // Public upload endpoint that accepts JSON { dataUrl, filename } and returns { id, url }
  app.post('/api/assets', safe(assetsCtrl.uploadAsset));
  app.delete('/api/assets/:id', requireAuth, requireRole('designer'), safe(assetsCtrl.deleteAsset));

  // Admin endpoints (protected)
  app.get('/api/admin/colors', requireAuth, requireRole('print_provider'), safe(adminCtrl.listColors));
  app.post('/api/admin/colors', requireAuth, requireRole('print_provider'), safe(adminCtrl.createColor));

  app.get('/api/admin/sizes', requireAuth, requireRole('print_provider'), safe(adminCtrl.listSizes));
  app.post('/api/admin/sizes', requireAuth, requireRole('print_provider'), safe(adminCtrl.createSize));

  app.post('/api/admin/inventory', requireAuth, requireRole('print_provider'), safe(adminCtrl.upsertInventory));
  app.get('/api/admin/inventory', requireAuth, requireRole('print_provider'), safe(async (req, res) => {
    const c = await import('./src/services/catalogStore');
    const data = await c.listCatalog();
    return res.json({ inventory: data.inventory });
  }));
  // Admin orders
  app.get('/api/admin/orders', requireAuth, requireRole('print_provider'), safe(adminCtrl.listOrders));
  app.get('/api/admin/orders/:id', requireAuth, requireRole('print_provider'), safe(adminCtrl.getOrder));
  app.get('/api/admin/size-chart', requireAuth, requireRole('print_provider'), safe(adminCtrl.listSizeChart));
  app.post('/api/admin/size-chart', requireAuth, requireRole('print_provider'), safe(adminCtrl.upsertSizeChart));
  app.delete('/api/admin/size-chart', requireAuth, requireRole('print_provider'), safe(adminCtrl.deleteSizeChart));

  app.get('/api/admin/designers', requireAuth, requireRole('print_provider'), safe(adminCtrl.listDesigners));
  app.get('/api/admin/profile', requireAuth, requireRole('print_provider'), safe(adminCtrl.getProfile));
  app.patch('/api/admin/profile', requireAuth, requireRole('print_provider'), safe(async (req, res) => {
    const userStore = await import('./src/services/userStore');
    const userId = (req as any).user.sub || (req as any).user.id;
    const { subscription_tier } = req.body;

    if (subscription_tier && !['pro', 'business', 'enterprise', 'none'].includes(subscription_tier)) {
      return res.status(400).json({ message: 'Invalid subscription tier' });
    }

    await userStore.updateUser(userId, { subscription_tier });
    return res.json({ ok: true });
  }));

  app.post('/api/admin/sizes', requireAuth, requireRole('print_provider'), safe(adminCtrl.createSize));
  app.delete('/api/admin/sizes/:id', requireAuth, requireRole('print_provider'), safe(adminCtrl.deleteSize));

  const productsCtrl = await import('./src/controllers/productsController');
  app.post('/api/admin/products', requireAuth, requireRole('print_provider'), safe(productsCtrl.createProduct));
  app.get('/api/admin/products', requireAuth, requireRole('print_provider'), safe(productsCtrl.listProducts));
  app.get('/api/admin/products/:id', requireAuth, requireRole('print_provider'), safe(productsCtrl.getProduct));
  app.put('/api/admin/products/:id', requireAuth, requireRole('print_provider'), safe(productsCtrl.updateProduct));
  app.delete('/api/admin/products/:id', requireAuth, requireRole('print_provider'), safe(productsCtrl.deleteProduct));

  // Supplier endpoints
  const supplierCtrl = await import('./src/controllers/supplierController');
  const supplierListingsCtrl = await import('./src/controllers/supplierListingsController');
  app.get('/api/supplier/catalog', requireAuth, requireRole('designer'), (req, res, next) => { res.set('Cache-Control', 'public, max-age=5'); return next(); }, safe(supplierCtrl.getCatalog));
  // Order creation temporarily disabled for suppliers. Re-enable when supplier ordering workflow is ready.
  // app.post('/api/supplier/order', requireAuth, requireRole('designer'), safe(supplierCtrl.placeOrder));
  app.get('/api/supplier/orders', requireAuth, requireRole('designer'), safe(supplierCtrl.listOrders));
  app.get('/api/supplier/orders/:id', requireAuth, requireRole('designer'), safe(supplierCtrl.getOrder));
  app.get('/api/supplier/saved-designs', requireAuth, requireRole('designer'), safe(supplierCtrl.listSavedDesigns));
  app.get('/api/supplier/profile', requireAuth, requireRole('designer'), safe(adminCtrl.getProfile));

  // Supplier listing management (create and list)
  app.post('/api/supplier/listings', requireAuth, requireRole('designer'), safe(supplierListingsCtrl.createListing));
  app.get('/api/supplier/listings', requireAuth, requireRole('designer'), safe(supplierListingsCtrl.listListings));
  app.delete('/api/supplier/listings/:id', requireAuth, requireRole('designer'), safe(supplierListingsCtrl.deleteListing));
  app.patch('/api/supplier/profile', requireAuth, requireRole('designer'), safe(supplierCtrl.updateProfile));

  // Public Design Group / Code endpoints
  app.get('/api/:groupId', safe(supplierCtrl.getDesignsByGroup));
  app.get('/api/:groupId/:designCode', safe(supplierCtrl.getDesignByGroupAndCode));

  // Unauthenticated quick check for the supplier saved-designs path to validate routing/proxy
  app.get('/api/supplier/saved-designs/_test', requireAuth, safe(async (_req, res) => {
    return res.json({ ok: true, path: '/api/supplier/saved-designs/_test' });
  }));
  // Development public listing removed for privacy

  // Public listing page (simple renderer)
  app.get('/listing/:slug', safe((await import('./src/controllers/supplierListingsController')).getPublicListing));
  // NOTE: client SPA now renders the store; server no longer exposes HTML /store/:supplierId to avoid conflicts

  // Debug JSON endpoint to fetch listings for a supplier (useful to verify server and DB)
  app.get('/api/store/:supplierId', safe(async (req, res) => {
    const listings = await (await import('./src/services/listingsStore')).listListingsBySupplier(req.params.supplierId);
    // enhance listings with preview_url where possible
    const enhanced: any[] = [];
    const fs = await import('fs/promises');
    const path = await import('path');
    const clientPath = path.join(process.cwd(), 'client', 'attached_assets');
    const clientBase = process.env.CLIENT_BASE_URL ? String(process.env.CLIENT_BASE_URL).replace(/\/$/, '') : `http://localhost:5173`;
    const { pool } = await import('./db');
    for (const l of (listings || [])) {
      let preview_url: string | null = null;
      let preview_asset_id: number | null = null;
      let preview_group: any = null;
      const designKey = String(l.design_key || '');
      if (designKey) {
        try {
          const files = await fs.readdir(clientPath);
          const found = files.find((f: string) => f.toLowerCase().startsWith(designKey.toLowerCase()));
          if (found) preview_url = `/attached_assets/${found}`;
        } catch (e) {
          // ignore
        }
      }

      // Build preview group from matching assets when available
      if (designKey) {
        try {
          const db = await import('./db');
          if (db.pool) {
            const clientDb = await db.pool.connect();
            try {
              const likePattern = `%${designKey}%`;
              const r = await clientDb.query('SELECT id, filename, mime, metadata FROM assets WHERE filename ILIKE $1 OR filename ILIKE $2 ORDER BY id', [likePattern, `${designKey}%`]);
              if (r && r.rows && r.rows.length) {
                const groupsMap: Record<string, any> = {};
                for (const a of r.rows) {
                  const fn = a.filename || '';
                  const m = String(fn || '').match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
                  const key = m ? `design-${m[1]}` : `asset-${a.id}`;
                  const side = m ? (m[2] === 'back' ? 'back' : 'front') : null;
                  if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
                  let url = `${clientBase}/api/assets/${a.id}`;
                  try { if (fn) { await fs.access(path.join(clientPath, fn)); url = `${clientBase}/attached_assets/${fn}`; } } catch (e) { /* ignore */ }
                  let meta: any = a.metadata || null;
                  try { if (meta && typeof meta === 'string') meta = JSON.parse(meta); } catch (e) { /* ignore */ }
                  const entry = { id: a.id, filename: fn, url, mime: a.mime, metadata: meta };
                  if (side === 'front') groupsMap[key].front = entry;
                  else if (side === 'back') groupsMap[key].back = entry;
                  else groupsMap[key].any = entry;
                }
                const keys = Object.keys(groupsMap);
                if (keys.length) preview_group = groupsMap[keys[0]];
                const firstRow = r.rows[0];
                if (firstRow) preview_asset_id = firstRow.id;
                if (!preview_url && preview_group) preview_url = (preview_group.front?.url || preview_group.any?.url || preview_group.back?.url) || null;
              }
            } finally { clientDb.release(); }
          }
        } catch (e) {
          // ignore
        }
      }

      enhanced.push({ ...l, preview_url, preview_asset_id, preview_group });
    }
    return res.json({ supplierId: req.params.supplierId, count: enhanced.length, listings: enhanced });
  }));

  // JSON endpoint to fetch a single listing by slug (used by client storefront)
  app.get('/api/listing/:slug', safe(async (req, res) => {
    const ctrl = await import('./src/controllers/supplierListingsController');
    return ctrl.getListingJson(req, res);
  }));
  // JSON endpoint to fetch a single listing by id
  app.get('/api/listing/id/:id', safe(async (req, res) => {
    const ctrl = await import('./src/controllers/supplierListingsController');
    return ctrl.getListingByIdJson(req, res);
  }));

  // Portal Admin endpoints (moved to top)

  // Placeholder for old portal routes removed to the top

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
