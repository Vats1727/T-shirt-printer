import type { Request, Response } from 'express';
import * as productsStore from '../services/productsStore';

export async function createProduct(req: Request, res: Response) {
  const body = req.body;
  if (!body || !body.name) return res.status(400).json({ message: 'name required' });

  const ownerId = (req as any).user?.sub || (req as any).user?.id || null;
  const product = await productsStore.createProduct({ ...body, owner_id: ownerId });
  return res.json(product);
}

export async function listProducts(req: Request, res: Response) {
  const ownerId = (req as any).user?.sub || (req as any).user?.id || null;
  const list = await productsStore.listProducts(ownerId);
  return res.json(list);
}

export async function getProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'invalid id' });
  const ownerId = (req as any).user?.sub || (req as any).user?.id || null;
  const p = await productsStore.getProduct(id, ownerId);
  if (!p) return res.status(404).json({ message: 'not found' });
  return res.json(p);
}

export async function updateProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'invalid id' });
  const ownerId = (req as any).user?.sub || (req as any).user?.id || null;
  const body = req.body;
  try {
    const p = await productsStore.updateProduct(id, body, ownerId);
    return res.json(p);
  } catch (err: any) {
    return res.status(403).json({ message: err.message });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'invalid id' });
  const ownerId = (req as any).user?.sub || (req as any).user?.id || null;
  const p = await productsStore.softDeleteProduct(id, ownerId);
  if (!p) return res.status(404).json({ message: 'not found' });
  return res.json({ success: true, product: p });
}