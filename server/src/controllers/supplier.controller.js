import productModel from '../models/product.model.js';
import inventoryModel from '../models/inventory.model.js';
import userModel from '../models/user.model.js';
import listingModel from '../models/listing.model.js';
import * as productsStore from '../services/productsStore.js';
import { decodeId } from '../utils/idEncoder.js';
import { pool } from '../config/database.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export async function getCatalog(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });

    const userId = user.sub || user.id;
    const queryProviderId = req.query.providerId ? Number(req.query.providerId) : null;
    // All designers have access to all print providers' products
    const ownerId = queryProviderId || (user.role === 'print_provider' ? userId : null);

    const colors = await productModel.listColors(ownerId);
    const sizes = await productModel.listSizes(ownerId);
    const inventory = await inventoryModel.listInventory(ownerId);
    const size_chart = await productModel.listSizeChart(ownerId);
    let products = await productsStore.listProducts(ownerId);

    // If designer, do not show draft products
    if (user.role === 'designer' || user.role === 'supplier') {
      products = products.filter((p) => p.status !== 'draft');
    }

    return res.json({ colors, sizes, inventory, size_chart, products });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Invalid product id' });
    const product = await productsStore.getProduct(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function listSavedDesigns(req, res, next) {
  try {
    const user = req.user;
    const userId = user?.sub || user?.id;

    if (pool) {
      const result = await pool.query(
        `SELECT d.*, dv.payload as version_payload 
         FROM designs d
         LEFT JOIN LATERAL (
           SELECT payload FROM design_versions WHERE design_id = d.id ORDER BY id DESC LIMIT 1
         ) dv ON true
         WHERE d.owner_id = $1
         ORDER BY d.id DESC`,
        [Number(userId)]
      );

      const enhanced = result.rows.map((row) => {
        let version = row.version_payload;
        if (typeof version === 'string') {
          try { version = JSON.parse(version); } catch (e) {}
        }
        return {
          ...row,
          version: version || null,
          versions: version ? [version] : []
        };
      });

      return res.json(enhanced);
    }

    return res.json([]);
  } catch (err) {
    next(err);
  }
}

export async function createListing(req, res, next) {
  try {
    const user = req.user;
    const userId = user?.sub || user?.id;
    const { title, description, slug, design_key, visibility, price } = req.body;

    if (!title) return res.status(400).json({ message: 'title is required' });

    const listing = await listingModel.createListing(userId, title, description, slug, design_key, visibility, price);
    return res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
}

export async function listListings(req, res, next) {
  try {
    const user = req.user;
    const userId = user?.sub || user?.id;
    const listings = await listingModel.listListingsBySupplier(userId);
    const enhanced = await Promise.all((listings || []).map(resolveListingPreview));
    return res.json(enhanced);
  } catch (err) {
    next(err);
  }
}

export async function deleteListing(req, res, next) {
  try {
    const user = req.user;
    const userId = user?.sub || user?.id;
    const id = parseInt(req.params.id, 10);
    const ok = await listingModel.deleteListing(id, userId);
    return res.json({ ok });
  } catch (err) {
    next(err);
  }
}

async function resolveListingPreview(l) {
  let preview_url = null;
  let preview_asset_id = null;
  let preview_group = null;
  let designer_name = null;
  let designer_email = null;
  let product_name = null;
  const designKey = String(l.design_key || '');

  let numericId = null;
  const mId = designKey.match(/design-(\d+)/i);
  if (mId) numericId = Number(mId[1]);
  else if (/^\d+$/.test(designKey)) numericId = Number(designKey);

  // 1. Resolve from designs & design_versions table
  if (numericId && pool) {
    try {
      const dRes = await pool.query(
        `SELECT d.id, d.owner_id, d.image, d.back_image, d.product,
                u.name as designer_name, u.email as designer_email,
                pf.name as product_name
         FROM designs d
         LEFT JOIN users u ON u.id = d.owner_id
         LEFT JOIN products_full pf ON pf.id = d.product_id
         WHERE d.id = $1`,
        [numericId]
      );
      if (dRes?.rows?.length) {
        const d = dRes.rows[0];
        designer_name = d.designer_name || null;
        designer_email = d.designer_email || null;
        product_name = d.product_name || d.product || null;

        const vRes = await pool.query('SELECT payload FROM design_versions WHERE design_id = $1 ORDER BY id DESC LIMIT 1', [numericId]);
        let meta = {};
        if (vRes?.rows?.length) {
          let p = vRes.rows[0].payload;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) {}
          }
          meta = p?.metadata || {};
        }
        const normalize = (img) => {
          if (!img) return null;
          img = String(img);
          if (img.startsWith('http') || img.startsWith('/') || img.startsWith('data:')) return img;
          return `/uploads/${img}`;
        };
        const front = normalize(meta.preview_front || d.image);
        const back = normalize(meta.preview_back || d.back_image);
        preview_group = {
          key: designKey,
          front: front ? { url: front } : null,
          back: back ? { url: back } : null,
          any: front ? { url: front } : (back ? { url: back } : null)
        };
        preview_url = preview_group.front?.url || preview_group.back?.url || null;
      }
    } catch (e) {
      // ignore
    }
  }

  // 2. Resolve from assets table fallback
  if (!preview_url && designKey && pool) {
    try {
      const r = await pool.query(
        `SELECT id, filename, mime, metadata FROM assets 
         WHERE filename ILIKE $1 
            OR filename ILIKE $2 
            OR ($3::int IS NOT NULL AND (metadata->>'designId')::int = $3)
         ORDER BY id`,
        [`%${designKey}%`, `${designKey}%`, numericId]
      );

      if (r?.rows?.length) {
        const groupsMap = {};
        for (const a of r.rows) {
          const fn = a.filename || '';
          let meta = a.metadata || null;
          if (meta && typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch (e) {}
          }

          const sideFromMeta = meta && (meta.side || meta.side_name);
          const m = String(fn).match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
          const side = sideFromMeta === 'back' ? 'back' : (sideFromMeta === 'front' ? 'front' : (m ? (m[2] === 'back' ? 'back' : 'front') : null));
          const key = designKey || `asset-${a.id}`;

          if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
          const entry = { id: a.id, filename: fn, url: `/api/assets/${a.id}`, mime: a.mime, metadata: meta };

          if (side === 'front') groupsMap[key].front = entry;
          else if (side === 'back') groupsMap[key].back = entry;
          else groupsMap[key].any = entry;
        }

        const keys = Object.keys(groupsMap);
        if (keys.length) {
          preview_group = groupsMap[keys[0]];
          preview_url = preview_group.front?.url || preview_group.any?.url || preview_group.back?.url || null;
          const assetObj = preview_group.front || preview_group.any || preview_group.back;
          if (assetObj) preview_asset_id = assetObj.id;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return {
    ...l,
    preview_url,
    preview_asset_id,
    preview_group,
    designer_name,
    designer_email,
    product_name
  };
}

export async function getStoreFront(req, res, next) {
  try {
    const rawParam = req.params.supplierId;
    const supplierId = decodeId(rawParam) || rawParam;
    const listings = await listingModel.listListingsBySupplier(supplierId);

    let designerInfo = null;
    try {
      const dId = Number(supplierId);
      if (dId) {
        const d = await userModel.findById(dId);
        if (d) {
          designerInfo = {
            id: d.id,
            name: d.name,
            email: d.email,
            role: d.role,
            is_provider: d.role === 'print_provider' || d.role === 'admin',
            store_settings: d.store_settings || {}
          };
        }
      }
    } catch (e) {}

    const enhanced = await Promise.all((listings || []).map(resolveListingPreview));

    return res.json({
      supplierId,
      count: enhanced.length,
      listings: enhanced,
      designer: designerInfo,
      store_settings: designerInfo?.store_settings || {}
    });
  } catch (err) {
    next(err);
  }
}

export async function getListingBySlugJson(req, res, next) {
  try {
    const slug = req.params.slug;
    const listing = await listingModel.getListingBySlug(slug);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    const enhanced = await resolveListingPreview(listing);
    return res.json(enhanced);
  } catch (err) {
    next(err);
  }
}

export async function getListingByIdJson(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const listing = await listingModel.getListingById(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    const enhanced = await resolveListingPreview(listing);
    return res.json(enhanced);
  } catch (err) {
    next(err);
  }
}

export default {
  getCatalog,
  getProduct,
  listSavedDesigns,
  createListing,
  listListings,
  deleteListing,
  getStoreFront,
  getListingBySlugJson,
  getListingByIdJson
};
