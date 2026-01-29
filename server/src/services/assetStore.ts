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
  } catch (e) {}
}

function mimeToExt(mime: string | undefined) {
  if (!mime) return 'bin';
  const m = mime.split('/')[1];
  if (!m) return 'bin';
  return m.split('+')[0];
}

export async function storeDataUrl(dataUrl: string, filenameHint?: string) {
  await ensureUploadDir();
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid dataUrl');
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, 'base64');
  const ext = mimeToExt(mime);
  const id = crypto.randomBytes(10).toString('hex');
  const filename = filenameHint ? `${id}-${filenameHint}` : `${id}.${ext}`;
  const storageKey = `uploads/${filename}`;
  const outPath = path.join(__dirname, '../../', storageKey);
  await fs.writeFile(outPath, buf);
  // Insert into assets table if DB is available so uploaded assets are discoverable
  try {
    if (db) {
      const clientPath = `client/attached_assets/${filename}`;
      const res = await db.insert(assetsTable).values({ filename, mime, size: buf.length, storage_key: storageKey, metadata: { uploaded: true, client_copy: clientPath } }).returning();
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
