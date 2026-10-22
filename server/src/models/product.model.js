import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/database.js';

const dataDir = path.resolve(process.cwd());
const colorsFile = path.resolve(dataDir, 'colors.json');
const sizesFile = path.resolve(dataDir, 'sizes.json');
const sizeChartFile = path.resolve(dataDir, 'size_chart.json');
const productsFile = path.resolve(dataDir, 'products.json');

const fileCache = {};
const FILE_CACHE_TTL = 2000;

async function readJson(file) {
  const now = Date.now();
  const cached = fileCache[file];
  if (cached && now - cached.ts < FILE_CACHE_TTL) return cached.data;

  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    fileCache[file] = { ts: now, data: parsed };
    return parsed;
  } catch {
    fileCache[file] = { ts: now, data: [] };
    return [];
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  fileCache[file] = { ts: Date.now(), data };
}

// --- Colors ---
export async function listColors(ownerId) {
  if (pool) {
    const query = ownerId
      ? 'SELECT id, name, hex, owner_id FROM colors WHERE owner_id = $1 OR owner_id IS NULL ORDER BY id'
      : 'SELECT id, name, hex, owner_id FROM colors ORDER BY id';
    const res = await pool.query(query, ownerId ? [ownerId] : []);
    const seen = new Set();
    return res.rows.filter((c) => {
      const key = `${(c.name || '').toLowerCase().trim()}-${(c.hex || '').toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const items = await readJson(colorsFile);
  if (ownerId) return items.filter((i) => i.owner_id === ownerId);
  return items;
}

export async function createColor(payload) {
  if (pool) {
    const existing = await pool.query(
      'SELECT id, name, hex, owner_id FROM colors WHERE lower(hex) = lower($1) AND (owner_id = $2 OR owner_id IS NULL) LIMIT 1',
      [payload.hex.trim(), payload.owner_id || null]
    );
    if (existing.rows.length > 0) return existing.rows[0];
    const res = await pool.query(
      'INSERT INTO colors (name, hex, owner_id) VALUES ($1, $2, $3) RETURNING id, name, hex, owner_id',
      [payload.name.trim(), payload.hex.trim(), payload.owner_id || null]
    );
    return res.rows[0];
  }
  const items = await readJson(colorsFile);
  const found = items.find((i) => i.hex.toLowerCase() === payload.hex.toLowerCase() && (i.owner_id === payload.owner_id || !i.owner_id));
  if (found) return found;
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const color = { id, ...payload };
  items.push(color);
  await writeJson(colorsFile, items);
  return color;
}

export async function deleteColor(color_id, ownerId) {
  if (pool) {
    const query = ownerId ? 'DELETE FROM colors WHERE id=$1 AND owner_id=$2' : 'DELETE FROM colors WHERE id=$1';
    await pool.query(query, ownerId ? [color_id, ownerId] : [color_id]);
    return true;
  }
  const items = await readJson(colorsFile);
  const remaining = items.filter((i) => !(i.id === color_id && (!ownerId || i.owner_id === ownerId)));
  await writeJson(colorsFile, remaining);
  return true;
}

// --- Sizes ---
export async function listSizes(ownerId) {
  if (pool) {
    const query = ownerId
      ? 'SELECT id, label, owner_id FROM sizes WHERE owner_id = $1 OR owner_id IS NULL ORDER BY id'
      : 'SELECT id, label, owner_id FROM sizes ORDER BY id';
    const res = await pool.query(query, ownerId ? [ownerId] : []);
    return res.rows;
  }
  const items = await readJson(sizesFile);
  if (ownerId) return items.filter((i) => i.owner_id === ownerId);
  return items;
}

export async function createSize(payload) {
  if (pool) {
    const existing = await pool.query(
      'SELECT id, label, owner_id FROM sizes WHERE lower(label) = lower($1) AND (owner_id = $2 OR owner_id IS NULL) LIMIT 1',
      [payload.label.trim(), payload.owner_id || null]
    );
    if (existing.rows.length > 0) return existing.rows[0];
    const res = await pool.query(
      'INSERT INTO sizes (label, owner_id) VALUES ($1, $2) RETURNING id, label, owner_id',
      [payload.label.trim(), payload.owner_id || null]
    );
    return res.rows[0];
  }
  const items = await readJson(sizesFile);
  const found = items.find((i) => i.label.toLowerCase() === payload.label.toLowerCase() && (i.owner_id === payload.owner_id || !i.owner_id));
  if (found) return found;
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const size = { id, ...payload };
  items.push(size);
  await writeJson(sizesFile, items);
  return size;
}

export async function deleteSize(size_id, ownerId) {
  if (pool) {
    const query = ownerId ? 'DELETE FROM sizes WHERE id=$1 AND owner_id=$2' : 'DELETE FROM sizes WHERE id=$1';
    await pool.query(query, ownerId ? [size_id, ownerId] : [size_id]);
    return true;
  }
  const items = await readJson(sizesFile);
  const remaining = items.filter((i) => !(i.id === size_id && (!ownerId || i.owner_id === ownerId)));
  await writeJson(sizesFile, remaining);
  return true;
}

// --- Size Chart ---
export async function listSizeChart(ownerId, product) {
  const prod = product || 'tshirt';
  if (pool) {
    const query = ownerId
      ? 'SELECT sc.id, sc.size_id, sc.product, sc.chest, sc.length, sc.shoulder, sc.owner_id, s.label as size_label FROM size_chart sc LEFT JOIN sizes s ON sc.size_id = s.id WHERE (sc.owner_id = $1 OR sc.owner_id IS NULL) AND sc.product = $2 ORDER BY sc.size_id'
      : 'SELECT sc.id, sc.size_id, sc.product, sc.chest, sc.length, sc.shoulder, sc.owner_id, s.label as size_label FROM size_chart sc LEFT JOIN sizes s ON sc.size_id = s.id WHERE sc.product = $1 ORDER BY sc.size_id';
    const res = await pool.query(query, ownerId ? [ownerId, prod] : [prod]);
    return res.rows;
  }
  const items = await readJson(sizeChartFile);
  return items.filter((i) => (i.product || 'tshirt') === prod && (!ownerId || i.owner_id === ownerId));
}

export async function upsertSizeChart(payload) {
  const prod = payload.product || 'tshirt';
  if (pool) {
    const res = await pool.query(
      `INSERT INTO size_chart (size_id, product, chest, length, shoulder, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (product, size_id, owner_id) DO UPDATE
       SET chest = EXCLUDED.chest, length = EXCLUDED.length, shoulder = EXCLUDED.shoulder
       RETURNING id, size_id, product, chest, length, shoulder, owner_id`,
      [payload.size_id, prod, payload.chest, payload.length, payload.shoulder, payload.owner_id || null]
    );
    return res.rows[0];
  }
  const items = await readJson(sizeChartFile);
  const idx = items.findIndex((i) => i.size_id === payload.size_id && (i.product || 'tshirt') === prod && i.owner_id === payload.owner_id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...payload, product: prod };
    await writeJson(sizeChartFile, items);
    return items[idx];
  }
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const item = { id, ...payload, product: prod };
  items.push(item);
  await writeJson(sizeChartFile, items);
  return item;
}

// --- Products (Full) ---
export async function listProducts(ownerId) {
  if (pool) {
    const query = ownerId
      ? 'SELECT * FROM products_full WHERE owner_id = $1 OR owner_id IS NULL ORDER BY id DESC'
      : 'SELECT * FROM products_full ORDER BY id DESC';
    const res = await pool.query(query, ownerId ? [ownerId] : []);
    return res.rows;
  }
  const items = await readJson(productsFile);
  if (ownerId) return items.filter((p) => p.owner_id === ownerId);
  return items;
}

export async function getProductById(id, ownerId) {
  if (pool) {
    const query = ownerId
      ? 'SELECT * FROM products_full WHERE id = $1 AND (owner_id = $2 OR owner_id IS NULL)'
      : 'SELECT * FROM products_full WHERE id = $1';
    const res = await pool.query(query, ownerId ? [id, ownerId] : [id]);
    return res.rows[0] || null;
  }
  const items = await readJson(productsFile);
  return items.find((p) => p.id === Number(id)) || null;
}

export async function createProduct(payload) {
  if (pool) {
    const res = await pool.query(
      `INSERT INTO products_full (title, description, base_price, category, template, owner_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [
        payload.title,
        payload.description || '',
        payload.base_price || 0,
        payload.category || 'Apparel',
        payload.template || 'tshirt',
        payload.owner_id || null,
        payload.status || 'active'
      ]
    );
    return res.rows[0];
  }
  const items = await readJson(productsFile);
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const item = { id, ...payload, created_at: new Date().toISOString() };
  items.push(item);
  await writeJson(productsFile, items);
  return item;
}

export async function updateProduct(id, payload, ownerId) {
  if (pool) {
    const fields = [];
    const values = [];
    let i = 1;
    if (payload.title !== undefined) { fields.push(`title = $${i++}`); values.push(payload.title); }
    if (payload.description !== undefined) { fields.push(`description = $${i++}`); values.push(payload.description); }
    if (payload.base_price !== undefined) { fields.push(`base_price = $${i++}`); values.push(payload.base_price); }
    if (payload.category !== undefined) { fields.push(`category = $${i++}`); values.push(payload.category); }
    if (payload.template !== undefined) { fields.push(`template = $${i++}`); values.push(payload.template); }
    if (payload.status !== undefined) { fields.push(`status = $${i++}`); values.push(payload.status); }

    fields.push(`updated_at = NOW()`);
    values.push(id);
    let whereClause = `WHERE id = $${i++}`;
    if (ownerId) {
      values.push(ownerId);
      whereClause += ` AND owner_id = $${i++}`;
    }

    const res = await pool.query(`UPDATE products_full SET ${fields.join(', ')} ${whereClause} RETURNING *`, values);
    return res.rows[0] || null;
  }
  const items = await readJson(productsFile);
  const idx = items.findIndex((p) => p.id === Number(id));
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...payload, updated_at: new Date().toISOString() };
    await writeJson(productsFile, items);
    return items[idx];
  }
  return null;
}

export async function deleteProduct(id, ownerId) {
  if (pool) {
    const query = ownerId
      ? 'DELETE FROM products_full WHERE id = $1 AND owner_id = $2'
      : 'DELETE FROM products_full WHERE id = $1';
    await pool.query(query, ownerId ? [id, ownerId] : [id]);
    return true;
  }
  const items = await readJson(productsFile);
  const remaining = items.filter((p) => p.id !== Number(id));
  await writeJson(productsFile, remaining);
  return true;
}

export default {
  listColors,
  createColor,
  deleteColor,
  listSizes,
  createSize,
  deleteSize,
  listSizeChart,
  upsertSizeChart,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
