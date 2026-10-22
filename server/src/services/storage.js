import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from '../../db.js';
import { assets as assetsTable } from "@shared/schema";
import * as assetStore from './assetStore.js';
function normalizeV2ToLegacy(input) {
  const defaultPos = { x: 150, y: 150 };
  const front = (input.version?.sides || []).find((s) => s.name === "front") || input.version?.sides && input.version.sides[0] || null;
  let slogan = null;
  let textSize = 24;
  let textRotation = 0;
  let textPosition = { x: 150, y: 135 };
  let image = void 0;
  let imageScale = 100;
  let imageRotation = 0;
  let imagePosition = defaultPos;
  if (front && Array.isArray(front.layers)) {
    const textLayer = front.layers.find((l) => l.type === "text");
    const imageLayer = front.layers.find((l) => l.type === "image");
    if (textLayer) {
      slogan = textLayer.text ?? "";
      textSize = textLayer.size ?? textSize;
      textRotation = textLayer.rotation ?? textRotation;
      if (textLayer.position) textPosition = textLayer.position;
    }
    if (imageLayer) {
      image = imageLayer.asset?.dataUrl ?? void 0;
      imageScale = typeof imageLayer.scale === "number" ? Math.round(imageLayer.scale * 100) : imageScale;
      imageRotation = imageLayer.rotation ?? imageRotation;
      if (imageLayer.position) imagePosition = imageLayer.position;
    }
  }
  try {
    const meta = input.version?.metadata || {};
    if (meta?.preview_front) {
      image = meta.preview_front;
    }
  } catch (e) {
  }
  const legacy = {
    slogan,
    color: input.templateColor || "#ffffff",
    textSize,
    textRotation,
    textPosition,
    image,
    imageScale,
    imageRotation,
    imagePosition,
    product: input.product || "T-shirt",
    template: input.template || "tshirt",
    templateColor: input.templateColor || "#ffffff",
    owner_id: input.owner_id || null,
    // keep original v2 payload for future migration/inspection
    version: input.version
  };
  try {
    const meta = input.version?.metadata || {};
    if (meta?.preview_back) {
      legacy.back_image = meta.preview_back;
    }
  } catch (e) {
  }
  return legacy;
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export class JsonStorage {
  filePath = path.join(__dirname, "../../designs.json");
  cache = null;
  CACHE_TTL_MS = 2500;
  // small TTL for dev responsiveness
  async readData() {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < this.CACHE_TTL_MS) {
      return this.cache.data;
    }
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      try {
        const parsed = JSON.parse(data);
        const mapped = parsed.map((d) => ({ ...d, createdAt: new Date(d.createdAt) }));
        this.cache = { data: mapped, ts: now };
        return mapped;
      } catch (parseErr) {
        const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
        console.error("Storage: corrupted JSON detected, backing up to", corruptPath);
        await fs.rename(this.filePath, corruptPath);
        await fs.writeFile(this.filePath, "[]");
        this.cache = { data: [], ts: now };
        return [];
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        this.cache = { data: [], ts: now };
        return [];
      }
      throw error;
    }
  }
  async writeData(designs) {
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(designs, null, 2));
    await fs.rename(tmpPath, this.filePath);
    this.cache = { data: designs, ts: Date.now() };
  }
  async createDesign(insertDesign) {
    const designs = await this.readData();
    let toStore = insertDesign;
    if (insertDesign.version) {
      toStore = normalizeV2ToLegacy(insertDesign);
    }
    const newDesign = {
      ...toStore,
      product: toStore.product || "T-shirt",
      template: toStore.template || "tshirt",
      templateColor: toStore.templateColor || "#ffffff",
      id: designs.length + 1,
      createdAt: /* @__PURE__ */ new Date()
    };
    const writePreviewIfDataUrl = async (dataUrl, suffix) => {
      if (!dataUrl || typeof dataUrl !== "string") return null;
      if (!dataUrl.startsWith("data:")) return null;
      const m = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/);
      if (!m) return null;
      const mime = m[1];
      const b64 = m[2];
      const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "png";
      const filename = `design-${newDesign.id}-${suffix}.${ext}`;
      const outDir = path.join(__dirname, "..", "..", "..", "client", "attached_assets");
      try {
        await fs.mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, filename);
        console.log("storage: writing preview file to", outPath);
        const buf = Buffer.from(b64, "base64");
        await fs.writeFile(outPath, buf);
        console.log("storage: wrote preview file", outPath);
        try {
          if (db) {
            const storageKey = `client/attached_assets/${filename}`;
            const previewMeta = { preview: true, selected_colors: insertDesign?.version?.metadata?.selected_colors || null, featured_color: insertDesign?.version?.metadata?.featured_color || null };
            const res = await db.insert(assetsTable).values({ filename, mime, size: buf.length, storage_key: storageKey, metadata: previewMeta }).returning();
            console.log("storage: inserted asset row", res?.[0]?.id);
          }
        } catch (ee) {
          console.error("storage: failed to insert asset row", ee && (ee.stack || ee.message) ? ee.stack || ee.message : ee);
        }
        return filename;
      } catch (e) {
        console.error("Failed to write preview file", e && (e.stack || e.message) ? e.stack || e.message : e);
        return null;
      }
    };
    designs.push(newDesign);
    console.log("json.createDesign: stored design id=", newDesign.id, "hasVersion=", !!insertDesign.version);
    async function replaceDataUrlsInObject(obj, idPrefix) {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const v = obj[i];
          if (typeof v === "string" && v.startsWith("data:")) {
            try {
              const res = await assetStore.storeDataUrl(v, `${idPrefix}-${i}`);
              if (res && res.id) obj[i] = `/api/assets/${res.id}`;
              else if (res && res.filename) obj[i] = `/attached_assets/${res.filename}`;
            } catch (e) {
            }
          } else if (typeof v === "object") {
            await replaceDataUrlsInObject(v, `${idPrefix}-${i}`);
          }
        }
        return;
      }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string" && v.startsWith("data:")) {
          try {
            const res = await assetStore.storeDataUrl(v, `${idPrefix}-${k}`);
            if (res && res.id) obj[k] = `/api/assets/${res.id}`;
            else if (res && res.filename) obj[k] = `/attached_assets/${res.filename}`;
          } catch (e) {
          }
        } else if (typeof v === "object") {
          await replaceDataUrlsInObject(v, `${idPrefix}-${k}`);
        }
      }
    }
    try {
      if (newDesign.version) {
        await replaceDataUrlsInObject(newDesign.version, `design-${newDesign.id}-version`);
      }
    } catch (e) {
      console.error("storage: failed to sanitize version images", e && (e.stack || e.message) ? e.stack || e.message : e);
    }
    try {
      if (newDesign.image && typeof newDesign.image === "string" && newDesign.image.startsWith("data:")) {
        const fname = await writePreviewIfDataUrl(newDesign.image, "front");
        if (fname) {
          newDesign.image = `/attached_assets/${fname}`;
          if (toStore?.version?.metadata) {
            toStore.version.metadata.preview_front = newDesign.image;
          }
        }
      }
      if (newDesign.back_image && typeof newDesign.back_image === "string" && newDesign.back_image.startsWith("data:")) {
        const fname = await writePreviewIfDataUrl(newDesign.back_image, "back");
        if (fname) {
          newDesign.back_image = `/attached_assets/${fname}`;
          if (toStore?.version?.metadata) {
            toStore.version.metadata.preview_back = newDesign.back_image;
          }
        }
      }
    } catch (e) {
    }
    await this.writeData(designs);
    try {
      const { generateMaskFromBase64 } = await import('./maskGenerator.js');
      let updated = false;
      const MAX_INLINE_IMAGE_BYTES = 300 * 1024;
      if (newDesign.image && typeof newDesign.image === "string" && newDesign.image.startsWith("data:")) {
        try {
          const sizeBytes = Buffer.byteLength(newDesign.image, "utf8");
          if (sizeBytes <= MAX_INLINE_IMAGE_BYTES) {
            const r = await generateMaskFromBase64(newDesign.image, `design-${newDesign.id}-front`);
            if (r) {
              if (r.composite) newDesign.image = r.composite;
              newDesign.image_mask = r.mask;
              updated = true;
            }
          } else {
            console.warn("Skipping mask generation for front image because it is too large");
          }
        } catch (e) {
        }
      }
      if (newDesign.back_image && typeof newDesign.back_image === "string" && newDesign.back_image.startsWith("data:")) {
        try {
          const sizeBytes = Buffer.byteLength(newDesign.back_image, "utf8");
          if (sizeBytes <= MAX_INLINE_IMAGE_BYTES) {
            const r = await generateMaskFromBase64(newDesign.back_image, `design-${newDesign.id}-back`);
            if (r) {
              if (r.composite) newDesign.back_image = r.composite;
              newDesign.back_image_mask = r.mask;
              updated = true;
            }
          } else {
            console.warn("Skipping mask generation for back image because it is too large");
          }
        } catch (e) {
        }
      }
      if (updated) {
        const idx = designs.findIndex((d) => d.id === newDesign.id);
        if (idx !== -1) {
          designs[idx] = newDesign;
          await this.writeData(designs);
        }
      }
    } catch (e) {
    }
    return newDesign;
  }
  async getDesigns(limit, userId) {
    let designs = await this.readData();
    if (userId !== void 0 && userId !== null) {
      designs = designs.filter((d) => d.owner_id === userId);
    }
    if (typeof limit === "number") return designs.slice(0, limit);
    return designs;
  }
  async getDesign(id, userId) {
    const designs = await this.readData();
    const d = designs.find((d2) => d2.id === id);
    if (userId !== void 0 && userId !== null && d && d.owner_id !== userId) return void 0;
    return d;
  }
  async updateDesign(id, changes, userId) {
    const designs = await this.readData();
    const idx = designs.findIndex((d) => d.id === id);
    if (idx === -1) return void 0;
    if (userId !== void 0 && userId !== null && designs[idx].owner_id !== userId) return void 0;
    const updated = { ...designs[idx], ...changes };
    const writePreviewIfDataUrl = async (dataUrl, suffix) => {
      if (!dataUrl || typeof dataUrl !== "string") return null;
      if (!dataUrl.startsWith("data:")) return null;
      const m = String(dataUrl).match(/^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/);
      if (!m) return null;
      const mime = m[1];
      const b64 = m[2];
      const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "png";
      const filename = `design-${id}-${suffix}.${ext}`;
      const outDir = path.join(__dirname, "..", "..", "..", "client", "attached_assets");
      try {
        await fs.mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, filename);
        console.log("storage:update: writing preview file to", outPath);
        const buf = Buffer.from(b64, "base64");
        await fs.writeFile(outPath, buf);
        console.log("storage:update: wrote preview file", outPath);
        try {
          if (db) {
            const storageKey = `client/attached_assets/${filename}`;
            const previewMeta = { preview: true, selected_colors: changes?.version?.metadata?.selected_colors || null, featured_color: changes?.version?.metadata?.featured_color || null };
            const res = await db.insert(assetsTable).values({ filename, mime, size: buf.length, storage_key: storageKey, metadata: previewMeta }).returning();
            console.log("storage:update: inserted asset row", res?.[0]?.id);
          }
        } catch (ee) {
          console.error("storage:update: failed to insert asset row", ee && (ee.stack || ee.message) ? ee.stack || ee.message : ee);
        }
        return filename;
      } catch (e) {
        console.error("Failed to write preview file", e && (e.stack || e.message) ? e.stack || e.message : e);
        return null;
      }
    };
    try {
      if (changes.image && typeof changes.image === "string" && changes.image.startsWith("data:")) {
        const fname = await writePreviewIfDataUrl(changes.image, "front");
        if (fname) {
          updated.image = `/attached_assets/${fname}`;
          if (updated.version?.metadata) {
            updated.version.metadata.preview_front = updated.image;
          }
        } else {
          updated.image = changes.image;
        }
      }
      if (changes.back_image && typeof changes.back_image === "string" && changes.back_image.startsWith("data:")) {
        const fname = await writePreviewIfDataUrl(changes.back_image, "back");
        if (fname) {
          updated.back_image = `/attached_assets/${fname}`;
          if (updated.version?.metadata) {
            updated.version.metadata.preview_back = updated.back_image;
          }
        } else {
          updated.back_image = changes.back_image;
        }
      }
    } catch (e) {
    }
    async function replaceDataUrlsInObject_update(obj, idPrefix) {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const v = obj[i];
          if (typeof v === "string" && v.startsWith("data:")) {
            try {
              const res = await assetStore.storeDataUrl(v, `${idPrefix}-${i}`);
              if (res && res.id) obj[i] = `/api/assets/${res.id}`;
              else if (res && res.filename) obj[i] = `/attached_assets/${res.filename}`;
            } catch (e) {
            }
          } else if (typeof v === "object") {
            await replaceDataUrlsInObject_update(v, `${idPrefix}-${i}`);
          }
        }
        return;
      }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string" && v.startsWith("data:")) {
          try {
            const res = await assetStore.storeDataUrl(v, `${idPrefix}-${k}`);
            if (res && res.id) obj[k] = `/api/assets/${res.id}`;
            else if (res && res.filename) obj[k] = `/attached_assets/${res.filename}`;
          } catch (e) {
          }
        } else if (typeof v === "object") {
          await replaceDataUrlsInObject_update(v, `${idPrefix}-${k}`);
        }
      }
    }
    try {
      if (updated.version) {
        await replaceDataUrlsInObject_update(updated.version, `design-${id}-version`);
      }
    } catch (e) {
      console.error("storage:update: failed to sanitize version images", e && (e.stack || e.message) ? e.stack || e.message : e);
    }
    designs[idx] = updated;
    await this.writeData(designs);
    try {
      const { generateMaskFromBase64 } = await import('./maskGenerator.js');
      let changed = false;
      const MAX_INLINE_IMAGE_BYTES = 300 * 1024;
      if (changes.image && typeof changes.image === "string" && changes.image.startsWith("data:")) {
        try {
          const sizeBytes = Buffer.byteLength(changes.image, "utf8");
          if (sizeBytes <= MAX_INLINE_IMAGE_BYTES) {
            const r = await generateMaskFromBase64(changes.image, `design-${id}-front`);
            if (r) {
              if (r.composite) updated.image = r.composite;
              updated.image_mask = r.mask;
              changed = true;
            }
          } else {
            console.warn("Skipping mask generation for front image because it is too large");
          }
        } catch (e) {
        }
      }
      if (changes.back_image && typeof changes.back_image === "string" && changes.back_image.startsWith("data:")) {
        try {
          const sizeBytes = Buffer.byteLength(changes.back_image, "utf8");
          if (sizeBytes <= MAX_INLINE_IMAGE_BYTES) {
            const r = await generateMaskFromBase64(changes.back_image, `design-${id}-back`);
            if (r) {
              if (r.composite) updated.back_image = r.composite;
              updated.back_image_mask = r.mask;
              changed = true;
            }
          } else {
            console.warn("Skipping mask generation for back image because it is too large");
          }
        } catch (e) {
        }
      }
      if (changed) {
        designs[idx] = updated;
        await this.writeData(designs);
      }
    } catch (e) {
    }
    return updated;
  }
  async deleteDesign(id, userId) {
    const designs = await this.readData();
    const idx = designs.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    if (userId !== void 0 && userId !== null && designs[idx].owner_id !== userId) return false;
    designs.splice(idx, 1);
    await this.writeData(designs);
    return true;
  }
}
let storageImpl;
let storageType = "json";
try {
  const { dbStorage } = await import('../../storage-db.js');
  const dbConfigured = !!(process.env.DATABASE_URL || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD);
  if (dbConfigured) {
    storageImpl = dbStorage;
    storageType = "db";
    console.log("Using Postgres-backed storage");
  }
} catch (e) {
}
if (!storageImpl) {
  storageImpl = new JsonStorage();
  storageType = "json";
  console.log("Using JSON file storage");
}
export const storage = storageImpl;
export function getStorageType() {
  return storageType;
}
