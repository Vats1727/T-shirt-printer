import { Request, Response } from 'express';
import * as catalog from '../services/catalogStore';

export async function listColors(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const rows = await catalog.listColors(ownerId);
  res.json(rows);
}

export async function createColor(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const { name, hex } = req.body;
  if (!name || !hex) return res.status(400).json({ message: 'name and hex required' });
  const color = await catalog.createColor({ name, hex, owner_id: ownerId });
  return res.status(201).json(color);
}

export async function listSizes(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const rows = await catalog.listSizes(ownerId);
  res.json(rows);
}

export async function createSize(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const { label } = req.body;
  if (!label) return res.status(400).json({ message: 'label required' });
  try {
    const size = await catalog.createSize({ label, owner_id: ownerId });
    return res.status(201).json(size);
  } catch (err: any) {
    if (err && err.message && err.message.includes('exists')) return res.status(400).json({ message: 'size already exists' });
    throw err;
  }
}

export async function deleteSize(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'id required' });
  await catalog.deleteSize(id, ownerId);
  return res.status(200).json({ ok: true });
}

export async function upsertInventory(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const { product, color_id, size_id, quantity, price } = req.body;
  if (!color_id || !size_id) return res.status(400).json({ message: 'color_id and size_id required' });
  const inv = await catalog.upsertInventory({
    product: product || 'tshirt',
    color_id: Number(color_id),
    size_id: Number(size_id),
    quantity: Number(quantity || 0),
    price: Number(price || 0),
    owner_id: ownerId
  });
  return res.status(200).json(inv);
}

export async function listSizeChart(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const product = (req.query.product as string) || 'tshirt';
  const rows = await catalog.listSizeChart(product, ownerId);
  return res.json(rows);
}

export async function upsertSizeChart(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const { product, size_id, chest, length, shoulder } = req.body;
  if (!size_id) return res.status(400).json({ message: 'size_id required' });
  const row = await catalog.upsertSizeChart({
    product: product || 'tshirt',
    size_id: Number(size_id),
    chest: Number(chest || 0),
    length: Number(length || 0),
    shoulder: Number(shoulder || 0),
    owner_id: ownerId
  });
  return res.status(200).json(row);
}

export async function deleteSizeChart(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const product = (req.query.product as string) || 'tshirt';
  const size_id = Number(req.query.size_id);
  if (!size_id) return res.status(400).json({ message: 'size_id required' });
  await catalog.deleteSizeChart(product, size_id, ownerId);
  return res.status(200).json({ ok: true });
}

export async function listOrders(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  try {
    const orders = await catalog.listAllSupplierOrdersForAdmin(ownerId);
    return res.json({ orders });
  } catch (e) {
    console.error('admin.listOrders error', e);
    return res.status(500).json({ message: 'Failed to list orders' });
  }
}

export async function getOrder(req: Request, res: Response) {
  const user = (req as any).user;
  const ownerId = user?.sub || user?.id || null;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'id required' });
  try {
    const ord = await catalog.getSupplierOrderForAdmin(id, ownerId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });
    return res.json({ order: ord });
  } catch (e) {
    console.error('admin.getOrder error', e);
    return res.status(500).json({ message: 'Failed to fetch order' });
  }
}
export async function listDesigners(req: Request, res: Response) {
  const user = (req as any).user;
  const providerId = user?.sub || user?.id || null;
  if (!providerId) return res.status(401).json({ message: 'Unauthorized' });
  
  const userStore = await import('../services/userStore');
  try {
    const designers = await userStore.getDesignersByProvider(providerId);
    return res.json({ designers });
  } catch (e) {
    console.error('admin.listDesigners error', e);
    return res.status(500).json({ message: 'Failed to list designers' });
  }
}

export async function getProfile(req: Request, res: Response) {
  const userStore = await import('../services/userStore');
  const user = await userStore.findById((req as any).user.id || (req as any).user.sub);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(user);
}
