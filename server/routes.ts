import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";
import * as designsController from "./src/controllers/designsController";

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

  app.post(api.designs.create.path, safe(designsController.createDesign));

  app.get(api.designs.list.path, safe(designsController.listDesigns));

  app.get(`${api.designs.list.path}/:id`, safe(designsController.getDesign));

  app.put(`${api.designs.list.path}/:id`, safe(designsController.updateDesign));

  app.delete(`${api.designs.list.path}/:id`, safe(designsController.deleteDesign));

  app.get('/api/storage-type', async (_req, res) => {
    try {
      const mod = await import('./src/services/storage');
      const getStorageType = mod.getStorageType;
      return res.json({ type: getStorageType() });
    } catch {
      return res.json({ type: 'json' });
    }
  });

  return httpServer;
}
