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
    const rootDir = (typeof __dirname !== 'undefined') ? __dirname : process.cwd();
    // parse/validate request body against the API schema
    const input = api.designs.create.input.parse(req.body);
    // small debug log to help diagnose client issues
    console.log('createDesign: received payload keys=', Object.keys(req.body || {}));
    try {
      const { getStorageType } = await import('../services/storage');
      console.log('createDesign: storage type=', getStorageType());
      console.log('createDesign: version present=', !!(input as any).version);
    } catch (e) {
      console.log('createDesign: unable to determine storage type');
    }

    console.log('createDesign: preview_variants present?', !!(input as any).version?.metadata?.preview_variants, 'selected_colors present?', !!(input as any).version?.metadata?.selected_colors);
    const result = await storage.createDesign(input as any);

    // If storage returned extra metadata (e.g., design_versions id), include it
    // in the response so the UI can surface it immediately.
    try {
      if (db && result && (result as any).id) {
        const rows = (await db.select().from(design_versions).where(eq(design_versions.design_id, (result as any).id)).orderBy(design_versions.id)) as any[];
        // parse payloads if needed
        const versions = rows.map((r) => {
          let p = r.payload;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { /* ignore */ }
          }
          return p || {};
        });
        // If DB had rows, return them
        if (versions && versions.length > 0) return res.status(201).json({ design: result, versions });
      }
    } catch (e) {
      console.error('createDesign: failed to fetch versions for response', e);
    }

    // Fallback: if no DB rows (or DB not configured), try reading server/designs.json for an embedded `version` field
    try {
      const filePath = path.join(process.cwd(), 'server', 'designs.json');
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data || '[]');
      const found = (parsed || []).find((d:any) => Number(d.id) === Number((result as any).id));
      if (found && found.version) {
        // make sure it's an object
        let p = found.version;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) { /* ignore */ }
        }
        return res.status(201).json({ design: result, versions: [p] });
      }
    } catch (e) {
      // Not critical; just log for diagnosis
      console.error('createDesign: failed to read designs.json for fallback version', e?.message || e);
    }

    return res.status(201).json(result);
  } catch (err: any) {
    // Zod validation errors and other errors should be returned to client
    console.error('createDesign: error', err && err.message ? err.message : err);
    if (err?.issues || err?.name === 'ZodError') {
      // validation failure
      return res.status(400).json({ message: 'Invalid design payload', details: err.errors || err.issues || err.message });
    }
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

export async function listDesignVersions(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    // If DB is configured, read from design_versions table
    if (db) {
      const rows = (await db.select().from(design_versions).where(eq(design_versions.design_id, id)).orderBy(design_versions.id)) as any[];
      console.log('listDesignVersions: found', rows.length, 'rows for design id', id);
      // attach basic design-level template/product info to payloads if missing
      const designRows = await db.select().from(designsTable).where(eq(designsTable.id, id));
      const designInfo = (designRows as any[])[0] || {};

      // If no explicit design_versions rows were found, fall back to the designs table 'version' field if present
      if (!rows || rows.length === 0) {
        console.log('listDesignVersions: no design_versions rows found, checking designs table for embedded version for id=', id);
        if (designInfo && (designInfo as any).version) {
          try {
            let p = (designInfo as any).version;
            if (typeof p === 'string') {
              try { p = JSON.parse(p); } catch (e) { /* ignore */ }
            }
            return res.json([p]);
          } catch (e) {
            console.error('listDesignVersions: failed to parse embedded version', e?.message || e);
            return res.json([]);
          }
        }
        // if designs table also lacks the version, fall back to JSON file storage handler below
      }

      const enriched = (rows as any[]).map(r => {
        try {
          // Ensure payload is a parsed object (some drivers return JSON as string)
          let p = r.payload;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { /* leave as-is */ }
          }
          p = p || {};

          // support multiple naming variants from DB row
          const tmpl = designInfo.template || (designInfo as any).template;
          const tmplColor = (designInfo as any).templateColor || (designInfo as any).template_color;
          const productName = (designInfo as any).product;
          if (!p.template && tmpl) p.template = tmpl;
          if (!p.templateColor && tmplColor) p.templateColor = tmplColor;
          if (!p.product && productName) p.product = productName;

          r.payload = p;
        } catch (e) {
          console.error('version enrichment error', e?.message || e);
        }
        return r;
      });

      // Return array of payloads (versions) so client receives just the versions JSON
      return res.json(enriched.map(r => r.payload || {}));
    }
    // Fallback: read designs.json and return embedded `version` field if present
    const filePath = path.join(process.cwd(), 'server', 'designs.json');
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data || '[]');
    const found = (parsed || []).filter((d:any) => Number(d.id) === id).map((d:any) => d.version).filter(Boolean);
    return res.json(found);
  } catch (e:any) {
    console.error('listDesignVersions error', e?.message || e);
    return res.status(500).json({ message: 'Failed to list versions' });
  }
}

