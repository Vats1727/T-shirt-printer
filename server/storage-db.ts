import { db } from "./db";
import { designs, assets as assetsTable, design_versions } from "./shared/schema";
import type { Design, InsertDesign, InsertDesignV2 } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storeDataUrl, storePreviewFiles } from './src/services/assetStore';

export class DbStorage {
  private normalizeV2ToLegacy(input: InsertDesignV2): InsertDesign & { version?: any } {
    const defaultPos = { x: 150, y: 150 };
    const front = (input.version?.sides || []).find((s: any) => s.name === 'front') || (input.version?.sides && input.version.sides[0]) || null;
    let slogan: any = null;
    let textSize = 24;
    let textRotation = 0;
    let textPosition: any = { x: 150, y: 135 };
    let image: any = undefined;
    let imageScale = 100;
    let imageRotation = 0;
    let imagePosition: any = defaultPos;

    if (front && Array.isArray(front.layers)) {
      const textLayer = front.layers.find((l: any) => l.type === 'text');
      const imageLayer = front.layers.find((l: any) => l.type === 'image');
      if (textLayer) {
        slogan = textLayer.text ?? '';
        textSize = textLayer.size ?? textSize;
        textRotation = textLayer.rotation ?? textRotation;
        if (textLayer.position) textPosition = textLayer.position;
      }
      if (imageLayer) {
        image = imageLayer.asset?.dataUrl ?? undefined;
        imageScale = typeof imageLayer.scale === 'number' ? Math.round(imageLayer.scale * 100) : imageScale;
        imageRotation = imageLayer.rotation ?? imageRotation;
        if (imageLayer.position) imagePosition = imageLayer.position;
      }
    }

    const legacy: any = {
      slogan,
      color: (input.templateColor as any) || '#ffffff',
      textSize,
      textRotation,
      textPosition,
      image,
      imageScale,
      imageRotation,
      imagePosition,
      product: input.product || 'T-shirt',
      template: input.template || 'tshirt',
      templateColor: input.templateColor || '#ffffff',
      version: input.version,
    };

    return legacy as InsertDesign & { version?: any };
  }

