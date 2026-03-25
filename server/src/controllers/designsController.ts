import { Request, Response } from 'express';
import { api } from '@shared/routes';
import { storage } from '../services/storage';
import { db } from '../../db';
import { design_versions, assets as assetsTable, designs as designsTable } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// Use a safe root dir fallback since __dirname may be undefined in some runtimes
const rootDir = (typeof __dirname !== 'undefined') ? __dirname : process.cwd();

export async function createDesign(req: Request, res: Response) {
  try {
    const input = api.designs.create.input.parse(req.body);
    const user = (req as any).user;
    const userId = user?.sub || user?.id || null;

    const result = await storage.createDesign({ ...input, owner_id: userId } as any);

    try {
      if (db && result && (result as any).id) {
        const rows = (await db.select().from(design_versions).where(eq(design_versions.design_id, (result as any).id)).orderBy(design_versions.id)) as any[];
        const versions = rows.map((r) => {
          let p = r.payload;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { }
          }
          return p || {};
        });
        if (versions && versions.length > 0) return res.status(201).json({ design: result, versions });
      }
    } catch (e: any) {
      console.error('createDesign: failed to fetch versions for response', e);
    }

    try {
      const filePath = path.join(process.cwd(), 'server', 'designs.json');
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data || '[]');
      const found = (parsed || []).find((d: any) => Number(d.id) === Number((result as any).id));
      if (found && found.version) {
        let p = found.version;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) { }
        }
        return res.status(201).json({ design: result, versions: [p] });
      }
    } catch (e: any) { }

    return res.status(201).json(result);
  } catch (err: any) {
    if (err?.issues || err?.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid design payload', details: err.errors || err.issues || err.message });
    }
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

export async function listDesignVersions(req: Request, res: Response) {
  const idStr = req.params.id as string;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const user = (req as any).user;
  const userId = user?.sub || user?.id || null;

  try {
    // Check ownership first
    const design = await storage.getDesign(id, userId);
    if (!design) return res.status(403).json({ message: 'Forbidden or design not found' });

    if (db) {
      const rows = (await db.select().from(design_versions).where(eq(design_versions.design_id, id)).orderBy(design_versions.id)) as any[];
      const designRows = await db.select().from(designsTable).where(eq(designsTable.id, id));
      const designInfo = (designRows as any[])[0] || {};

      if (!rows || rows.length === 0) {
        if (designInfo && (designInfo as any).version) {
          try {
            let p = (designInfo as any).version;
            if (typeof p === 'string') {
              try { p = JSON.parse(p); } catch (e) { }
            }
            return res.json([p]);
          } catch (e: any) {
            return res.json([]);
          }
        }
      }

      const enriched = rows.map(r => {
        try {
          let p = r.payload;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { }
          }
          p = p || {};
          const tmpl = designInfo.template;
          const tmplColor = designInfo.templateColor || designInfo.template_color;
          const productName = designInfo.product;
          if (!p.template && tmpl) p.template = tmpl;
          if (!p.templateColor && tmplColor) p.templateColor = tmplColor;
          if (!p.product && productName) p.product = productName;
          r.payload = p;
        } catch (e: any) { }
        return r;
      });

      return res.json(enriched.map(r => r.payload || {}));
    }
    const filePath = path.join(process.cwd(), 'server', 'designs.json');
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data || '[]');
    const found = (parsed || []).filter((d: any) => Number(d.id) === id).map((d: any) => d.version).filter(Boolean);
    return res.json(found);
  } catch (e: any) {
    return res.status(500).json({ message: 'Failed to list versions' });
  }
}

export async function getAsset(req: Request, res: Response) {
  const idStr = req.params.id as string;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    if (!db) return res.status(404).json({ message: 'Asset not available in JSON storage' });
    const rows = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
    const a = (rows as any[])[0];
    if (!a) return res.status(404).json({ message: 'Not found' });
    const storageKey = a.storage_key as string;
    const filename = (a.filename || '') as string;

    if (filename) {
      const clientAttached = path.join(process.cwd(), 'client', 'attached_assets', filename);
      try {
        const bufTry = await fs.readFile(clientAttached);
        res.setHeader('Content-Type', a.mime || 'application/octet-stream');
        return res.send(bufTry);
      } catch (e) { }
    }

    const candidates = [
      path.join(process.cwd(), storageKey),
      path.join(process.cwd(), 'server', storageKey),
      path.resolve(storageKey),
      storageKey,
    ];
    let buf: Buffer | null = null;
    for (const p of candidates) {
      if (!p) continue;
      try {
        buf = await fs.readFile(p);
        break;
      } catch (e: any) { }
    }
    if (!buf) return res.status(404).json({ message: 'Asset file not found' });
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    res.send(buf);
  } catch (e: any) {
    return res.status(500).json({ message: 'Failed to read asset' });
  }
}

export async function listDesigns(req: Request, res: Response) {
  const all = req.query.all === '1' || req.query.all === 'true';
  const limit = all ? undefined : 100;
  const user = (req as any).user;
  const userId = user?.sub || user?.id || null;
  const designs = await storage.getDesigns(limit, userId);
  res.json(designs);
}

export async function getDesign(req: Request, res: Response) {
  const idStr = req.params.id as string;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const user = (req as any).user;
  const userId = user?.sub || user?.id || null;
  const design = await storage.getDesign(id, userId);
  if (!design) return res.status(404).json({ message: 'Not found' });
  res.json(design);
}

export async function updateDesign(req: Request, res: Response) {
  const idStr = req.params.id as string;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const user = (req as any).user;
  const userId = user?.sub || user?.id || null;
  const partialSchema = api.designs.create.input.partial();
  const input = partialSchema.parse(req.body);
  const updated = await storage.updateDesign(id, input as any, userId);
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
}

export async function deleteDesign(req: Request, res: Response) {
  const idStr = req.params.id as string;
  const id = parseInt(idStr, 10);
  const user = (req as any).user;
  const userId = user?.sub || user?.id || null;
  try {
    const ok = await storage.deleteDesign(id, userId);
    if (db) {
      // Best effort cleanup
      try {
        const rows = await db.select().from(assetsTable).orderBy(assetsTable.id);
        const matches = (rows as any[]).filter(r => r && (String(r.filename || '').includes(`design-${id}`) || String(r.storage_key || '').includes(`design-${id}`)));
        for (const a of matches) {
          await db.delete(assetsTable).where(eq(assetsTable.id, a.id));
        }
      } catch (e) { }
    }
    if (!ok) return res.status(404).json({ message: 'Not found' });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(500).json({ message: 'Failed to delete design' });
  }
}
