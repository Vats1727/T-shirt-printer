import { Request, Response } from 'express';
import * as catalog from '../services/catalogStore';
import * as productsStore from '../services/productsStore';

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
  const itemsValidated = items.map((it: any) => ({
    product: it.product || 'tshirt',
    color_id: Number(it.color_id),
    size_id: Number(it.size_id),
    quantity: Number(it.quantity),
    price: Number(it.price || 0),
    design_id: it.design_id ? Number(it.design_id) : undefined,
    design_snapshot: it.design_snapshot ? it.design_snapshot : undefined,
  }));

  // Prefer to use supplier-specific table if available
  let orderId;
  try {
    orderId = await catalog.createSupplierOrder(user.sub || user.sub, user.sub || null, itemsValidated, shipping);
  } catch (e) {
    // fallback to legacy orders if supplier tables aren't present
    orderId = await catalog.createOrder(user.sub || user.sub, itemsValidated.map(it=>({ product: it.product, color_id: it.color_id, size_id: it.size_id, quantity: it.quantity, price: it.price })) as any);
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
