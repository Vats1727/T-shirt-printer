import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/database.js';
import storageService from '../services/storage.service.js';

const designsFile = path.resolve(process.cwd(), 'designs.json');

const fileCache = {};
const FILE_CACHE_TTL = 1000;

async function readDesigns() {
  const now = Date.now();
  const cached = fileCache[designsFile];
  if (cached && now - cached.ts < FILE_CACHE_TTL) return cached.data;

  try {
    const raw = await fs.readFile(designsFile, 'utf8');
    const parsed = JSON.parse(raw);
    fileCache[designsFile] = { ts: now, data: parsed };
    return parsed;
  } catch {
    fileCache[designsFile] = { ts: now, data: [] };
    return [];
  }
}

async function writeDesigns(data) {
  await fs.writeFile(designsFile, JSON.stringify(data, null, 2), 'utf8');
  fileCache[designsFile] = { ts: Date.now(), data };
}

export async function createDesign(input) {
  const isV2 = !!input.version;
  const color = input.templateColor || input.color || '#ffffff';
  const product = input.product || 'T-shirt';
  const template = input.template || 'tshirt';
  const ownerId = input.owner_id || null;

  if (pool) {
    const insertRes = await pool.query(
      `INSERT INTO designs (slogan, color, text_size, text_rotation, text_position, image, image_scale, image_rotation, image_position, product, template, template_color, owner_id, group_id, design_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()) RETURNING *`,
      [
        input.slogan || null,
        color,
        input.textSize || 24,
        input.textRotation || 0,
        JSON.stringify(input.textPosition || { x: 150, y: 135 }),
        input.image || null,
        input.imageScale || 100,
        input.imageRotation || 0,
        JSON.stringify(input.imagePosition || { x: 150, y: 150 }),
        product,
        template,
        color,
        ownerId,
        input.group_id || null,
        input.design_code || null
      ]
    );
    const design = insertRes.rows[0];

    if (isV2 && design) {
      const payload = {
        ...JSON.parse(JSON.stringify(input.version)),
        template,
        templateColor: color,
        product
      };

      // Store any embedded assets
      for (const side of payload.sides || []) {
        for (const layer of side.layers || []) {
          if (layer.type === 'image' && layer.asset?.dataUrl && typeof layer.asset.dataUrl === 'string') {
            try {
              const stored = await storageService.storeDataUrl(layer.asset.dataUrl, undefined, ownerId);
              layer.asset = {
                id: stored.id,
                url: stored.url,
                mime: stored.mime,
                size: stored.size,
                filename: stored.filename
              };
            } catch (e) {
              console.error('design.model: asset store error:', e.message);
            }
          }
        }
      }

      // Auto-store preview files if present in metadata
      const meta = payload.metadata || {};
      if (meta.preview_front || meta.preview_back) {
        try {
          const previews = await storageService.storePreviewFiles(meta.preview_front, meta.preview_back, design.id, ownerId);
          if (previews.front) {
            await pool.query('UPDATE designs SET image = $1 WHERE id = $2', [previews.front, design.id]);
            design.image = previews.front;
            meta.preview_front = previews.front;
          }
          if (previews.back) {
            await pool.query('UPDATE designs SET back_image = $1 WHERE id = $2', [previews.back, design.id]);
            design.back_image = previews.back;
            meta.preview_back = previews.back;
          }
        } catch (e) {
          // ignore preview error
        }
      }

      const versionName = input.version?.versionName || 'supplier-save';
      const priceCents = input.price_cents || 0;
      const currency = input.currency || 'INR';

      await pool.query(
        `INSERT INTO design_versions (design_id, version_name, payload, price_cents, currency, processing_state, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
        [design.id, versionName, JSON.stringify(payload), priceCents, currency]
      );

      design.version = payload;
      design.versions = [payload];
    }

    return design;
  }

  // Fallback to JSON
  const designs = await readDesigns();
  const id = (designs.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const newDesign = {
    id,
    ...input,
    createdAt: new Date().toISOString()
  };
  designs.push(newDesign);
  await writeDesigns(designs);
  return newDesign;
}

export async function getDesign(id, userId) {
  if (pool) {
    let query = 'SELECT * FROM designs WHERE id = $1';
    const params = [Number(id)];
    if (userId) {
      query += ' AND owner_id = $2';
      params.push(Number(userId));
    }
    const res = await pool.query(query, params);
    const row = res.rows[0] || null;
    if (row) {
      const vRes = await pool.query('SELECT payload FROM design_versions WHERE design_id = $1 ORDER BY id DESC LIMIT 1', [row.id]);
      if (vRes.rows.length > 0) {
        let p = vRes.rows[0].payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) {}
        }
        row.version = p;
        row.versions = [p];
        if (!row.image && p?.metadata?.preview_front) {
          row.image = p.metadata.preview_front;
        }
      }
    }
    return row;
  }
  const designs = await readDesigns();
  return designs.find((d) => d.id === Number(id) && (!userId || d.owner_id === Number(userId))) || null;
}

export async function listDesigns(limit = 100, userId) {
  if (pool) {
    let query = 'SELECT * FROM designs';
    const params = [];
    if (userId) {
      query += ' WHERE owner_id = $1';
      params.push(Number(userId));
    }
    query += ` ORDER BY id DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await pool.query(query, params);
    const rows = res.rows;

    if (rows.length > 0) {
      const designIds = rows.map((r) => r.id);
      const vRes = await pool.query(
        'SELECT design_id, payload FROM design_versions WHERE design_id = ANY($1) ORDER BY id ASC',
        [designIds]
      );
      const versionMap = {};
      for (const vr of vRes.rows) {
        let p = vr.payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) {}
        }
        versionMap[vr.design_id] = p;
      }
      for (const row of rows) {
        if (versionMap[row.id]) {
          row.version = versionMap[row.id];
          row.versions = [versionMap[row.id]];
          if (!row.image && row.version?.metadata?.preview_front) {
            row.image = row.version.metadata.preview_front;
          }
        }
      }
    }
    return rows;
  }
  const designs = await readDesigns();
  let filtered = designs;
  if (userId) {
    filtered = filtered.filter((d) => d.owner_id === Number(userId));
  }
  return filtered.slice(0, limit);
}

