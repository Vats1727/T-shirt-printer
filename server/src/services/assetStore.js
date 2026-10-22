import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { db } from '../../db.js';
import { assets as assetsTable } from "@shared/schema";
import { eq } from "drizzle-orm";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (e) {
  }
}
function mimeToExt(mime) {
  if (!mime) return "bin";
  const m = mime.split("/")[1];
  if (!m) return "bin";
  return m.split("+")[0];
}
export async function storeDataUrl(dataUrl, filenameHint, uploaderId, metadata) {
  await ensureUploadDir();
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid dataUrl");
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, "base64");
  const ext = mimeToExt(mime);
  const id = crypto.randomBytes(10).toString("hex");
  const sanitizedHint = filenameHint ? filenameHint.replace(/[^\x00-\x7F]/g, "").replace(/[^a-zA-Z0-0\.\-_]/g, "_") : "";
  const filename = sanitizedHint ? `${id}-${sanitizedHint}` : `${id}.${ext}`;
  const storageKey = `uploads/${filename}`;
  const outPath = path.join(__dirname, "../../", storageKey);
  await fs.writeFile(outPath, buf);
  try {
    if (db) {
      const finalMetadata = { ...metadata, uploaded: true };
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
      if (inserted && inserted.id) return { storageKey, filename, mime, size: buf.length, id: inserted.id };
    }
  } catch (e) {
  }
  return { storageKey, filename, mime, size: buf.length };
}
export async function storePreviewFiles(front, back, designId, uploaderId) {
  const result = {};
  if (front && front.startsWith("data:")) {
    try {
      const stored = await storeDataUrl(front, `design-${designId}-front.png`, uploaderId, { designId, side: "front", automated: true });
      result.front = stored.id ? `/api/assets/${stored.id}` : stored.filename ? `/uploads/${stored.filename}` : void 0;
    } catch (e) {
      console.error(`assetStore: failed to store front preview for design ${designId}`, e);
    }
  }
  if (back && back.startsWith("data:")) {
    try {
      const stored = await storeDataUrl(back, `design-${designId}-back.png`, uploaderId, { designId, side: "back", automated: true });
      result.back = stored.id ? `/api/assets/${stored.id}` : stored.filename ? `/uploads/${stored.filename}` : void 0;
    } catch (e) {
      console.error(`assetStore: failed to store back preview for design ${designId}`, e);
    }
  }
  return result;
}
