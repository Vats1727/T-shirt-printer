import { Request, Response } from 'express';
import * as catalog from '../services/catalogStore';
import * as productsStore from '../services/productsStore';
import { db } from '../../db';
import { assets as assetsTable } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

export async function getCatalog(req: Request, res: Response) {
  const data = await catalog.listCatalog();
  // include full product details for suppliers
  const list = await productsStore.listProducts();
  const products = [] as any[];
  for (const p of list) {
    const full = await productsStore.getProduct(p.id);
    if (full) products.push(full);
  }
  return res.json({ ...data, products });
}

export async function placeOrder(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  const { items, shipping } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'items are required' });

  // Validate and normalize items; accept optional design_id and design_snapshot
  const MAX_ITEMS = 50;
  const MAX_QUANTITY = 1000;
  const MAX_SNAPSHOT_BYTES = 500 * 1024; // 500 KB per snapshot (approx)

  if (items.length > MAX_ITEMS) return res.status(400).json({ message: `Too many items (max ${MAX_ITEMS})` });

  const sanitizeSnapshot = (snap: any) => {
    if (!snap || typeof snap !== 'object') return null;
    // Deep clone without IDs and remove large data URLs
    const clone = JSON.parse(JSON.stringify(snap));

    const stripLargeImages = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string' && (v.startsWith('data:') || v.length > 200 * 1024)) {
          // Replace large inline images with null to avoid DB bloat
          obj[k] = null;
        } else if (typeof v === 'object') {
          stripLargeImages(v);
        }
      }
    };

    stripLargeImages(clone);
    return clone;
  };

  const itemsValidated = [] as any[];
  for (const it of items) {
    const quantity = Number(it.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ message: 'Invalid quantity' });
    if (quantity > MAX_QUANTITY) return res.status(400).json({ message: `Quantity exceeds maximum of ${MAX_QUANTITY}` });

    const validated: any = {
      product: it.product || 'tshirt',
      color_id: Number(it.color_id),
      size_id: Number(it.size_id),
      quantity,
      price: Number(it.price || 0),
      design_id: it.design_id ? Number(it.design_id) : undefined,
    };

    if (it.design_snapshot) {
      const sanitized = sanitizeSnapshot(it.design_snapshot);
      try {
        const bytes = Buffer.byteLength(JSON.stringify(sanitized || {}), 'utf8');
        if (bytes > MAX_SNAPSHOT_BYTES) return res.status(400).json({ message: 'Design snapshot too large' });
      } catch (e) {
        return res.status(400).json({ message: 'Invalid design snapshot' });
      }
      validated.design_snapshot = sanitized;
    }

    itemsValidated.push(validated);
  }

  // Prefer to use supplier-specific table if available
  let orderId;
  try {
    orderId = await catalog.createSupplierOrder(user.sub || user.sub, user.sub || null, itemsValidated, shipping);
  } catch (e) {
    // fallback to legacy orders if supplier tables aren't present
    orderId = await catalog.createOrder(user.sub || user.sub, itemsValidated.map((it: any) => ({ product: it.product, color_id: it.color_id, size_id: it.size_id, quantity: it.quantity, price: it.price })) as any);
  }
  return res.status(201).json({ id: orderId });
}

export async function listOrders(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const orders = await catalog.listSupplierOrders(user.sub || user.sub);
    return res.json({ orders });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to list orders' });
  }
}

export async function getOrder(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid order id' });
  try {
    const ord = await catalog.getSupplierOrder(id);
    if (!ord) return res.status(404).json({ message: 'Order not found' });
    // ensure supplier can only access their orders
    if (Number(ord.supplier_id) !== Number(user.sub)) return res.status(403).json({ message: 'Forbidden' });
    return res.json({ order: ord });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch order' });
  }
}

