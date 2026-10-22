import designModel from '../models/design.model.js';
import assetModel from '../models/asset.model.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export async function createDesign(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id || null;
    const result = await designModel.createDesign({ ...req.body, owner_id: userId });

    const versions = await designModel.listDesignVersions(result.id);
    if (versions && versions.length > 0) {
      return res.status(201).json({ design: result, versions });
    }

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listDesigns(req, res, next) {
  try {
    const queryUserId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    const authUserId = req.user?.sub || req.user?.id || null;
    const userId = queryUserId || authUserId;
    const limit = parseInt(req.query.limit || '100', 10);
    const designs = await designModel.listDesigns(limit, userId);
    return res.json(designs);
  } catch (err) {
    next(err);
  }
}

export async function getDesign(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

    const userId = req.user?.sub || req.user?.id || null;
    const design = await designModel.getDesign(id, userId);
    if (!design) return res.status(404).json({ message: 'Design not found' });

    return res.json(design);
  } catch (err) {
    next(err);
  }
}

export async function listDesignVersions(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

    const userId = req.user?.sub || req.user?.id || null;
    const design = await designModel.getDesign(id, userId);
    if (!design) return res.status(403).json({ message: 'Forbidden or design not found' });

    const versions = await designModel.listDesignVersions(id);
    return res.json(versions);
  } catch (err) {
    next(err);
  }
}

export async function updateDesign(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

    const userId = req.user?.sub || req.user?.id || null;
    const updated = await designModel.updateDesign(id, req.body, userId);
    if (!updated) return res.status(404).json({ message: 'Design not found or update failed' });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteDesign(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

    const userId = req.user?.sub || req.user?.id || null;
    const success = await designModel.deleteDesign(id, userId);
    if (!success) return res.status(404).json({ message: 'Design not found or delete failed' });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getAsset(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid asset id' });

    const asset = await assetModel.findAssetById(id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const filePath = path.resolve(UPLOAD_DIR, asset.filename);
    try {
      await fs.access(filePath);
      if (asset.mime) res.setHeader('Content-Type', asset.mime);
      return res.sendFile(filePath);
    } catch {
      return res.status(404).json({ message: 'Asset file missing on disk' });
    }
  } catch (err) {
    next(err);
  }
}

export default {
  createDesign,
  listDesigns,
  getDesign,
  listDesignVersions,
  updateDesign,
  deleteDesign,
  getAsset
};
