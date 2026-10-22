import productModel from '../models/product.model.js';
import inventoryModel from '../models/inventory.model.js';

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
    const ownerId = req.user?.sub || req.user?.id;
    const products = await productModel.listProducts(ownerId);
    return res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ownerId = req.user?.sub || req.user?.id;
    const product = await productModel.getProductById(id, ownerId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const ownerId = req.user?.sub || req.user?.id;
    const product = await productModel.createProduct({ ...req.body, owner_id: ownerId });
    return res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ownerId = req.user?.sub || req.user?.id;
    const updated = await productModel.updateProduct(id, req.body, ownerId);
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ownerId = req.user?.sub || req.user?.id;
    await productModel.deleteProduct(id, ownerId);
    return res.json({ success: true });
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
  deleteProduct
};
