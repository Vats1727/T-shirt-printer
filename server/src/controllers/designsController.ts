import { Request, Response } from 'express';
import { api } from '@shared/routes';
import { storage } from '../services/storage';

export async function createDesign(req: Request, res: Response) {
  const input = api.designs.create.input.parse(req.body);
  const design = await storage.createDesign(input);
  res.status(201).json(design);
}

export async function listDesigns(req: Request, res: Response) {
  const all = req.query.all === '1' || req.query.all === 'true';
  const limit = all ? undefined : 100;
  const designs = await storage.getDesigns(limit);
  const safe = designs.map(d => ({ ...d, image: null }));
  res.json(safe);
}

export async function getDesign(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const design = await storage.getDesign(id);
  if (!design) return res.status(404).json({ message: 'Not found' });
  res.json(design);
}

export async function updateDesign(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const partialSchema = api.designs.create.input.partial();
  const input = partialSchema.parse(req.body);
  const updated = await storage.updateDesign(id, input as any);
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
}

export async function deleteDesign(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const ok = await storage.deleteDesign(id);
  if (!ok) return res.status(404).json({ message: 'Not found' });
  res.status(204).end();
}
