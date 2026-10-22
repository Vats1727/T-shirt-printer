import orderModel from '../models/order.model.js';

export async function placeSupplierOrder(userId, items, shipping) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('items are required');
    err.status = 400;
    throw err;
  }

  const MAX_ITEMS = 50;
  const MAX_QUANTITY = 1000;
  const MAX_SNAPSHOT_BYTES = 500 * 1024;

  if (items.length > MAX_ITEMS) {
    const err = new Error(`Too many items (max ${MAX_ITEMS})`);
    err.status = 400;
    throw err;
  }

  const sanitizeSnapshot = (snap) => {
    if (!snap || typeof snap !== 'object') return null;
    const clone = JSON.parse(JSON.stringify(snap));

    const stripLargeImages = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string' && (v.startsWith('data:') || v.length > 200 * 1024)) {
          obj[k] = null;
        } else if (typeof v === 'object') {
          stripLargeImages(v);
        }
      }
    };

    stripLargeImages(clone);
    return clone;
  };

  const itemsValidated = [];
  for (const it of items) {
    const quantity = Number(it.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error('Invalid quantity');
      err.status = 400;
      throw err;
    }
    if (quantity > MAX_QUANTITY) {
      const err = new Error(`Quantity exceeds maximum of ${MAX_QUANTITY}`);
      err.status = 400;
      throw err;
    }

    const validated = {
      product: it.product || 'tshirt',
      color_id: Number(it.color_id),
      size_id: Number(it.size_id),
      quantity,
      price: Number(it.price || 0),
      design_id: it.design_id ? Number(it.design_id) : undefined
    };

    if (it.design_snapshot) {
      const sanitized = sanitizeSnapshot(it.design_snapshot);
      try {
        const bytes = Buffer.byteLength(JSON.stringify(sanitized || {}), 'utf8');
        if (bytes > MAX_SNAPSHOT_BYTES) {
          const err = new Error('Design snapshot too large');
          err.status = 400;
          throw err;
        }
      } catch (e) {
        const err = new Error('Invalid design snapshot');
        err.status = 400;
        throw err;
      }
      validated.design_snapshot = sanitized;
    }

    itemsValidated.push(validated);
  }

  const orderId = await orderModel.createSupplierOrder(userId, userId, itemsValidated, shipping);
  return { orderId, success: true };
}

export async function listSupplierOrders(supplierId) {
  return orderModel.listSupplierOrders(supplierId);
}

export async function getSupplierOrder(orderId) {
  return orderModel.getSupplierOrder(orderId);
}

export async function listAdminOrders(ownerId) {
  return orderModel.listOrdersForAdmin(ownerId);
}

export async function getAdminOrder(orderId, ownerId) {
  return orderModel.getOrderForAdmin(orderId, ownerId);
}

export default {
  placeSupplierOrder,
  listSupplierOrders,
  getSupplierOrder,
  listAdminOrders,
  getAdminOrder
};
