import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";
import * as designsController from "./src/controllers/designsController";
import { authFromHeader, requireRole } from "./src/middleware/auth";

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

  // auth middleware
  import('./src/middleware/auth').then(m => {
    // attach user-required routes dynamically
  }).catch(() => {});

  // Protected create route: suppliers and admins can create designs
  app.post(api.designs.create.path, authFromHeader, requireRole(['supplier', 'admin']), safe(designsController.createDesign));

  app.get(api.designs.list.path, safe(designsController.listDesigns));

  app.get(`${api.designs.list.path}/:id`, safe(designsController.getDesign));

  // Update requires supplier or admin
  app.put(`${api.designs.list.path}/:id`, authFromHeader, requireRole(['supplier', 'admin']), safe(designsController.updateDesign));

  // Delete requires admin
  app.delete(`${api.designs.list.path}/:id`, authFromHeader, requireRole('admin'), safe(designsController.deleteDesign));

  app.get('/api/storage-type', async (_req, res) => {
    try {
      const mod = await import('./src/services/storage');
      const getStorageType = mod.getStorageType;
      return res.json({ type: getStorageType() });
    } catch {
      return res.json({ type: 'json' });
    }
  });

  // Users endpoints
  app.post('/api/users/login', safe(async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ message: 'username required' });
    const user = await (await import('./src/services/users')).usersService.getByUsername(username);
    if (!user) return res.status(404).json({ message: 'Not found' });
    // For simple testing, return a Bearer token that is just the username
    return res.json({ token: `Bearer ${user.username}`, user: { id: (user as any).id, username: user.username, role: user.role } });
  }));

  app.post('/api/users', authFromHeader, requireRole('admin'), safe(async (req, res) => {
    const { username, role } = req.body || {};
    if (!username || !role) return res.status(400).json({ message: 'username and role required' });
    const usersSvc = (await import('./src/services/users')).usersService;
    const created = await usersSvc.createUser(username, role);
    res.status(201).json(created);
  }));

  app.get('/api/users', authFromHeader, requireRole('admin'), safe(async (_req, res) => {
    const usersSvc = (await import('./src/services/users')).usersService;
    const list = await usersSvc.listUsers();
    res.json(list);
  }));

  return httpServer;
}
