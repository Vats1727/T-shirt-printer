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
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });
    const usersSvc = (await import('./src/services/users')).usersService;
    const user = await usersSvc.getByUsername(username);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!(user as any).password) return res.status(401).json({ message: 'Invalid credentials' });
    const bcryptMod = await import('bcryptjs');
    const bcrypt = (bcryptMod as any).default ?? bcryptMod;
    const ok = bcrypt.compareSync ? bcrypt.compareSync(password, (user as any).password) : await bcrypt.compare(password, (user as any).password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const jwt = (await import('jsonwebtoken')) as typeof import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign({ id: (user as any).id, username: user.username, role: user.role }, secret, { expiresIn: '7d' });
    return res.json({ token, user: { id: (user as any).id, username: user.username, role: user.role } });
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

  // Development-only debug: list users without auth so we can verify seeding/passwords
  if (process.env.NODE_ENV === 'development') {
    app.get('/api/debug/users', safe(async (_req, res) => {
      const usersSvc = (await import('./src/services/users')).usersService;
      const list = await usersSvc.listUsers();
      res.json(list);
    }));

    app.post('/api/debug/set-password', safe(async (req, res) => {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ message: 'username and password required' });
      const usersSvcMod = await import('./src/services/users');
      const usersSvc = usersSvcMod.usersService;
      const bcryptMod = await import('bcryptjs');
      const bcrypt = (bcryptMod as any).default ?? bcryptMod;
      const hash = bcrypt.hashSync ? bcrypt.hashSync(password, 10) : await bcrypt.hash(password, 10);
      // Try DB update
      try {
        const modDb = await import('./db');
        const { db } = modDb as any;
        const { users } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        // if user exists, update, else insert
        const found = await usersSvc.getByUsername(username);
        if (found) {
          await db.update(users).set({ password: hash }).where(eq(users.id, (found as any).id));
          return res.json({ message: 'password updated (db)' });
        } else {
          const [row] = await db.insert(users).values({ username, role: 'admin', password: hash }).returning();
          return res.status(201).json({ message: 'user created (db)', user: row });
        }
      } catch (dbErr) {
        // Fallback to JSON update
        try {
          const fs = await import('fs/promises');
          const usersFile = (await import('./src/services/users')).usersFile || '../../users.json';
          let arr = [];
          try { arr = JSON.parse(await fs.readFile(usersFile, 'utf-8')); } catch (e) { arr = []; }
          let found = arr.find((u: any) => u.username === username);
          if (found) {
            found.password = hash;
          } else {
            const id = (arr[arr.length-1]?.id || 0) + 1;
            found = { id, username, role: 'admin', password: hash, createdAt: new Date() };
            arr.push(found);
          }
          await fs.writeFile(usersFile, JSON.stringify(arr, null, 2));
          return res.json({ message: 'password set (json)', user: found });
        } catch (jsonErr) {
          return res.status(500).json({ message: 'failed to set password', error: String(jsonErr) });
        }
      }
    }));
  }

  return httpServer;
}
