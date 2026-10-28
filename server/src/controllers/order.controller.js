import orderService from '../services/order.service.js';
import * as productsStore from '../services/productsStore.js';

export async function placeOrder(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const { items, shipping } = req.body;
    const result = await orderService.placeSupplierOrder(userId, items, shipping);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listSupplierOrders(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const orders = await orderService.listSupplierOrders(userId);
    return res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getSupplierOrder(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const order = await orderService.getSupplierOrder(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function listAdminOrders(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const orders = await orderService.listAdminOrders(userId);
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrder(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.sub || req.user?.id;
    const order = await orderService.getAdminOrder(id, userId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function getDesignerProductPurchaseStatus(req, res, next) {
  try {
    const designerId = req.user?.sub || req.user?.id;
    const productId = parseInt(req.params.id, 10);
    let providerId = req.query.providerId ? parseInt(req.query.providerId, 10) : req.user?.associated_provider_id;
    if (!providerId && productId) {
      const prod = await productsStore.getProduct(productId);
      if (prod?.owner_id) providerId = prod.owner_id;
    }

    const statusInfo = await orderService.getDesignerProductPurchaseStatus(designerId, productId, providerId);
    return res.json(statusInfo);
  } catch (err) {
    next(err);
  }
}

export async function createDesignerPurchaseRequest(req, res, next) {
  try {
    const designerId = req.user?.sub || req.user?.id;
    const { productId, providerId, productSku, size, color, quantity, unitPrice, shipping } = req.body;

    let resolvedProviderId = providerId || req.user?.associated_provider_id;
    if (!resolvedProviderId && productId) {
      const prod = await productsStore.getProduct(Number(productId));
      if (prod?.owner_id) resolvedProviderId = prod.owner_id;
    }
    if (!resolvedProviderId) {
      return res.status(400).json({ message: 'Print provider is required for purchase request' });
    }

    const result = await orderService.createDesignerPurchaseRequest({
      designerId,
      providerId: Number(resolvedProviderId),
      productId: Number(productId),
      productSku,
      size,
      color,
      quantity: Number(quantity || 1),
      unitPrice: Number(unitPrice || 0),
      shipping: shipping || {
        customer_name: req.user?.name || 'Designer',
        customer_email: req.user?.email || null
      }
    });

    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const orderId = parseInt(req.params.id, 10);
    const providerId = req.user?.sub || req.user?.id;
    const { status } = req.body;

    const allowedStatuses = ['confirmed', 'cancelled', 'paid', 'processing', 'completed', 'pending'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    const updated = await orderService.updateOrderStatus(orderId, status, providerId);
    if (!updated) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    return res.json({ success: true, order: updated });
  } catch (err) {
    next(err);
  }
}

export default {
  placeOrder,
  listSupplierOrders,
  getSupplierOrder,
  listAdminOrders,
  getAdminOrder,
  getDesignerProductPurchaseStatus,
  createDesignerPurchaseRequest,
  updateOrderStatus
};
