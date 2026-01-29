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

// Small file cache to avoid reading JSON on every request (improves dev perf)
const fileCache: Record<string, { ts: number; data: any[] }> = {};
const FILE_CACHE_TTL = 2000; // 2s

async function readJson<T>(file: string): Promise<T[]> {
  const now = Date.now();
  const cached = fileCache[file];
  if (cached && now - cached.ts < FILE_CACHE_TTL) return cached.data as T[];

  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as T[];
    fileCache[file] = { ts: now, data: parsed };
    return parsed;
  } catch {
    fileCache[file] = { ts: now, data: [] };
    return [];
  }
}

// Helper to invalidate a file cache (used on writes)
async function writeJsonAndInvalidate<T>(file: string, data: T[]) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  fileCache[file] = { ts: Date.now(), data: data as any };
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
    const newItem: Inventory = { id, color_id: payload.color_id, size_id: payload.size_id, quantity: payload.quantity, price: payload.price };
    // attach product information in metadata for JSON-mode compatibility
    (newItem as any).product = product;
    items.push(newItem as any);
    found = newItem as any;
  }
  await writeJsonAndInvalidate(inventoryFile, items);
  return found as Inventory;
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
  await writeJsonAndInvalidate(ordersFile, orders);

  const orderItems = await readJson<any>(orderItemsFile);
  for (const it of items) {
    const itemId = (orderItems.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
    orderItems.push({ id: itemId, order_id: id, ...it });
    // decrement inventory file
    const inv = await readJson<Inventory>(inventoryFile);
    const found = inv.find(i => i.color_id === it.color_id && i.size_id === it.size_id);
    if (found) {
      found.quantity = Math.max(0, found.quantity - it.quantity);
      await writeJsonAndInvalidate(inventoryFile, inv);
    }
  }
  await writeJsonAndInvalidate(orderItemsFile, orderItems);
  return id;
}

