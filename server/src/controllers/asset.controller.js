import storageService from '../services/storage.service.js';
import assetModel from '../models/asset.model.js';

export async function uploadAsset(req, res, next) {
  try {
    const { dataUrl, filename, metadata } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ message: 'dataUrl is required' });
    }

    const userId = req.user?.sub || req.user?.id || null;
    const result = await storageService.storeDataUrl(dataUrl, filename, userId, metadata);

    return res.status(201).json({
      id: result.id,
      url: result.url,
      filename: result.filename,
      size: result.size,
      mime: result.mime
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAsset(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.sub || req.user?.id;
    
    // Find asset to physically unlink its file
    const asset = await assetModel.findAssetById(id);
    if (asset) {
      await storageService.deletePhysicalFile(asset.storage_key || asset.filename);
    }

    const ok = await assetModel.deleteAssetById(id, userId);
    if (!ok && !asset) return res.status(404).json({ message: 'Asset not found or delete unauthorized' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteFile(req, res, next) {
  try {
    const fileUrl = req.body?.url || req.query?.url;
    if (!fileUrl) {
      return res.status(400).json({ message: 'url is required' });
    }

    const deleted = await storageService.deletePhysicalFile(fileUrl);
    return res.json({ success: true, deleted });
  } catch (err) {
    next(err);
  }
}

export default { uploadAsset, deleteAsset, deleteFile };
