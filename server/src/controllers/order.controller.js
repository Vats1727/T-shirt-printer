import orderService from '../services/order.service.js';

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
    return res.json(orders);
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

export default {
  placeOrder,
  listSupplierOrders,
  getSupplierOrder,
  listAdminOrders,
  getAdminOrder
};