export async function getAsset(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    if (!db) return res.status(404).json({ message: 'Asset not available in JSON storage' });
    const rows = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
    const a = (rows as any[])[0];
    if (!a) return res.status(404).json({ message: 'Not found' });
    const storageKey = a.storage_key as string;
    const tried: string[] = [];

    // First, try the client attached_assets directory in the repo root. This
    // is a common dev-time location where preview PNGs are written so the
    // supplier UI can reference them directly. Prior implementations missed
    // this candidate on Windows/compiled paths resulting in 404s.
    const filename = (a.filename || '') as string;
    if (filename) {
      const clientAttached = path.join(process.cwd(), 'client', 'attached_assets', filename);
      try {
        tried.push(clientAttached);
        const bufTry = await fs.readFile(clientAttached);
        res.setHeader('Content-Type', a.mime || 'application/octet-stream');
        return res.send(bufTry);
      } catch (e) {
        // fall through to other candidate checks
      }
      // also try one directory up in case process.cwd() is different
      const altClientAttached = path.join(process.cwd(), '..', 'client', 'attached_assets', filename);
      try {
        tried.push(altClientAttached);
        const bufTry = await fs.readFile(altClientAttached);
        res.setHeader('Content-Type', a.mime || 'application/octet-stream');
        return res.send(bufTry);
      } catch (e) {
        // continue
      }
    }

    const candidates = [
      path.join(rootDir, '..', '..', storageKey), // relative from compiled src/controllers
      path.join(rootDir, '..', '..', 'server', storageKey),
      path.join(process.cwd(), storageKey),
      path.join(process.cwd(), 'server', storageKey),
      path.resolve(storageKey),
      storageKey,
    ];
    let buf: Buffer | null = null;
    for (const p of candidates) {
      if (!p) continue;
      tried.push(p);
      try {
        buf = await fs.readFile(p);
        // stop at first success
        break;
      } catch (e:any) {
        // continue
      }
    }
    if (!buf) {
      console.error('getAsset: file not found for asset id', id, 'storage_key=', storageKey, 'tried=', tried);
      return res.status(404).json({ message: 'Asset file not found', tried });
    }
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    res.send(buf);
  } catch (e:any) {
    console.error('getAsset error', e?.message || e);
    return res.status(500).json({ message: 'Failed to read asset', error: e?.message || String(e) });
  }
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
  try {
    const ok = await storage.deleteDesign(id);

    // Attempt to remove any preview asset rows and files associated with this design id
    try {
      // delete matching assets in DB if configured
      if (db) {
        const rows = await db.select().from(assetsTable).orderBy(assetsTable.id);
        const matches = (rows as any[]).filter(r => {
          try {
            if (!r) return false;
            const fn = String(r.filename || '');
            const sk = String(r.storage_key || '');
            if (fn.includes(`design-${id}-`)) return true;
            if (sk.includes(`design-${id}-`)) return true;
            // some assets may have randomized prefixes (e.g. <hex>-design-<id>-front.png)
            if (fn.includes(`design-${id}`)) return true;
            if (sk.includes(`design-${id}`)) return true;
            // fallback: check metadata serialized content for a design marker
            if (r.metadata) {
              try {
                const mstr = typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata || {});
                if (mstr.includes(`design-${id}-`) || mstr.includes(`design-${id}`)) return true;
              } catch (e) {}
            }
            return false;
          } catch (e) { return false; }
        });
        for (const a of matches) {
          try {
            // remove client attached file if exists
            if (a.filename) {
              const clientPath = path.join(process.cwd(), 'client', 'attached_assets', a.filename || '');
              try { await fs.unlink(clientPath); } catch (e) {}
            }
            // remove storage_key candidate files
            if (a.storage_key) {
              const cand = [path.join(process.cwd(), a.storage_key), path.join(process.cwd(), 'server', a.storage_key), path.resolve(a.storage_key)];
              for (const p of cand) {
                try { await fs.unlink(p); } catch (e) {}
              }
            }
            // delete DB row
            await db.delete(assetsTable).where(eq(assetsTable.id, a.id));
          } catch (e:any) {
            console.warn('deleteDesign: failed to remove asset', a.id, e?.message || e);
          }
        }
      } else {
        // no DB: attempt to delete files in client attached_assets
        try {
          const dir = path.join(process.cwd(), 'client', 'attached_assets');
          const files = await fs.readdir(dir).catch(()=>[] as string[]);
          for (const f of files) {
            if (f.startsWith(`design-${id}-`)) {
              try { await fs.unlink(path.join(dir, f)); } catch (e) {}
            }
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e:any) {
      console.warn('deleteDesign: asset cleanup error', e?.message || e);
    }

    if (!ok) return res.status(404).json({ message: 'Not found' });
    return res.status(204).end();
  } catch (e:any) {
    console.error('deleteDesign error', e?.message || e);
    return res.status(500).json({ message: 'Failed to delete design' });
  }
}
