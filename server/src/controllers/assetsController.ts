import { Request, Response } from 'express';
import * as assetStore from '../services/assetStore';

export async function uploadAsset(req: Request, res: Response) {
  try {
    const { dataUrl, filename } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ message: 'dataUrl is required' });
    const result = await assetStore.storeDataUrl(String(dataUrl), filename ? String(filename) : undefined);
    // prefer DB-backed asset id when available
    if (result && (result as any).id) {
      const id = (result as any).id;
      return res.status(201).json({ id, url: `/api/assets/${id}`, filename: result.filename });
    }
    // fallback: return client copy path
    return res.status(201).json({ id: null, url: `/attached_assets/${result.filename}`, filename: result.filename });
  } catch (e:any) {
    console.error('uploadAsset error', e?.message || e);
    return res.status(500).json({ message: 'Failed to upload asset' });
  }
}

export default { uploadAsset };