export async function listSavedDesigns(req: Request, res: Response) {
  const user = (req as any).user;
  // Diagnostic logging: help trace why this route may return 401/404 during development
  try {
    const uid = (req as any).user && ((req as any).user.sub || (req as any).user.id) ? ((req as any).user.sub || (req as any).user.id) : null;
    console.log('DEBUG: listSavedDesigns hit', { path: req.path, userId: uid, hasAuth: !!req.headers.authorization });
  } catch (e) {
    // ignore logging errors
  }
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    // If DB not configured, try to read client/attached_assets for design preview files as a fallback
    if (!db) {
      try {
        const dir = path.join(process.cwd(), 'client', 'attached_assets');
        const files = await fs.readdir(dir);
        const groupsMap: Record<string, any> = {};
        for (const fname of files) {
          const m = fname.match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
          if (!m) continue;
          const key = `design-${m[1]}`;
          const side = m[2] === 'back' ? 'back' : 'front';
          if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
          const url = `/attached_assets/${fname}`;
          groupsMap[key][side] = { id: null, filename: fname, url, mime: `image/${m[3]}`, metadata: { preview: true } };
        }
        const groups = Object.keys(groupsMap).map(k => ({ key: k, ...groupsMap[k] }));
        return res.json({ designs: groups });
      } catch (e) {
        return res.status(500).json({ message: 'DB not configured and failed to read attached_assets' });
      }
    }

    const rows = await db.select().from(assetsTable).orderBy(assetsTable.id);

    // Build groups by design id (preferred) or by filename pattern 'design-<id>-front/back'. This is robust to mixed workflows.
    const groupsMap: Record<string, any> = {};

    for (const p of (rows as any[])) {
      let meta = p.metadata;
      try { if (meta && typeof meta === 'string') meta = JSON.parse(meta); } catch (e) { /* ignore */ }

      const previewFlag = meta && (meta.preview === true || meta.preview === 'true');
      const designIdFromMeta = meta && (meta.designId || meta.design_id || meta.design);

      const filename = p.filename || '';
      // determine key & side
      let key: string | null = null;
      let side: 'front'|'back'|null = null;

      if (designIdFromMeta) {
        key = `design-${designIdFromMeta}`;
      } else {
        const m = String(filename || '').match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
        if (m) { key = `design-${m[1]}`; side = m[2] === 'back' ? 'back' : 'front'; }
      }

      // If asset isn't preview-marked and doesn't seem related to a design, skip it
      if (!previewFlag && !key) continue;

      if (!groupsMap[key || `asset-${p.id}`]) groupsMap[key || `asset-${p.id}`] = { key: key || `asset-${p.id}`, front: null, back: null, any: null };
      const entry = { id: p.id, filename: p.filename, url: `/api/assets/${p.id}`, mime: p.mime, size: p.size, storage_key: p.storage_key, metadata: meta };
      // Prefer client attached copy for URL if present
      try {
        if (p.filename) {
          const clientPath = path.join(process.cwd(), 'client', 'attached_assets', p.filename);
          await fs.access(clientPath);
          entry.url = `/attached_assets/${p.filename}`;
        }
      } catch (e) { /* ignore */ }

      if (side === 'front') groupsMap[key || `asset-${p.id}`].front = entry;
      else if (side === 'back') groupsMap[key || `asset-${p.id}`].back = entry;
      else groupsMap[key || `asset-${p.id}`].any = entry;
    }

    const groups = Object.keys(groupsMap).map(k => ({ key: k, ...groupsMap[k] }));
    return res.json({ designs: groups });
  } catch (e: unknown) {
    console.error('listSavedDesigns error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Failed to list saved designs' });
  }
}

// Temporary public listing for development/debugging — does not require auth.
export async function listSavedDesignsPublic(_req: Request, res: Response) {
  try {
    // DB not configured fallback: read client/attached_assets for files matching design-<id>-front/back
    if (!db) {
      try {
        const dir = path.join(process.cwd(), 'client', 'attached_assets');
        const files = await fs.readdir(dir);
        const groupsMap: Record<string, any> = {};
        for (const fname of files) {
          const m = fname.match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
          if (!m) continue;
          const key = `design-${m[1]}`;
          const side = m[2] === 'back' ? 'back' : 'front';
          if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
          const url = `/attached_assets/${fname}`;
          groupsMap[key][side] = { id: null, filename: fname, url, mime: `image/${m[3]}`, metadata: { preview: true } };
        }
        const groups = Object.keys(groupsMap).map(k => ({ key: k, ...groupsMap[k] }));
        return res.json({ designs: groups });
      } catch (e) {
        return res.status(500).json({ message: 'DB not configured and failed to read attached_assets' });
      }
    }

    const rows = await db.select().from(assetsTable).orderBy(assetsTable.id);
    const previews = (rows as any[]).filter(r => r && r.metadata && (r.metadata.preview === true || r.metadata.preview === 'true'));
    const mapped: any[] = [];
    for (const p of previews) {
      const filename = p.filename;
      const clientPath = path.join(process.cwd(), 'client', 'attached_assets', filename || '');
      let url = `/api/assets/${p.id}`;
      try {
        if (filename) {
          await fs.access(clientPath);
          url = `/attached_assets/${filename}`;
        }
      } catch (e) {}
      mapped.push({ id: p.id, filename: filename, mime: p.mime, size: p.size, storage_key: p.storage_key, metadata: p.metadata, url });
    }
    return res.json({ designs: mapped });
  } catch (e: unknown) {
    console.error('listSavedDesignsPublic error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Failed to list saved designs' });
  }
}