  async createDesign(insertDesign: InsertDesign | InsertDesignV2): Promise<Design> {
    // If this is a v2 payload with `version`, create a designs row and a design_versions row
    if ((insertDesign as any).version) {
      console.log('storage-db.createDesign: v2 payload detected — creating design row + version rows');
      const v = insertDesign as InsertDesignV2;
      // create a minimal designs row to own the versions
      const [designRow] = await db.insert(designs).values({
        slogan: null,
        color: v.templateColor || '#ffffff',
        textSize: 24 as any,
        textRotation: 0 as any,
        textPosition: { x: 150, y: 135 } as any,
        image: null,
        imageScale: 100 as any,
        imageRotation: 0 as any,
        imagePosition: { x: 150, y: 150 } as any,
        product: v.product || 'T-shirt',
        template: v.template || 'tshirt',
        templateColor: v.templateColor || '#ffffff',
      }).returning();

      const designId = (designRow as any).id;

      // deep-clone payload so we can mutate asset refs
      // include top-level template/product fields so versions are self-contained
      const payload: any = {
        ...JSON.parse(JSON.stringify(v.version)),
        template: v.template,
        templateColor: v.templateColor,
        product: v.product,
      };

      // Process assets: for each side.layer.asset.dataUrl -> store file and create assets row
      for (const side of (payload.sides || [])) {
        for (const layer of (side.layers || [])) {
          if (layer.type === 'image' && layer.asset && layer.asset.dataUrl && typeof layer.asset.dataUrl === 'string') {
            try {
              const info = await storeDataUrl(layer.asset.dataUrl, undefined);
              // insert asset row
              const [assetRow] = await db.insert(assetsTable).values({
                filename: info.filename,
                mime: info.mime,
                size: info.size,
                storage_key: info.storageKey,
                metadata: { uploadedBy: 'supplier' },
              }).returning();
              const assetId = (assetRow as any).id;
              // replace inline dataUrl with asset reference
              layer.asset = { asset_id: assetId, storage_key: info.storageKey };
            } catch (e) {
              // on failure, keep original dataUrl
            }
          }
        }
      }

      // insert design_versions row
      let dvRow: any = null;
      try {
        dvRow = (await db.insert(design_versions).values({
          design_id: designId,
          version_name: v.version.versionName || null,
          payload: payload,
          price_cents: (insertDesign as any).price_cents ?? null,
          currency: (insertDesign as any).currency || 'USD',
          processing_state: 'pending',
        }).returning())[0];

        // debug: log dvRow existence
        // eslint-disable-next-line no-console
        console.log('storage-db.createDesign: inserted design_version id=', dvRow?.id, 'for design id=', designId);
      } catch (e) {
        // log full error and attempt a safe fallback insert using a sanitized payload
        console.error('storage-db.createDesign: failed to insert design_versions row:', e && (e.stack || e.message) ? (e.stack || e.message) : e);
        try {
          // try to sanitize payload to plain JSON (remove unexpected values)
          const safePayload = JSON.parse(JSON.stringify(payload));
          dvRow = (await db.insert(design_versions).values({
            design_id: designId,
            version_name: v.version.versionName || null,
            payload: safePayload,
            price_cents: (insertDesign as any).price_cents ?? null,
            currency: (insertDesign as any).currency || 'USD',
            processing_state: 'pending',
          }).returning())[0];
          console.log('storage-db.createDesign: fallback insert succeeded, dv id=', dvRow?.id);
        } catch (e2) {
          console.error('storage-db.createDesign: fallback insert also failed:', e2 && (e2.stack || e2.message) ? (e2.stack || e2.message) : e2);
          // Do not throw — we will continue and return designRow, but record the failure in logs so you can investigate
        }
      }

      // store preview images / pdf (if provided in metadata)
      try {
        const frontPreview = payload?.metadata?.preview_front || null;
        const backPreview = payload?.metadata?.preview_back || null;
        if (frontPreview || backPreview) {
          const info = await storePreviewFiles(designId, frontPreview, backPreview);
          if (info?.images && Array.isArray(info.images)) {
            for (const img of info.images) {
              await db.insert(assetsTable).values({
                filename: img.filename,
                mime: img.mime,
                size: img.size,
                storage_key: img.storageKey,
                metadata: { designId, preview: true },
              }).returning();
            }
          }
          if (info?.pdf) {
            await db.insert(assetsTable).values({
              filename: info.pdf.filename,
              mime: info.pdf.mime,
              size: info.pdf.size,
              storage_key: info.pdf.storageKey,
              metadata: { designId, preview: true, pdf: true },
            }).returning();
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to store previews', e);
      }

      // return the base designs row and include created version id for convenience
      return {
        ...designRow,
        createdVersionId: (dvRow as any).id,
      } as Design & { createdVersionId?: number };

    }

    // legacy path
    let toInsert: any = insertDesign;
    if ((insertDesign as any).version) {
      toInsert = this.normalizeV2ToLegacy(insertDesign as InsertDesignV2);
    }
    const [row] = await db.insert(designs).values(toInsert).returning();
    return row as Design;
  }

  async getDesigns(limit?: number): Promise<Design[]> {
    let q = db.select().from(designs).orderBy(designs.id);
    if (typeof limit === 'number') q = q.limit(limit);
    const rows = await q;
    return rows as Design[];
  }

  async getDesign(id: number): Promise<Design | undefined> {
    const rows = await db.select().from(designs).where(eq(designs.id, id));
    return (rows as Design[])[0];
  }

  async updateDesign(id: number, changes: Partial<InsertDesign>): Promise<Design | undefined> {
    const [row] = await db.update(designs).set(changes).where(eq(designs.id, id)).returning();
    return row as Design | undefined;
  }

  async deleteDesign(id: number): Promise<boolean> {
    const res = await db.delete(designs).where(eq(designs.id, id));
    return (res.rowCount || 0) > 0;
  }
}

export const dbStorage = new DbStorage();