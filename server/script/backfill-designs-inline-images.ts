import fs from 'fs/promises';
import path from 'path';
import * as assetStore from '../src/services/assetStore';

(async () => {
  try {
    const designsFile = path.join(__dirname, '..', 'designs.json');
    const raw = await fs.readFile(designsFile, 'utf8');
    const parsed = JSON.parse(raw || '[]') as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('No designs found to backfill');
      process.exit(0);
    }

    const backupPath = `${designsFile}.bak-${Date.now()}`;
    await fs.copyFile(designsFile, backupPath);
    console.log('Backed up designs.json to', backupPath);

    async function replaceDataUrls(obj: any, idPrefix: string) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const v = obj[i];
          if (typeof v === 'string' && v.startsWith('data:')) {
            try {
              const res = await assetStore.storeDataUrl(v, `${idPrefix}-${i}`);
              if (res && (res as any).id) obj[i] = `/api/assets/${(res as any).id}`;
              else if (res && (res as any).filename) obj[i] = `/attached_assets/${res.filename}`;
            } catch (e) {
              console.error('Failed to store data url for array index', i, e);
            }
          } else if (typeof v === 'object') {
            await replaceDataUrls(v, `${idPrefix}-${i}`);
          }
        }
        return;
      }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string' && v.startsWith('data:')) {
          try {
            const res = await assetStore.storeDataUrl(v, `${idPrefix}-${k}`);
            if (res && (res as any).id) obj[k] = `/api/assets/${(res as any).id}`;
            else if (res && (res as any).filename) obj[k] = `/attached_assets/${res.filename}`;
          } catch (e) {
            console.error('Failed to store data url for key', k, e);
          }
        } else if (typeof v === 'object') {
          await replaceDataUrls(v, `${idPrefix}-${k}`);
        }
      }
    }

    let modified = false;
    for (const d of parsed) {
      const id = d && d.id ? d.id : 'unknown';
      // top-level image fields
      try {
        if (d.image && typeof d.image === 'string' && d.image.startsWith('data:')) {
          const res = await assetStore.storeDataUrl(d.image, `design-${id}-front`);
          if (res && (res as any).id) d.image = `/api/assets/${(res as any).id}`;
          else if (res && (res as any).filename) d.image = `/attached_assets/${res.filename}`;
          modified = true;
        }
        if (d.back_image && typeof d.back_image === 'string' && d.back_image.startsWith('data:')) {
          const res = await assetStore.storeDataUrl(d.back_image, `design-${id}-back`);
          if (res && (res as any).id) d.back_image = `/api/assets/${(res as any).id}`;
          else if (res && (res as any).filename) d.back_image = `/attached_assets/${res.filename}`;
          modified = true;
        }
      } catch (e) {
        console.error('Failed to backfill top-level images for design', id, e);
      }

      // nested version payloads
      try {
        if (d.version) {
          await replaceDataUrls(d.version, `design-${id}-version`);
          modified = true;
        }
      } catch (e) {
        console.error('Failed to backfill version images for design', id, e);
      }
    }

    if (modified) {
      await fs.writeFile(designsFile, JSON.stringify(parsed, null, 2));
      console.log('Updated designs.json with asset references');
    } else {
      console.log('No inline data URLs found; no changes made');
    }

    process.exit(0);
  } catch (e) {
    console.error('Backfill failed', e);
    process.exit(1);
  }
})();
