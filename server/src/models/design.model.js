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

  const productId = input.product_id ? Number(input.product_id) : null;
  const providerId = input.provider_id ? Number(input.provider_id) : null;

  if (pool) {
    const insertRes = await pool.query(
      `INSERT INTO designs (slogan, color, text_size, text_rotation, text_position, image, image_scale, image_rotation, image_position, product, template, template_color, owner_id, group_id, design_code, product_id, provider_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()) RETURNING *`,
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
        input.design_code || null,
        productId,
        providerId
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
          if (layer.type === 'image') {
            const dataUrlOrUrl = layer.asset?.dataUrl || layer.url || layer.image;
            if (typeof dataUrlOrUrl === 'string') {
              if (dataUrlOrUrl.startsWith('data:')) {
                try {
                  const stored = await storageService.storeDataUrl(dataUrlOrUrl, undefined, ownerId);
                  layer.asset = {
                    id: stored.id,
                    url: stored.url,
                    mime: stored.mime,
                    size: stored.size,
                    filename: stored.filename
                  };
                  layer.url = stored.url;
                } catch (e) {
                  console.error('design.model: asset store error:', e.message);
                }
              } else {
                // Already a normalized URL (e.g. /api/assets/... or /uploads/...)
                layer.asset = {
                  ...(layer.asset || {}),
                  url: dataUrlOrUrl
                };
                layer.url = dataUrlOrUrl;
              }
            }
          }
        }
      }

      // Preserve isolated pure artwork in designs.image and designs.back_image
      const frontLayerImg = (payload.sides?.find(s => s.name === 'front' || s.side === 'front')?.layers || []).find(l => l.type === 'image');
      const backLayerImg = (payload.sides?.find(s => s.name === 'back' || s.side === 'back')?.layers || []).find(l => l.type === 'image');
      const frontArtwork = input.image || frontLayerImg?.asset?.url || frontLayerImg?.url || null;
      const backArtwork = input.back_image || backLayerImg?.asset?.url || backLayerImg?.url || null;
      if (frontArtwork && frontArtwork !== design.image) {
        await pool.query('UPDATE designs SET image = $1 WHERE id = $2', [frontArtwork, design.id]);
        design.image = frontArtwork;
      }
      if (backArtwork && backArtwork !== design.back_image) {
        await pool.query('UPDATE designs SET back_image = $1 WHERE id = $2', [backArtwork, design.id]);
        design.back_image = backArtwork;
      }

      // Auto-store preview files into preview_front/preview_back (DO NOT OVERWRITE raw artwork in image/back_image)
      const meta = payload.metadata || {};
      if (meta.preview_front || meta.preview_back) {
        try {
          const previews = await storageService.storePreviewFiles(meta.preview_front, meta.preview_back, design.id, ownerId);
          if (previews.front) {
            await pool.query('UPDATE designs SET preview_front = $1 WHERE id = $2', [previews.front, design.id]);
            design.preview_front = previews.front;
            meta.preview_front = previews.front;
          }
          if (previews.back) {
            await pool.query('UPDATE designs SET preview_back = $1 WHERE id = $2', [previews.back, design.id]);
            design.preview_back = previews.back;
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
      const vRes = await pool.query('SELECT payload, price_cents, currency FROM design_versions WHERE design_id = $1 ORDER BY id DESC LIMIT 1', [row.id]);
      if (vRes.rows.length > 0) {
        let p = vRes.rows[0].payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) {}
        }
        row.version = p;
        row.versions = [p];
        row.price_cents = vRes.rows[0].price_cents || 0;
        row.price = (row.price_cents || 0) / 100;
        row.retail_price = row.price;
        row.currency = vRes.rows[0].currency || 'INR';
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
        'SELECT design_id, payload, price_cents, currency FROM design_versions WHERE design_id = ANY($1) ORDER BY id ASC',
        [designIds]
      );
      const versionMap = {};
      for (const vr of vRes.rows) {
        let p = vr.payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) {}
        }
        versionMap[vr.design_id] = {
          payload: p,
          price_cents: vr.price_cents || 0,
          currency: vr.currency || 'INR'
        };
      }
      for (const row of rows) {
        if (versionMap[row.id]) {
          const vData = versionMap[row.id];
          row.version = vData.payload;
          row.versions = [vData.payload];
          row.price_cents = vData.price_cents || 0;
          row.price = (row.price_cents || 0) / 100;
          row.retail_price = row.price;
          row.currency = vData.currency || 'INR';
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
  const designId = Number(id);
  if (!designId) return null;

  if (pool) {
    const validColumns = new Set([
      'slogan', 'color', 'text_size', 'text_rotation', 'text_position',
      'image', 'image_scale', 'image_rotation', 'image_position',
      'product', 'template_color', 'template', 'back_slogan',
      'back_image', 'back_image_scale', 'back_image_rotation', 'back_image_position',
      'back_text_size', 'back_text_rotation', 'back_text_position',
      'image_mask', 'back_image_mask', 'preview_front', 'preview_back',
      'product_id', 'owner_id', 'provider_id', 'group_id', 'design_code'
    ]);

    // Handle version payload if present
    const versionPayload = changes.version || changes.payload || null;
    const meta = versionPayload?.metadata || changes.metadata || {};

    // Auto-store preview files if present
    if (meta.preview_front || meta.preview_back) {
      try {
        const previews = await storageService.storePreviewFiles(meta.preview_front, meta.preview_back, designId, userId);
        if (previews.front) {
          changes.preview_front = previews.front;
          meta.preview_front = previews.front;
        }
        if (previews.back) {
          changes.preview_back = previews.back;
          meta.preview_back = previews.back;
        }
      } catch (e) {
        // ignore preview error
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(changes)) {
      if (key === 'id' || key === 'created_at' || key === 'createdAt' || key === 'version' || key === 'payload' || key === 'metadata') continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (!validColumns.has(col)) continue;
      fields.push(`${col} = $${i++}`);
      values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
    }

    values.push(designId);
    let whereClause = `WHERE id = $${i++}`;
    if (userId) {
      values.push(Number(userId));
      whereClause += ` AND (owner_id = $${i++} OR owner_id IS NULL)`;
    }

    let updatedRow = null;
    if (fields.length > 0) {
      const res = await pool.query(`UPDATE designs SET ${fields.join(', ')} ${whereClause} RETURNING *`, values);
      updatedRow = res.rows[0] || null;
    } else {
      updatedRow = await getDesign(designId, userId);
    }

    // Save/update design_versions record
    if (versionPayload) {
      try {
        await pool.query(
          `INSERT INTO design_versions (design_id, version_name, payload, price_cents, currency, processing_state, created_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
          [
            designId,
            versionPayload.versionName || 'supplier-edit',
            JSON.stringify(versionPayload),
            changes.price_cents || 0,
            changes.currency || 'INR'
          ]
        );
      } catch (vErr) {
        console.warn('updateDesign: failed to record version:', vErr.message);
      }
    }

    return updatedRow ? await getDesign(designId, userId) : null;
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
  const designId = Number(id);
  if (!designId) return false;

  if (pool) {
    // 1. Fetch design to verify ownership and collect image references
    let selectQuery = 'SELECT id, image, back_image, owner_id FROM designs WHERE id = $1';
    const selectParams = [designId];
    if (userId) {
      selectQuery += ' AND (owner_id = $2 OR owner_id IS NULL)';
      selectParams.push(Number(userId));
    }
    const designRes = await pool.query(selectQuery, selectParams);
    const design = designRes.rows[0];
    if (!design) return false;

    // 2. Collect all files associated with this design
    const filesToDelete = new Set();
    if (design.image) filesToDelete.add(design.image);
    if (design.back_image) filesToDelete.add(design.back_image);

    // 3. Inspect design_versions for previews and embedded layer assets
    const vRes = await pool.query('SELECT payload FROM design_versions WHERE design_id = $1', [designId]);
    for (const vRow of vRes.rows) {
      let payload = vRow.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) {}
      }
      if (payload && typeof payload === 'object') {
        if (payload.metadata?.preview_front) filesToDelete.add(payload.metadata.preview_front);
        if (payload.metadata?.preview_back) filesToDelete.add(payload.metadata.preview_back);
        if (Array.isArray(payload.sides)) {
          for (const side of payload.sides) {
            for (const layer of side.layers || []) {
              if (layer.type === 'image' && layer.asset) {
                if (layer.asset.url) filesToDelete.add(layer.asset.url);
                if (layer.asset.filename) filesToDelete.add(layer.asset.filename);
                if (layer.asset.id) filesToDelete.add(`/api/assets/${layer.asset.id}`);
              }
            }
          }
        }
      }
    }

    // 4. Inspect assets table for automated preview assets linked to this design
    const assetRes = await pool.query(
      `SELECT id, filename, storage_key 
       FROM assets 
       WHERE (metadata->>'designId')::int = $1
          OR filename LIKE '%' || $2 || '%'`,
      [designId, `design-${designId}-`]
    );
    for (const aRow of assetRes.rows) {
      if (aRow.storage_key) filesToDelete.add(aRow.storage_key);
      if (aRow.filename) filesToDelete.add(aRow.filename);
      filesToDelete.add(`/api/assets/${aRow.id}`);
    }

    // 5. Physically unlink all collected files from disk
    for (const fileRef of filesToDelete) {
      try {
        await storageService.deletePhysicalFile(fileRef);
      } catch (err) {
        console.warn(`deleteDesign: failed to delete physical file ${fileRef}:`, err.message);
      }
    }

    // 6. Delete linked assets from database
    await pool.query(
      `DELETE FROM assets 
       WHERE (metadata->>'designId')::int = $1
          OR filename LIKE '%' || $2 || '%'`,
      [designId, `design-${designId}-`]
    );

    // 7. Delete design versions
    await pool.query('DELETE FROM design_versions WHERE design_id = $1', [designId]);

    // 8. Safely unbind/remove any listings created from this design
    try {
      await pool.query(
        `UPDATE order_items SET listing_id = NULL WHERE listing_id IN (SELECT id FROM listings WHERE design_key = $1 OR design_key = $2)`,
        [`design-${designId}`, String(designId)]
      );
      await pool.query(
        `DELETE FROM listing_versions WHERE listing_id IN (SELECT id FROM listings WHERE design_key = $1 OR design_key = $2)`,
        [`design-${designId}`, String(designId)]
      );
      await pool.query(
        `DELETE FROM listings WHERE design_key = $1 OR design_key = $2`,
        [`design-${designId}`, String(designId)]
      );
    } catch (lErr) {
      console.warn('deleteDesign: note cleaning listings:', lErr.message);
    }

    // 9. Delete the design record
    const res = await pool.query('DELETE FROM designs WHERE id = $1', [designId]);
    return (res.rowCount || 0) > 0;
  }

  const designs = await readDesigns();
  const remaining = designs.filter((d) => d.id !== Number(id));
  await writeDesigns(remaining);
  return true;
}

export async function listDesignsForProvider(providerId) {
  if (pool) {
    const res = await pool.query(
      `SELECT d.*, dv.payload as version_payload, u.name as designer_name, u.email as designer_email, pf.name as product_name
       FROM designs d
       LEFT JOIN users u ON u.id = d.owner_id
       LEFT JOIN products_full pf ON pf.id = d.product_id
       LEFT JOIN LATERAL (
         SELECT payload FROM design_versions WHERE design_id = d.id ORDER BY id DESC LIMIT 1
       ) dv ON true
       WHERE d.provider_id = $1
          OR d.product_id IN (SELECT id FROM products_full WHERE owner_id = $1)
          OR d.owner_id IN (SELECT id FROM users WHERE associated_provider_id = $1)
       ORDER BY d.id DESC`,
      [Number(providerId)]
    );
    return res.rows.map((row) => {
      let version = row.version_payload;
      if (typeof version === 'string') {
        try { version = JSON.parse(version); } catch (e) {}
      }
      return {
        ...row,
        version: version || null,
        versions: version ? [version] : []
      };
    });
  }

  const designs = await readDesigns();
  return designs.filter((d) => Number(d.provider_id) === Number(providerId));
}

export default {
  createDesign,
  getDesign,
  listDesigns,
  listDesignVersions,
  listDesignsForProvider,
  updateDesign,
  deleteDesign
};
