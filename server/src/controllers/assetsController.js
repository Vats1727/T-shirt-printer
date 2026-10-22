import * as assetStore from '../services/assetStore.js';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from '../../db.js';
import { assets as assetsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
export async function uploadAsset(req, res) {
  try {
    const user = req.user;
    const { dataUrl, filename, metadata } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") return res.status(400).json({ message: "dataUrl is required" });
    const result = await assetStore.storeDataUrl(
      String(dataUrl),
      filename ? String(filename) : void 0,
      user?.sub || user?.id || null,
      metadata && typeof metadata === "object" ? metadata : void 0
    );
    if (result && result.id) {
      const id = result.id;
      return res.status(201).json({ id, url: `/api/assets/${id}`, filename: result.filename });
    }
    return res.status(201).json({ id: null, url: `/uploads/${result.filename}`, filename: result.filename });
  } catch (e) {
    console.error("uploadAsset error", e?.message || e);
    return res.status(500).json({ message: "Failed to upload asset" });
  }
}
export async function deleteAsset(req, res) {
  const user = req.user;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    let row = null;
    if (db) {
      const userId = user?.sub || user?.id || null;
      const isAdmin = user?.role === "admin" || user?.role === "portal_admin";
      const rows = isAdmin ? await db.select().from(assetsTable).where(eq(assetsTable.id, id)) : await db.select().from(assetsTable).where(
        and(
          eq(assetsTable.id, id),
          eq(assetsTable.uploader_id, userId)
        )
      );
      row = rows[0];
      if (!row) return res.status(404).json({ message: "Asset not found or not owned by you" });
    }
    try {
      const candidates = /* @__PURE__ */ new Set();
      if (row?.filename) {
        candidates.add(path.resolve(UPLOAD_DIR, row.filename));
        candidates.add(path.resolve(process.cwd(), "uploads", row.filename));
        candidates.add(path.resolve(process.cwd(), "server", "uploads", row.filename));
      }
      if (row?.storage_key) {
        candidates.add(path.resolve(UPLOAD_DIR, path.basename(row.storage_key)));
        candidates.add(path.resolve(process.cwd(), row.storage_key));
        candidates.add(path.resolve(process.cwd(), "server", row.storage_key));
      }
      for (const p of candidates) {
        try {
          await fs.unlink(p);
          console.log("deleteAsset: physically unlinked file:", p);
        } catch (e) {
        }
      }
    } catch (e) {
      console.warn("deleteAsset: file cleanup warning:", e);
    }
    if (db) {
      await db.delete(assetsTable).where(eq(assetsTable.id, id));
      return res.status(204).end();
    }
    return res.status(204).end();
  } catch (e) {
    console.error("deleteAsset error", e?.message || e);
    return res.status(500).json({ message: "Failed to delete asset" });
  }
}
export default { uploadAsset, deleteAsset };
