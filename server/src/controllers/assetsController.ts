import { Request, Response } from 'express';
import * as assetStore from '../services/assetStore';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../../db';
import { assets as assetsTable } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export async function uploadAsset(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { dataUrl, filename, metadata } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ message: 'dataUrl is required' });

    // pass optional metadata object to storeDataUrl so callers can set preview flags
    const result = await assetStore.storeDataUrl(
      String(dataUrl),
      filename ? String(filename) : undefined,
      user?.sub || user?.id || null,
      (metadata && typeof metadata === 'object') ? metadata : undefined
    );

    // prefer DB-backed asset id when available
    if (result && (result as any).id) {
      const id = (result as any).id;
      return res.status(201).json({ id, url: `/api/assets/${id}`, filename: result.filename });
    }
    // fallback: return client copy path
    return res.status(201).json({ id: null, url: `/attached_assets/${result.filename}`, filename: result.filename });
  } catch (e: any) {
    console.error('uploadAsset error', e?.message || e);
    return res.status(500).json({ message: 'Failed to upload asset' });
  }
}

export async function deleteAsset(req: Request, res: Response) {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    // If DB configured, try to find the asset row first
    let row: any = null;
    if (db) {
      const userId = user?.sub || user?.id || null;
      const rows = await db.select().from(assetsTable).where(
        and(
          eq(assetsTable.id, id),
          eq(assetsTable.uploader_id, userId)
        )
      );
      row = (rows as any[])[0];
      if (!row) return res.status(404).json({ message: 'Asset not found or not owned by you' });
    }

    // If there is a filename or storage_key, attempt to remove files
    try {
      if (row && row.filename) {
        const clientPath = path.join(process.cwd(), 'client', 'attached_assets', row.filename || '');
        try { await fs.unlink(clientPath); } catch (e) { }
      }
      if (row && row.storage_key) {
        const storageCandidates = [
          path.join(process.cwd(), row.storage_key),
          path.join(process.cwd(), 'server', row.storage_key),
          path.resolve(row.storage_key),
        ];
        for (const p of storageCandidates) {
          try { await fs.unlink(p); } catch (e) { }
        }
      }
    } catch (e) {
      // best-effort file deletion; continue to DB delete
    }

    if (db) {
      await db.delete(assetsTable).where(eq(assetsTable.id, id));
      return res.status(204).end();
    }

    // If no DB, but file cleaned up, return 204
    return res.status(204).end();
  } catch (e: any) {
    console.error('deleteAsset error', e?.message || e);
    return res.status(500).json({ message: 'Failed to delete asset' });
  }
}

export default { uploadAsset, deleteAsset };
