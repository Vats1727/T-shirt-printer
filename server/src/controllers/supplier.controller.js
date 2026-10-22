import productModel from '../models/product.model.js';
import inventoryModel from '../models/inventory.model.js';
import userModel from '../models/user.model.js';
import listingModel from '../models/listing.model.js';
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
    const userRow = await userModel.findById(Number(userId));
    const ownerId = userRow?.associated_provider_id || (user.role === 'print_provider' ? userId : null);

    const colors = await productModel.listColors(ownerId);
    const sizes = await productModel.listSizes(ownerId);
    const inventory = await inventoryModel.listInventory(ownerId);
    const size_chart = await productModel.listSizeChart(ownerId);
    const products = await productModel.listProducts(ownerId);

    return res.json({ colors, sizes, inventory, size_chart, products });
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
    const { title, description, slug, design_key, visibility } = req.body;

    if (!title) return res.status(400).json({ message: 'title is required' });

    const listing = await listingModel.createListing(userId, title, description, slug, design_key, visibility);
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
    return res.json(listings);
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
            store_settings: d.store_settings || {}
          };
        }
      }
    } catch (e) {}

    const enhanced = [];
    for (const l of listings || []) {
      let preview_url = null;
      let preview_asset_id = null;
      let preview_group = null;
      const designKey = String(l.design_key || '');

      let numericId = null;
      const mId = designKey.match(/design-(\d+)/i);
      if (mId) numericId = Number(mId[1]);

      if (designKey && pool) {
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

      enhanced.push({ ...l, preview_url, preview_asset_id, preview_group });
    }

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
    return res.json(listing);
  } catch (err) {
    next(err);
  }
}

export async function getListingByIdJson(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const listing = await listingModel.getListingById(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    return res.json(listing);
  } catch (err) {
    next(err);
  }
}

export default {
  getCatalog,
  listSavedDesigns,
  createListing,
  listListings,
  deleteListing,
  getStoreFront,
  getListingBySlugJson,
  getListingByIdJson
};
