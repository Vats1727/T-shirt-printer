import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/database.js';

const inventoryFile = path.resolve(process.cwd(), 'inventory.json');

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

export async function listInventory(ownerId, product) {
  const prod = product || 'tshirt';
  if (pool) {
    const query = ownerId
      ? 'SELECT id, color_id, size_id, quantity, price, owner_id, product FROM cloth_inventory WHERE (owner_id = $1 OR owner_id IS NULL) AND product = $2 ORDER BY id'
      : 'SELECT id, color_id, size_id, quantity, price, owner_id, product FROM cloth_inventory WHERE product = $1 ORDER BY id';
    const res = await pool.query(query, ownerId ? [ownerId, prod] : [prod]);
    return res.rows;
  }
  const items = await readJson(inventoryFile);
  return items.filter((i) => (i.product || 'tshirt') === prod && (!ownerId || i.owner_id === ownerId));
}

export async function upsertInventory(payload) {
  const prod = payload.product || 'tshirt';
  if (pool) {
    const res = await pool.query(
      `INSERT INTO cloth_inventory (color_id, size_id, quantity, price, owner_id, product)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (product, color_id, size_id, owner_id) DO UPDATE
       SET quantity = EXCLUDED.quantity, price = EXCLUDED.price
       RETURNING id, color_id, size_id, quantity, price, owner_id, product`,
      [payload.color_id, payload.size_id, payload.quantity, payload.price, payload.owner_id || null, prod]
    );
    return res.rows[0];
  }
  const items = await readJson(inventoryFile);
  const idx = items.findIndex(
    (i) => i.color_id === payload.color_id && i.size_id === payload.size_id && (i.product || 'tshirt') === prod && i.owner_id === payload.owner_id
  );
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...payload, product: prod };
    await writeJson(inventoryFile, items);
    return items[idx];
  }
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const item = { id, ...payload, product: prod };
  items.push(item);
  await writeJson(inventoryFile, items);
  return item;
}

export default { listInventory, upsertInventory };