// Create supplier order storing into supplier_orders and supplier_order_lines (supports design snapshots)
export async function createSupplierOrder(supplier_id: number, placed_by: number | null, items: Array<{ product?: string; color_id: number; size_id: number; quantity: number; price: number; design_id?: number; design_snapshot?: any }>, shipping?: { customer_name?: string; customer_email?: string; shipping_address?: any; shipping_method?: string; shipping_cost_cents?: number }) {
  if (db) {
    // Insert into supplier_orders
    const ins = await pool.query(
      `INSERT INTO supplier_orders (supplier_id, placed_by, customer_name, customer_email, shipping_address, shipping_method, shipping_cost_cents, subtotal_cents, tax_cents, total_cents, currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [supplier_id, placed_by, shipping?.customer_name || null, shipping?.customer_email || null, shipping?.shipping_address || null, shipping?.shipping_method || null, shipping?.shipping_cost_cents || 0, 0, 0, 0, 'USD']
    );
    const orderId = ins.rows[0].id;

    // Insert lines and decrement inventory
    for (const it of items) {
      const product = it.product || 'tshirt';
      await pool.query(`INSERT INTO supplier_order_lines (order_id, design_id, design_snapshot, product_sku, size, color, quantity, unit_price_cents, line_total_cents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [orderId, it.design_id || null, it.design_snapshot ? JSON.stringify(it.design_snapshot) : null, product, it.size_id ? String(it.size_id) : null, it.color_id ? String(it.color_id) : null, it.quantity, Math.round(Number(it.price) * 100), Math.round(Number(it.price) * it.quantity * 100) ]);

      // Attempt to decrement cloth_inventory by matching product, color_id, size_id
      try {
        await pool.query('UPDATE cloth_inventory SET quantity = GREATEST(0, quantity - $1) WHERE product=$2 AND color_id=$3 AND size_id=$4', [it.quantity, product, it.color_id, it.size_id]);
      } catch (e) {
        // ignore inventory decrement failures
      }
    }

    // compute totals (simplified) and update order
    const totals = await pool.query('SELECT SUM(line_total_cents) as subtotal FROM supplier_order_lines WHERE order_id=$1', [orderId]);
    const subtotal = totals.rows[0].subtotal || 0;
    const tax = 0;
    const total = subtotal + tax + (shipping?.shipping_cost_cents || 0);
    await pool.query('UPDATE supplier_orders SET subtotal_cents=$1, tax_cents=$2, total_cents=$3 WHERE id=$4', [subtotal, tax, total, orderId]);

    return orderId;
  }

  // Fallback to json storage for non-db mode
  const ordersFile = path.resolve(dataDir, 'supplier_orders.json');
  const orderItemsFile = path.resolve(dataDir, 'supplier_order_lines.json');
  const orders = await readJson<any>(ordersFile);
  const id = (orders.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const order = { id, supplier_id, placed_by, created_at: new Date().toISOString(), shipping };
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

export async function listSupplierOrders(supplier_id: number) {
  if (pool) {
    const rows = await pool.query('SELECT * FROM supplier_orders WHERE supplier_id=$1 ORDER BY created_at DESC', [supplier_id]);
    const orders = rows.rows;
    for (const o of orders) {
      const lines = await pool.query('SELECT * FROM supplier_order_lines WHERE order_id=$1', [o.id]);
      o.items = lines.rows.map((l:any) => {
        const ds = l.design_snapshot;
        let parsed = null;
        try { parsed = ds ? (typeof ds === 'string' ? JSON.parse(ds) : ds) : null; } catch (e) { parsed = ds; }
        return { ...l, design_snapshot: parsed };
      });
    }
    return orders;
  }
  const ordersFile = path.resolve(dataDir, 'supplier_orders.json');
  const orderItemsFile = path.resolve(dataDir, 'supplier_order_lines.json');
  const orders = await readJson<any>(ordersFile);
  const items = await readJson<any>(orderItemsFile);
  const filtered = orders.filter(o => o.supplier_id === supplier_id).map(o => ({ ...o, items: items.filter((it:any)=> it.order_id === o.id) }));
  return filtered;
}

export async function getSupplierOrder(orderId: number) {
  if (pool) {
    const r = await pool.query('SELECT * FROM supplier_orders WHERE id=$1', [orderId]);
    if (!r.rows.length) return null;
    const o = r.rows[0];
    const lines = await pool.query('SELECT * FROM supplier_order_lines WHERE order_id=$1', [o.id]);
    o.items = lines.rows.map((l:any) => {
      const ds = l.design_snapshot; let parsed = null; try { parsed = ds ? (typeof ds === 'string' ? JSON.parse(ds) : ds) : null; } catch(e) { parsed = ds; }
      return { ...l, design_snapshot: parsed };
    });
    return o;
  }
  const ordersFile = path.resolve(dataDir, 'supplier_orders.json');
  const orderItemsFile = path.resolve(dataDir, 'supplier_order_lines.json');
  const orders = await readJson<any>(ordersFile);
  const items = await readJson<any>(orderItemsFile);
  const ord = orders.find(o => o.id === orderId);
  if (!ord) return null;
  ord.items = items.filter((it:any) => it.order_id === ord.id);
  return ord;
}

// Admin: list all supplier orders and fetch by id
export async function listAllSupplierOrdersForAdmin() {
  const colors = await listColors();
  const sizes = await listSizes();

  if (pool) {
    const rows = await pool.query('SELECT * FROM supplier_orders ORDER BY created_at DESC');
    const orders = rows.rows;
    for (const o of orders) {
      const lines = await pool.query('SELECT * FROM supplier_order_lines WHERE order_id=$1', [o.id]);
      o.items = lines.rows.map((l:any) => {
        const ds = l.design_snapshot; let parsed = null; try { parsed = ds ? (typeof ds === 'string' ? JSON.parse(ds) : ds) : null; } catch(e) { parsed = ds; }
        return { ...l, design_snapshot: parsed };
      });
    }

    // Map colors/sizes into human values and sanitize ids where possible
    const users = await pool.query('SELECT id, name, email FROM users WHERE id = ANY(ARRAY(SELECT DISTINCT supplier_id FROM supplier_orders))');
    const usersMap: Record<number, any> = {};
    for (const u of users.rows) usersMap[u.id] = u;

    return orders.map((o:any) => sanitizeOrderForAdmin(o, usersMap, colors, sizes));
  }

  const ordersFile = path.resolve(dataDir, 'supplier_orders.json');
  const orderItemsFile = path.resolve(dataDir, 'supplier_order_lines.json');
  const orders = await readJson<any>(ordersFile);
  const items = await readJson<any>(orderItemsFile);
  const mapped = orders.map(o => ({ ...o, items: items.filter((it:any)=> it.order_id === o.id) }));
  return mapped.map((o:any)=> sanitizeOrderForAdmin(o, {}, colors, sizes));
}

export async function getSupplierOrderForAdmin(orderId: number) {
  const colors = await listColors();
  const sizes = await listSizes();

  const ord = await getSupplierOrder(orderId);
  if (!ord) return null;

  // load supplier info if possible
  let user: any = null;
  if (pool && ord.supplier_id) {
    const r = await pool.query('SELECT id, name, email FROM users WHERE id=$1', [ord.supplier_id]);
    if (r.rows.length) user = r.rows[0];
  }

  return sanitizeOrderForAdmin(ord, user ? { [user.id]: user } : {}, colors, sizes);
}

function sanitizeOrderForAdmin(order: any, usersMap: Record<number, any> | any, colors: any[], sizes: any[]) {
  // shallow copy
  const o = { ...order };
  // replace supplier_id with supplier info (no ids)
  if (o.supplier_id && usersMap && usersMap[o.supplier_id]) {
    o.supplier = { name: usersMap[o.supplier_id].name || null, email: usersMap[o.supplier_id].email || null };
  } else {
    o.supplier = null;
  }
  delete o.supplier_id;
  delete o.placed_by;
  delete o.id;

  // format totals
  o.subtotal = (o.subtotal_cents || 0) / 100;
  o.tax = (o.tax_cents || 0) / 100;
  o.shipping = (o.shipping_cost_cents || 0) / 100;
  o.total = (o.total_cents || 0) / 100;
  delete o.subtotal_cents; delete o.tax_cents; delete o.shipping_cost_cents; delete o.total_cents;

  // sanitize items
  o.items = (o.items || []).map((it:any) => {
    const copy: any = {};
    copy.product = it.product_sku || it.product || null;

    // map size id/label
    let sizeLabel = it.size;
    const sizeNum = Number(it.size);
    if (!isNaN(sizeNum)) {
      const sz = sizes.find((s:any) => Number(s.id) === sizeNum);
      if (sz) sizeLabel = sz.label;
    }
    copy.size = sizeLabel || null;

    // map color id -> hex/name if available
    let colorLabel: any = it.color;
    const colorNum = Number(it.color);
    if (!isNaN(colorNum)) {
      const c = colors.find((c:any) => Number(c.id) === colorNum);
      if (c) colorLabel = { name: c.name, hex: c.hex };
    }
    copy.color = colorLabel || null;

    copy.quantity = it.quantity || 0;
    copy.unit_price = (it.unit_price_cents || 0) / 100;
    copy.line_total = (it.line_total_cents || 0) / 100;

    // design snapshot (remove nested ids like product_id, design_id)
    if (it.design_snapshot) {
      const ds = JSON.parse(JSON.stringify(it.design_snapshot));
      // delete any id keys in snapshot recursively
      const stripIds = (obj:any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
          if (k === 'id' || k.endsWith('_id')) delete obj[k];
          else stripIds(obj[k]);
        }
      };
      stripIds(ds);
      copy.design_snapshot = ds;
    } else {
      copy.design_snapshot = null;
    }

    return copy;
  });

  return o;
}
