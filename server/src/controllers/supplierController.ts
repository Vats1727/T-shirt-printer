import { Request, Response } from 'express';
import * as catalog from '../services/catalogStore';
import * as productsStore from '../services/productsStore';
import { storage, getStorageType } from '../services/storage';

export async function getCatalog(req: Request, res: Response) {
  const data = await catalog.listCatalog();
  // include full product details for suppliers
  const list = await productsStore.listProducts();
  const products = [] as any[];

  // Preload JSON storage designs if we're running in JSON mode (dev fallback)
  let jsonDesigns: any[] = [];
  try {
    if (getStorageType() === 'json') {
      jsonDesigns = await storage.getDesigns();
    }
  } catch (e) {
    // ignore; storage may be DB-backed
  }

  for (const p of list) {
    const full = await productsStore.getProduct(p.id);
    if (!full) continue;

    // If server is using JSON storage and there are JSON designs, merge matching designs by product name/slug
    if (jsonDesigns && jsonDesigns.length) {
      const normalize = (s: string) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const fullSlugNorm = normalize(full.slug || full.name || '');
    const matched = jsonDesigns.filter((d: any) => {
      const prodNameNorm = normalize(d.product || d.product || '');
      // match when normalized names overlap (e.g., "T-shirt" -> "tshirt" should match "womens-tshirt" -> "womenstshirt")
      return prodNameNorm && (prodNameNorm === fullSlugNorm || prodNameNorm.includes(fullSlugNorm) || fullSlugNorm.includes(prodNameNorm));
    }).map((d: any) => ({ id: d.id, slogan: d.slogan, image: d.image, image_mask: d.image_mask || null, image_scale: d.imageScale || d.image_scale || 100, image_rotation: d.imageRotation || d.image_rotation || 0, image_position: d.imagePosition || d.image_position || { x: 150, y: 150 }, color: d.color, template: d.template || 'tshirt' }));

      if (matched.length) {
        // if products_full has no designs, populate it with matched JSON designs
        if (!full.designs || (Array.isArray(full.designs) && full.designs.length === 0)) {
          full.designs = matched;
        } else {
          // otherwise, merge any JSON designs that aren't already present (by id or image)
          const existingImgs = new Set((full.designs || []).map((x: any) => x.image || x.id));
          for (const m of matched) {
            if (!existingImgs.has(m.image) && !existingImgs.has(m.id)) full.designs.push(m);
          }
        }
      }
    }

    products.push(full);
  }
  return res.json({ ...data, products });
}

export async function placeOrder(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'items are required' });

  const itemsValidated = items.map((it: any) => ({ product: it.product || 'tshirt', color_id: Number(it.color_id), size_id: Number(it.size_id), quantity: Number(it.quantity), price: Number(it.price || 0) }));
  const orderId = await catalog.createOrder(user.sub || user.sub, itemsValidated);
  return res.status(201).json({ id: orderId });
}
