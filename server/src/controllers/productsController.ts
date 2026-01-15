import type { Request, Response } from 'express';
import * as productsStore from '../services/productsStore';

export async function createProduct(req: Request, res: Response) {
  const body = req.body;
  if (!body || !body.name) return res.status(400).json({ message: 'name required' });

  const product = await productsStore.createProduct(body);
  return res.json(product);
}

export async function listProducts(_req: Request, res: Response) {
  const list = await productsStore.listProducts();
  return res.json(list);
}

export async function getProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'invalid id' });
  const p = await productsStore.getProduct(id);
  if (!p) return res.status(404).json({ message: 'not found' });
  return res.json(p);
}

export async function updateProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'invalid id' });
  const body = req.body;
  const p = await productsStore.updateProduct(id, body);
  return res.json(p);
}