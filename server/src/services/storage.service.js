import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import assetModel from '../models/asset.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function mimeToExt(mime) {
  if (!mime) return 'bin';
  const m = mime.split('/')[1];
  if (!m) return 'bin';
  return m.split('+')[0];
}

export async function storeDataUrl(dataUrl, filenameHint, uploaderId, metadata = {}) {
  await ensureUploadDir();
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid dataUrl');
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, 'base64');
  const ext = mimeToExt(mime);

  // Subfolder categorization based on metadata: farmo or designs, and front or back
  const type = metadata?.type === 'farmo' ? 'farmo' : 'designs';
  const side = metadata?.side === 'back' ? 'back' : 'front';
  const subFolder = metadata?.subFolder || `${type}/${side}`;

  const targetDir = path.resolve(UPLOAD_DIR, subFolder);
  await fs.mkdir(targetDir, { recursive: true });

  const id = crypto.randomBytes(10).toString('hex');
  const sanitizedHint = filenameHint ? filenameHint.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_') : '';
  const fileBasename = sanitizedHint ? `${id}-${sanitizedHint}` : `${id}.${ext}`;
  const filename = `${subFolder}/${fileBasename}`;
  const storageKey = `uploads/${filename}`;
  const outPath = path.resolve(targetDir, fileBasename);
  await fs.writeFile(outPath, buf);

  let assetRow = null;
  try {
    const finalMetadata = { ...(metadata || {}), type, side, subFolder, uploaded: true };
    assetRow = await assetModel.createAsset({
      filename,
      mime,
      size: buf.length,
      storage_key: storageKey,
      metadata: finalMetadata,
      uploader_id: uploaderId,
      owner_id: uploaderId
    });
  } catch (e) {
    console.error('storage.service: error creating asset row:', e.message);
  }

  const publicUrl = `/uploads/${filename}`;

  return {
    storageKey,
    filename,
    mime,
    size: buf.length,
    id: assetRow ? assetRow.id : null,
    url: publicUrl
  };
}

export async function deletePhysicalFile(relativeOrFullUrl) {
  if (!relativeOrFullUrl || typeof relativeOrFullUrl !== 'string') return false;

  let relPath = relativeOrFullUrl
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/?(api\/assets\/|attached_assets\/|uploads\/)/, '')
    .trim();

  // If URL was /api/assets/:id
  if (/^\d+$/.test(relPath)) {
    const assetId = Number(relPath);
    const asset = await assetModel.findAssetById(assetId);
    if (asset?.storage_key) {
      relPath = asset.storage_key.replace(/^uploads\//, '');
    } else if (asset?.filename) {
      relPath = asset.filename;
    }
  }

  if (!relPath) return false;

  const targetPath = path.resolve(UPLOAD_DIR, relPath);
  // Prevent path traversal
  if (!targetPath.startsWith(UPLOAD_DIR)) {
    console.warn('Security warning: attempted path traversal in deletePhysicalFile:', relativeOrFullUrl);
    return false;
  }

  try {
    await fs.unlink(targetPath);
    console.log('deletePhysicalFile: successfully unlinked:', targetPath);
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('deletePhysicalFile error:', err.message);
    }
    return false;
  }
}

export async function storePreviewFiles(front, back, designId, uploaderId) {
  const result = {};

  if (front && front.startsWith('data:')) {
    try {
      const stored = await storeDataUrl(front, `design-${designId}-front.png`, uploaderId, { designId, side: 'front', type: 'designs', automated: true });
      result.front = stored.id ? `/api/assets/${stored.id}` : (stored.filename ? `/uploads/${stored.filename}` : undefined);
    } catch (e) {
      console.error(`storage.service: failed to store front preview for design ${designId}`, e);
    }
  }

  if (back && back.startsWith('data:')) {
    try {
      const stored = await storeDataUrl(back, `design-${designId}-back.png`, uploaderId, { designId, side: 'back', type: 'designs', automated: true });
      result.back = stored.id ? `/api/assets/${stored.id}` : (stored.filename ? `/uploads/${stored.filename}` : undefined);
    } catch (e) {
      console.error(`storage.service: failed to store back preview for design ${designId}`, e);
    }
  }

  return result;
}

export default { ensureUploadDir, storeDataUrl, deletePhysicalFile, storePreviewFiles };
