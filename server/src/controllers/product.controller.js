import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import productModel from '../models/product.model.js';
import inventoryModel from '../models/inventory.model.js';
import designModel from '../models/design.model.js';
import * as productsStore from '../services/productsStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// --- Colors ---
export async function listColors(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const colors = await productModel.listColors(ownerId);
    return res.json(colors);
  } catch (err) {
    next(err);
  }
}

export async function createColor(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const color = await productModel.createColor({ ...req.body, owner_id: ownerId });
    return res.status(201).json(color);
  } catch (err) {
    next(err);
  }
}

export async function deleteColor(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const id = parseInt(req.params.id, 10);
    await productModel.deleteColor(id, ownerId);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- Sizes ---
export async function listSizes(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const sizes = await productModel.listSizes(ownerId);
    return res.json(sizes);
  } catch (err) {
    next(err);
  }
}

export async function createSize(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const size = await productModel.createSize({ ...req.body, owner_id: ownerId });
    return res.status(201).json(size);
  } catch (err) {
    next(err);
  }
}

export async function deleteSize(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const id = parseInt(req.params.id, 10);
    await productModel.deleteSize(id, ownerId);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- Inventory ---
export async function listInventory(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const product = req.query.product || 'tshirt';
    const inventory = await inventoryModel.listInventory(ownerId, product);
    return res.json({ inventory });
  } catch (err) {
    next(err);
  }
}

export async function upsertInventory(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const row = await inventoryModel.upsertInventory({ ...req.body, owner_id: ownerId });
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

// --- Size Chart ---
export async function listSizeChart(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const product = req.query.product || 'tshirt';
    const chart = await productModel.listSizeChart(ownerId, product);
    return res.json(chart);
  } catch (err) {
    next(err);
  }
}

export async function upsertSizeChart(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const row = await productModel.upsertSizeChart({ ...req.body, owner_id: ownerId });
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function deleteSizeChart(req, res, next) {
  try {
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- Products (Full) ---
export async function listProducts(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id || null;
    const products = await productsStore.listProducts(ownerId);
    return res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'invalid id' });
    const ownerId = req.user?.sub || req.user?.id || null;
    const product = await productsStore.getProduct(id, ownerId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const body = req.body;
    if (!body || !body.name) return res.status(400).json({ message: "Product name required" });
    const ownerId = req.user?.sub || req.user?.id || null;
    const product = await productsStore.createProduct({ ...body, owner_id: ownerId });
    return res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'invalid id' });
    const ownerId = req.user?.sub || req.user?.id || null;
    const updated = await productsStore.updateProduct(id, req.body, ownerId);
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'invalid id' });
    const ownerId = req.user?.sub || req.user?.id || null;

    // Check existing product to clean up any custom uploaded design files
    try {
      const prod = await productsStore.getProduct(id, ownerId);
      if (prod && prod.designs) {
        const rawDesigns = Array.isArray(prod.designs) ? prod.designs : Object.values(prod.designs);
        for (const d of rawDesigns) {
          const imgUrl = d?.image;
          if (imgUrl && typeof imgUrl === 'string' && imgUrl.includes('/uploads/designs/')) {
            const relPath = imgUrl.replace(/^.*?\/uploads\//, '');
            const safeFilePath = path.resolve(UPLOAD_DIR, relPath);
            if (safeFilePath.startsWith(UPLOAD_DIR)) {
              await fs.unlink(safeFilePath).catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.warn('deleteProduct: file cleanup warning:', e.message);
    }

    const deleted = await productsStore.softDeleteProduct(id, ownerId);
    return res.json({ success: true, product: deleted });
  } catch (err) {
    next(err);
  }
}

export async function listProviderDesigns(req, res, next) {
  try {
    const providerId = req.user?.sub || req.user?.id;
    const designs = await designModel.listDesignsForProvider(providerId);
    return res.json(designs);
  } catch (err) {
    next(err);
  }
}

export default {
  listColors,
  createColor,
  deleteColor,
  listSizes,
  createSize,
  deleteSize,
  listInventory,
  upsertInventory,
  listSizeChart,
  upsertSizeChart,
  deleteSizeChart,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listProviderDesigns
};
