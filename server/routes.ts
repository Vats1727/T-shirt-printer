import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const safe = (fn: (req: any, res: any, next: any) => Promise<any>) => {
    return (req: any, res: any, next: any) =>
      Promise.resolve(fn(req, res, next)).catch(next);
  };

  // Simple in-memory cache for the designs list to reduce DB load and speed up repeated fetches.
  // Cached for short duration (1s) to keep data fresh while reducing frequent repeated queries.
  let designsCache: { ts: number; data: any } = { ts: 0, data: null };

  app.post(api.designs.create.path, safe(async (req, res) => {
    const input = api.designs.create.input.parse(req.body);
    const design = await storage.createDesign(input);
    res.status(201).json(design);
  }));

  app.get(api.designs.list.path, safe(async (req, res) => {
    // Default to returning recent 100 designs without embedded images for faster responses.
    const all = req.query.all === '1' || req.query.all === 'true';
    const limit = all ? undefined : 100;

    // Serve from a short-lived cache for very frequent requests (e.g., UI polling)
    const now = Date.now();
    if (!all && designsCache.data && (now - designsCache.ts) < 1000) {
      return res.json(designsCache.data);
    }

    const designs = await storage.getDesigns(limit);

    // Remove image payloads from the list response to speed up transfer
    const safe = designs.map(d => ({ ...d, image: null }));

    if (!all) {
      designsCache = { ts: now, data: safe };
    }

    res.json(safe);
  }));

  app.get(`${api.designs.list.path}/:id`, safe(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
    const design = await storage.getDesign(id);
    if (!design) return res.status(404).json({ message: 'Not found' });
    res.json(design);
  }));

  app.put(`${api.designs.list.path}/:id`, safe(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
    const partialSchema = api.designs.create.input.partial();
    const input = partialSchema.parse(req.body);
    const updated = await storage.updateDesign(id, input as any);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  }));

  app.delete(`${api.designs.list.path}/:id`, safe(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
    const ok = await storage.deleteDesign(id);
    if (!ok) return res.status(404).json({ message: 'Not found' });
    res.status(204).end();
  }));

  app.get('/api/storage-type', async (_req, res) => {
    try {
      const { getStorageType } = await import('./storage');
      return res.json({ type: getStorageType() });
    } catch {
      return res.json({ type: 'json' });
    }
  });

  return httpServer;
}
