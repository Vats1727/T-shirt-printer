import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { db } from '../../db.js';
import { assets as assetsTable } from "@shared/schema";
import { eq } from "drizzle-orm";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, "farmo/front"), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, "farmo/back"), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, "artwork/front"), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, "artwork/back"), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, "designs/front"), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, "designs/back"), { recursive: true });
  } catch (e) {
  }
}

function mimeToExt(mime) {
  if (!mime) return "bin";
  const m = mime.split("/")[1];
  if (!m) return "bin";
  return m.split("+")[0];
}

export async function storeDataUrl(dataUrl, filenameHint, uploaderId, metadata = {}) {
  await ensureUploadDir();
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid dataUrl");
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, "base64");
  const ext = mimeToExt(mime);

  // Subfolder categorization:
  // 1. Farmo garment images (print provider blanks) -> farmo/front or farmo/back
  // 2. Automated canvas previews/mockups (automated design previews) -> designs/front or designs/back
  // 3. ALL designer uploaded artworks, logos, layer graphics -> artwork/front or artwork/back (default)
  let type = 'artwork';
  if (metadata?.type === 'farmo') {
    type = 'farmo';
  } else if (metadata?.type === 'designs' && metadata?.automated) {
    type = 'designs';
  }
  const side = metadata?.side === 'back' ? 'back' : 'front';
  const subFolder = metadata?.subFolder || `${type}/${side}`;

  const targetDir = path.resolve(UPLOAD_DIR, subFolder);
  await fs.mkdir(targetDir, { recursive: true });

  const id = crypto.randomBytes(10).toString("hex");
  const sanitizedHint = filenameHint ? filenameHint.replace(/[^\x00-\x7F]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_") : "";
  const fileBasename = sanitizedHint ? `${id}-${sanitizedHint}` : `${id}.${ext}`;
  const filename = `${subFolder}/${fileBasename}`;
  const storageKey = `uploads/${filename}`;
  const outPath = path.resolve(targetDir, fileBasename);
  await fs.writeFile(outPath, buf);

  try {
    if (db) {
      const finalMetadata = { ...metadata, type, side, subFolder, uploaded: true };
      const res = await db.insert(assetsTable).values({ filename, mime, size: buf.length, storage_key: storageKey, metadata: finalMetadata, uploader_id: uploaderId }).returning();
      console.log("assetStore: inserted asset row", res?.[0]?.id);
    }
  } catch (e) {
    console.error("assetStore: failed to insert asset row", e && (e.stack || e.message) ? e.stack || e.message : e);
  }
  try {
    if (db) {
      const rows = await db.select().from(assetsTable).where(eq(assetsTable.filename, filename));
      const inserted = rows[0];
      if (inserted && inserted.id) return { storageKey, filename, mime, size: buf.length, id: inserted.id, url: `/uploads/${filename}` };
    }
  } catch (e) {
  }
  return { storageKey, filename, mime, size: buf.length, url: `/uploads/${filename}` };
}

export async function storePreviewFiles(front, back, designId, uploaderId) {
  const result = {};
  if (front && front.startsWith("data:")) {
    try {
      const stored = await storeDataUrl(front, `design-${designId}-front.png`, uploaderId, { designId, side: "front", type: "designs", automated: true });
      result.front = stored.id ? `/api/assets/${stored.id}` : stored.filename ? `/uploads/${stored.filename}` : void 0;
    } catch (e) {
      console.error("storePreviewFiles front error", e?.message || e);
    }
  }
  if (back && back.startsWith("data:")) {
    try {
      const stored = await storeDataUrl(back, `design-${designId}-back.png`, uploaderId, { designId, side: "back", type: "designs", automated: true });
      result.back = stored.id ? `/api/assets/${stored.id}` : stored.filename ? `/uploads/${stored.filename}` : void 0;
    } catch (e) {
      console.error("storePreviewFiles back error", e?.message || e);
    }
  }
  return result;
}