export async function listDesignVersions(designId) {
  if (pool) {
    const res = await pool.query('SELECT * FROM design_versions WHERE design_id = $1 ORDER BY id', [Number(designId)]);
    return res.rows.map((r) => {
      let p = r.payload;
      if (typeof p === 'string') {
        try { p = JSON.parse(p); } catch (e) {}
      }
      return p || {};
    });
  }
  return [];
}

export async function updateDesign(id, changes, userId) {
  if (pool) {
    const fields = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(changes)) {
      if (key === 'id' || key === 'created_at' || key === 'createdAt') continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${col} = $${i++}`);
      values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
    }

    if (fields.length === 0) return getDesign(id, userId);

    values.push(Number(id));
    let whereClause = `WHERE id = $${i++}`;
    if (userId) {
      values.push(Number(userId));
      whereClause += ` AND (owner_id = $${i++} OR owner_id IS NULL)`;
    }

    const res = await pool.query(`UPDATE designs SET ${fields.join(', ')} ${whereClause} RETURNING *`, values);
    return res.rows[0] || null;
  }

  const designs = await readDesigns();
  const idx = designs.findIndex((d) => d.id === Number(id));
  if (idx !== -1) {
    designs[idx] = { ...designs[idx], ...changes };
    await writeDesigns(designs);
    return designs[idx];
  }
  return null;
}

export async function deleteDesign(id, userId) {
  if (pool) {
    let query = 'DELETE FROM designs WHERE id = $1';
    const params = [Number(id)];
    if (userId) {
      query += ' AND (owner_id = $2 OR owner_id IS NULL)';
      params.push(Number(userId));
    }
    const res = await pool.query(query, params);
    return (res.rowCount || 0) > 0;
  }

  const designs = await readDesigns();
  const remaining = designs.filter((d) => d.id !== Number(id));
  await writeDesigns(remaining);
  return true;
}

export default {
  createDesign,
  getDesign,
  listDesigns,
  listDesignVersions,
  updateDesign,
  deleteDesign
};
