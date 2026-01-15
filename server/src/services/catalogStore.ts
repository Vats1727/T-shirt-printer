import fs from 'fs/promises';
import path from 'path';
import { pool, db } from '../../db';

const dataDir = path.resolve(process.cwd());
const colorsFile = path.resolve(dataDir, 'colors.json');
const sizesFile = path.resolve(dataDir, 'sizes.json');
const inventoryFile = path.resolve(dataDir, 'inventory.json');

export type Color = { id: number; name: string; hex: string };
export type Size = { id: number; label: string };
export type Inventory = { id: number; color_id: number; size_id: number; quantity: number; price: number };

async function readJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}
async function writeJson<T>(file: string, data: T[]) { await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8'); }

export async function listColors(): Promise<Color[]> {
  if (pool) {
    const res = await pool.query('SELECT id, name, hex FROM colors ORDER BY id');
    return res.rows as Color[];
  }
  return readJson<Color>(colorsFile);
}

export async function createColor(payload: { name: string; hex: string }): Promise<Color> {
  if (db) {
    const [row] = await db.insert('colors').values(payload).returning();
    return row as Color;
  }
  const items = await readJson<Color>(colorsFile);
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const color = { id, ...payload };
  items.push(color);
  await writeJson(colorsFile, items);
  return color;
}

export async function listSizes(): Promise<Size[]> {
  if (pool) {
    const res = await pool.query('SELECT id, label FROM sizes ORDER BY id');
    return res.rows as Size[];
  }
  return readJson<Size>(sizesFile);
}

export async function createSize(payload: { label: string }): Promise<Size> {
  if (pool) {
    try {
      const res = await pool.query('INSERT INTO sizes (label) VALUES ($1) RETURNING id, label', [payload.label]);
      return res.rows[0] as Size;
    } catch (err: any) {
      if (err && err.code === '23505') {
        throw new Error('size already exists');
      }
      throw err;
    }
  }
  const items = await readJson<Size>(sizesFile);
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const size = { id, ...payload };
  items.push(size);
  await writeJson(sizesFile, items);
  return size;
}

export async function deleteSize(size_id: number) {
  if (pool) {
    await pool.query('DELETE FROM sizes WHERE id=$1', [size_id]);
    return true;
  }
  const items = await readJson<Size>(sizesFile);
  const remaining = items.filter(i => i.id !== size_id);
  await writeJson(sizesFile, remaining);
  return true;
}

export async function upsertInventory(payload: { product?: string; color_id: number; size_id: number; quantity: number; price: number }): Promise<Inventory> {
  const product = payload.product || 'tshirt';
  if (pool) {
    // Upsert for Postgres (now including product) using pool.query
    await pool.query(`
      INSERT INTO cloth_inventory (product,color_id,size_id,quantity,price)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (product,color_id,size_id) DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price
    `, [product, payload.color_id, payload.size_id, payload.quantity, payload.price]);
    const rows = await pool.query('SELECT id, product, color_id, size_id, quantity, price FROM cloth_inventory WHERE product=$1 AND color_id=$2 AND size_id=$3', [product, payload.color_id, payload.size_id]);
    return rows.rows[0] as Inventory;
  }

  const items = await readJson<Inventory>(inventoryFile);
  let found = items.find(i => i.color_id === payload.color_id && i.size_id === payload.size_id && (i as any).product === product);
  if (found) {
    found.quantity = payload.quantity;
    found.price = payload.price;
  } else {
    const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
    found = { id, product, ...payload } as any;
    items.push(found);
  }
  await writeJson(inventoryFile, items);
  return found;
}

export async function listCatalog() {
  const colors = await listColors();
  const sizes = await listSizes();

  if (pool) {
    const invRows = await pool.query('SELECT id, product, color_id, size_id, quantity, price FROM cloth_inventory ORDER BY id');
    const inventory = invRows.rows as Inventory[];
    return { colors, sizes, inventory };
  }

  const inventory = await readJson<Inventory>(inventoryFile);
  return { colors, sizes, inventory };
}

export async function listSizeChart(product = 'tshirt') {
  if (pool) {
    const rows = await pool.query('SELECT id, product, size_id, chest, length, shoulder FROM size_chart WHERE product=$1 ORDER BY size_id', [product]);
    return rows.rows as any[];
  }
  const file = path.resolve(dataDir, 'size_chart.json');
  const all = await readJson<any>(file);
  return all.filter((r: any) => (r.product || 'tshirt') === product);
}

export async function upsertSizeChart(payload: { product?: string; size_id: number; chest: number; length: number; shoulder: number }) {
  const product = payload.product || 'tshirt';
  if (pool) {
    // Safer upsert: check for existing row by (product,size_id) first, then fallback to size_id alone (older unique index)
    const byProduct = await pool.query('SELECT id FROM size_chart WHERE product=$1 AND size_id=$2 LIMIT 1', [product, payload.size_id]);
    if (byProduct.rows.length) {
      const id = byProduct.rows[0].id;
      await pool.query('UPDATE size_chart SET chest=$1, length=$2, shoulder=$3 WHERE id=$4', [payload.chest, payload.length, payload.shoulder, id]);
      const updated = await pool.query('SELECT id, product, size_id, chest, length, shoulder FROM size_chart WHERE id=$1', [id]);
      return updated.rows[0];
    }

    const bySize = await pool.query('SELECT id FROM size_chart WHERE size_id=$1 LIMIT 1', [payload.size_id]);
    if (bySize.rows.length) {
      const id = bySize.rows[0].id;
      // update and ensure this row is now associated with the requested product
      await pool.query('UPDATE size_chart SET product=$1, chest=$2, length=$3, shoulder=$4 WHERE id=$5', [product, payload.chest, payload.length, payload.shoulder, id]);
      const updated = await pool.query('SELECT id, product, size_id, chest, length, shoulder FROM size_chart WHERE id=$1', [id]);
      return updated.rows[0];
    }

    const ins = await pool.query('INSERT INTO size_chart (product, size_id, chest, length, shoulder) VALUES ($1,$2,$3,$4,$5) RETURNING id, product, size_id, chest, length, shoulder', [product, payload.size_id, payload.chest, payload.length, payload.shoulder]);
    return ins.rows[0];
  }

  const file = path.resolve(dataDir, 'size_chart.json');
  const items = await readJson<any>(file);
  let found = items.find(i => i.size_id === payload.size_id && (i.product || 'tshirt') === product);
  if (found) {
    found.chest = payload.chest; found.length = payload.length; found.shoulder = payload.shoulder;
  } else {
    const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
    found = { id, product, ...payload };
    items.push(found);
  }
  await writeJson(file, items);
  return found;
}

export async function deleteSizeChart(product: string, size_id: number) {
  if (pool) {
    await pool.query('DELETE FROM size_chart WHERE product=$1 AND size_id=$2', [product, size_id]);
    return true;
  }
  const file = path.resolve(dataDir, 'size_chart.json');
  let items = await readJson<any>(file);
  items = items.filter(i => !(i.size_id === size_id && (i.product || 'tshirt') === product));
  await writeJson(file, items);
  return true;
}

export async function createOrder(supplier_id: number, items: Array<{ product?: string; color_id: number; size_id: number; quantity: number; price: number }>) {
  if (db) {
    const r = await db.insert('orders').values({ supplier_id }).returning();
    const orderId = r[0].id;
    for (const it of items) {
      const product = it.product || 'tshirt';
      await pool.query('INSERT INTO order_items (order_id, product, color_id, size_id, quantity, price) VALUES ($1,$2,$3,$4,$5,$6)', [orderId, product, it.color_id, it.size_id, it.quantity, it.price]);
      // decrement inventory if exists
      await pool.query('UPDATE cloth_inventory SET quantity = GREATEST(0, quantity - $1) WHERE product=$2 AND color_id=$3 AND size_id=$4', [it.quantity, product, it.color_id, it.size_id]);
    }
    return orderId;
  }

  const ordersFile = path.resolve(dataDir, 'orders.json');
  const orderItemsFile = path.resolve(dataDir, 'order_items.json');
  const orders = await readJson<any>(ordersFile);
  const id = (orders.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const order = { id, supplier_id, created_at: new Date().toISOString() };
  orders.push(order);
  await writeJson(ordersFile, orders);

  const orderItems = await readJson<any>(orderItemsFile);
  for (const it of items) {
    const itemId = (orderItems.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
    orderItems.push({ id: itemId, order_id: id, ...it });
    // decrement inventory file
    const inv = await readJson<Inventory>(inventoryFile);
    const found = inv.find(i => i.color_id === it.color_id && i.size_id === it.size_id);
    if (found) {
      found.quantity = Math.max(0, found.quantity - it.quantity);
    }
    await writeJson(inventoryFile, inv);
  }
  await writeJson(orderItemsFile, orderItems);
  return id;
}
