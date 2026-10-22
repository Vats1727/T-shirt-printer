import { db } from './db.js';
import { designs, assets as assetsTable, design_versions } from './shared/schema.js';
import { eq, and } from "drizzle-orm";
import { storeDataUrl, storePreviewFiles } from './src/services/assetStore.js';
export class DbStorage {
  normalizeV2ToLegacy(input) {
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
      version: input.version
    };
    return legacy;
  }
  async createDesign(insertDesign) {
    if (insertDesign.version) {
      console.log("storage-db.createDesign: v2 payload detected \u2014 creating design row + version rows");
      const v = insertDesign;
      const [designRow] = await db.insert(designs).values({
        slogan: null,
        color: v.templateColor || "#ffffff",
        textSize: 24,
        textRotation: 0,
        textPosition: { x: 150, y: 135 },
        image: null,
        imageScale: 100,
        imageRotation: 0,
        imagePosition: { x: 150, y: 150 },
        product: v.product || "T-shirt",
        template: v.template || "tshirt",
        templateColor: v.templateColor || "#ffffff",
        owner_id: v.owner_id || null
      }).returning();
      const designId = designRow.id;
      const payload = {
        ...JSON.parse(JSON.stringify(v.version)),
        template: v.template,
        templateColor: v.templateColor,
        product: v.product
      };
      for (const side of payload.sides || []) {
        for (const layer of side.layers || []) {
          if (layer.type === "image" && layer.asset && layer.asset.dataUrl && typeof layer.asset.dataUrl === "string") {
            try {
              const info = await storeDataUrl(layer.asset.dataUrl, void 0);
              const [assetRow] = await db.insert(assetsTable).values({
                filename: info.filename,
                mime: info.mime,
                size: info.size,
                storage_key: info.storageKey,
                metadata: { uploadedBy: "supplier" }
              }).returning();
              const assetId = assetRow.id;
              layer.asset = { asset_id: assetId, storage_key: info.storageKey };
            } catch (e) {
            }
          }
        }
      }
      let dvRow = null;
      try {
        dvRow = (await db.insert(design_versions).values({
          design_id: designId,
          version_name: v.version.versionName || null,
          payload,
          price_cents: insertDesign.price_cents ?? null,
          currency: insertDesign.currency || "USD",
          processing_state: "pending"
        }).returning())[0];
        console.log("storage-db.createDesign: inserted design_version id=", dvRow?.id, "for design id=", designId);
      } catch (e) {
        console.error("storage-db.createDesign: failed to insert design_versions row:", e.stack || e.message || e);
        try {
          const safePayload = JSON.parse(JSON.stringify(payload));
          dvRow = (await db.insert(design_versions).values({
            design_id: designId,
            version_name: v.version.versionName || null,
            payload: safePayload,
            price_cents: insertDesign.price_cents ?? null,
            currency: insertDesign.currency || "USD",
            processing_state: "pending"
          }).returning())[0];
          console.log("storage-db.createDesign: fallback insert succeeded, dv id=", dvRow?.id);
        } catch (e2) {
          console.error("storage-db.createDesign: fallback insert also failed:", e.stack || e.message || e);
        }
      }
      try {
        const frontPreview = payload?.metadata?.preview_front || null;
        const backPreview = payload?.metadata?.preview_back || null;
        if (frontPreview || backPreview) {
          const info = await storePreviewFiles(frontPreview, backPreview, designId, v.owner_id);
          let modified = false;
          if (info.front && payload?.metadata) {
            payload.metadata.preview_front = info.front;
            modified = true;
          }
          if (info.back && payload?.metadata) {
            payload.metadata.preview_back = info.back;
            modified = true;
          }
          if (modified && dvRow) {
            await db.update(design_versions).set({ payload }).where(eq(design_versions.id, dvRow.id));
          }
        }
      } catch (e) {
        console.error("Failed to store previews", e);
      }
      return {
        ...designRow,
        createdVersionId: dvRow.id
      };
    }
    let toInsert = insertDesign;
    if (insertDesign.version) {
      toInsert = this.normalizeV2ToLegacy(insertDesign);
    }
    const [row] = await db.insert(designs).values(toInsert).returning();
    return row;
  }
  async getDesigns(limit, userId) {
    if (userId === void 0 || userId === null) {
      console.warn("storage-db.getDesigns: userId is missing/null, returning empty list for privacy");
      return [];
    }
    let q = db.select().from(designs).where(eq(designs.owner_id, userId)).orderBy(designs.id);
    if (typeof limit === "number") q = q.limit(limit);
    const rows = await q;
    const items = rows;
    for (const item of items) {
      try {
        const vRows = await db.select().from(design_versions).where(eq(design_versions.design_id, item.id)).orderBy(design_versions.id);
        if (vRows.length > 0) {
          const latest = vRows[vRows.length - 1];
          let p = latest.payload;
          if (typeof p === "string") {
            try {
              p = JSON.parse(p);
            } catch (e) {
            }
          }
          item.version = p;
        }
      } catch (e) {
      }
    }
    return items;
  }
  async getDesign(id, userId) {
    if (userId === void 0 || userId === null) {
      console.warn("storage-db.getDesign: userId is missing/null, returning undefined for privacy");
      return void 0;
    }
    const condition = and(eq(designs.id, id), eq(designs.owner_id, userId));
    const rows = await db.select().from(designs).where(condition);
    const design = rows[0];
    if (!design) return void 0;
    try {
      const vRows = await db.select().from(design_versions).where(eq(design_versions.design_id, id)).orderBy(design_versions.id);
      if (vRows.length > 0) {
        const latest = vRows[vRows.length - 1];
        let p = latest.payload;
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
          }
        }
        design.version = p;
      }
    } catch (e) {
    }
    return design;
  }
  async updateDesign(id, changes, userId) {
    if (userId === void 0 || userId === null) return void 0;
    const condition = and(eq(designs.id, id), eq(designs.owner_id, userId));
    const [row] = await db.update(designs).set(changes).where(condition).returning();
    return row;
  }
  async deleteDesign(id, userId) {
    if (userId === void 0 || userId === null) return false;
    const condition = and(eq(designs.id, id), eq(designs.owner_id, userId));
    const res = await db.delete(designs).where(condition);
    return (res.rowCount || 0) > 0;
  }
}
export const dbStorage = new DbStorage();
