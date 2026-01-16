import { Request, Response } from 'express';
import * as catalog from '../services/catalogStore';

export async function listColors(req: Request, res: Response) {
  const rows = await catalog.listColors();
  res.json(rows);
}

export async function createColor(_req: Request, res: Response) {
  // Colors are fixed to the seeded 10 values. Prevent creating new colors via the UI/API.
  return res.status(400).json({ message: 'Colors are fixed. To change them, update the migration/seed.' });
}

export async function listSizes(req: Request, res: Response) {
  const rows = await catalog.listSizes();
  res.json(rows);
}

export async function createSize(req: Request, res: Response) {
  const { label } = req.body;
  if (!label) return res.status(400).json({ message: 'label required' });
  try {
    const size = await catalog.createSize({ label });
    return res.status(201).json(size);
  } catch (err: any) {
    if (err && err.message && err.message.includes('exists')) return res.status(400).json({ message: 'size already exists' });
    throw err;
  }
}

export async function deleteSize(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'id required' });
  await catalog.deleteSize(id);
  return res.status(200).json({ ok: true });
}

export async function upsertInventory(req: Request, res: Response) {
  const { product, color_id, size_id, quantity, price } = req.body;
  if (!color_id || !size_id) return res.status(400).json({ message: 'color_id and size_id required' });
  const inv = await catalog.upsertInventory({ product: product || 'tshirt', color_id: Number(color_id), size_id: Number(size_id), quantity: Number(quantity || 0), price: Number(price || 0) });
  return res.status(200).json(inv);
}

export async function listSizeChart(req: Request, res: Response) {
  const product = (req.query.product as string) || 'tshirt';
  const rows = await catalog.listSizeChart(product);
  return res.json(rows);
}

export async function upsertSizeChart(req: Request, res: Response) {
  const { product, size_id, chest, length, shoulder } = req.body;
  if (!size_id) return res.status(400).json({ message: 'size_id required' });
  const row = await catalog.upsertSizeChart({ product: product || 'tshirt', size_id: Number(size_id), chest: Number(chest || 0), length: Number(length || 0), shoulder: Number(shoulder || 0) });
  return res.status(200).json(row);
}

export async function deleteSizeChart(req: Request, res: Response) {
  const product = (req.query.product as string) || 'tshirt';
  const size_id = Number(req.query.size_id);
  if (!size_id) return res.status(400).json({ message: 'size_id required' });
  await catalog.deleteSizeChart(product, size_id);
  return res.status(200).json({ ok: true });
}

// Admin: list all supplier orders (sanitized for admin view)
export async function listOrders(_req: Request, res: Response) {
  try {
    const orders = await catalog.listAllSupplierOrdersForAdmin();
    return res.json({ orders });
  } catch (e) {
    console.error('admin.listOrders error', e);
    return res.status(500).json({ message: 'Failed to list orders' });
  }
}

// Admin: get a single order by id (sanitized)
export async function getOrder(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'id required' });
  try {
    const ord = await catalog.getSupplierOrderForAdmin(id);
    if (!ord) return res.status(404).json({ message: 'Order not found' });
    return res.json({ order: ord });
  } catch (e) {
    console.error('admin.getOrder error', e);
    return res.status(500).json({ message: 'Failed to fetch order' });
  }
}

