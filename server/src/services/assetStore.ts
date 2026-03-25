import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { db } from '../../db';
import { assets as assetsTable } from '@shared/schema';
import { eq } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (e) { }
}

function mimeToExt(mime: string | undefined) {
  if (!mime) return 'bin';
  const m = mime.split('/')[1];
  if (!m) return 'bin';
  return m.split('+')[0];
}

export async function storeDataUrl(dataUrl: string, filenameHint?: string, uploaderId?: number | null, metadata?: any) {
  await ensureUploadDir();
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid dataUrl');
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, 'base64');
  const ext = mimeToExt(mime);
  const id = crypto.randomBytes(10).toString('hex');
  const sanitizedHint = filenameHint ? filenameHint.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-0\.\-_]/g, '_') : '';
  const filename = sanitizedHint ? `${id}-${sanitizedHint}` : `${id}.${ext}`;
  const storageKey = `uploads/${filename}`;
  const outPath = path.join(__dirname, '../../', storageKey);
  await fs.writeFile(outPath, buf);
  // Insert into assets table if DB is available so uploaded assets are discoverable
  try {
    if (db) {
      const clientPath = `client/attached_assets/${filename}`;
      const finalMetadata = { ...metadata, uploaded: true, client_copy: clientPath };
      const res = await db.insert(assetsTable).values({ filename, mime, size: buf.length, storage_key: storageKey, metadata: finalMetadata, uploader_id: uploaderId }).returning();
      // eslint-disable-next-line no-console
      console.log('assetStore: inserted asset row', res?.[0]?.id);
    }
  } catch (e) {
    console.error('assetStore: failed to insert asset row', e && (e.stack || e.message) ? (e.stack || e.message) : e);
  }
  // Also write a copy into the client attached_assets folder for local dev preview
  try {
    const clientOutDir = path.join(__dirname, '..', '..', 'client', 'attached_assets');
    await fs.mkdir(clientOutDir, { recursive: true });
    const clientOutPath = path.join(clientOutDir, filename);
    await fs.writeFile(clientOutPath, buf);
  } catch (e) {
    // best-effort: do not fail the upload when copying to client folder
    // log the error for debugging
    // eslint-disable-next-line no-console
    console.error('assetStore: failed to copy upload to client/attached_assets', e);
  }
  // Return DB id when available so callers can reference /api/assets/:id
  try {
    if (db) {
      const rows = await db.select().from(assetsTable).where(eq(assetsTable.filename, filename));
      const inserted = (rows as any[])[0];
      if (inserted && inserted.id) return { storageKey, filename, mime, size: buf.length, id: inserted.id };
    }
  } catch (e) {
    // ignore lookup errors
  }
  return { storageKey, filename, mime, size: buf.length };
}

/**
 * Stores front and back preview images (DataURLs) as files and returns their URLs or asset IDs.
 */
export async function storePreviewFiles(front: string | null, back: string | null, designId: number, uploaderId?: number | null) {
  const result: { front?: string; back?: string } = {};
  
  if (front && front.startsWith('data:')) {
    try {
      const stored = await storeDataUrl(front, `design-${designId}-front.png`, uploaderId, { designId, side: 'front', automated: true });
      result.front = stored.id ? `/api/assets/${stored.id}` : (stored.filename ? `/attached_assets/${stored.filename}` : undefined);
    } catch (e) {
      console.error(`assetStore: failed to store front preview for design ${designId}`, e);
    }
  }

  if (back && back.startsWith('data:')) {
    try {
      const stored = await storeDataUrl(back, `design-${designId}-back.png`, uploaderId, { designId, side: 'back', automated: true });
      result.back = stored.id ? `/api/assets/${stored.id}` : (stored.filename ? `/attached_assets/${stored.filename}` : undefined);
    } catch (e) {
      console.error(`assetStore: failed to store back preview for design ${designId}`, e);
    }
  }

  return result;
}
