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
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'items are required' });

  const itemsValidated = items.map((it: any) => ({ product: it.product || 'tshirt', color_id: Number(it.color_id), size_id: Number(it.size_id), quantity: Number(it.quantity), price: Number(it.price || 0) }));
  const orderId = await catalog.createOrder(user.sub || user.sub, itemsValidated);
  return res.status(201).json({ id: orderId });
}
