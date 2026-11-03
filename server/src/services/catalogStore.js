import fs from "fs/promises";
import path from "path";
import { pool, db } from '../../db.js';
const dataDir = path.resolve(process.cwd());
const colorsFile = path.resolve(dataDir, "colors.json");
const sizesFile = path.resolve(dataDir, "sizes.json");
const inventoryFile = path.resolve(dataDir, "inventory.json");
const fileCache = {};
const FILE_CACHE_TTL = 2e3;
async function readJson(file) {
  const now = Date.now();
  const cached = fileCache[file];
  if (cached && now - cached.ts < FILE_CACHE_TTL) return cached.data;
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    fileCache[file] = { ts: now, data: parsed };
    return parsed;
  } catch {
    fileCache[file] = { ts: now, data: [] };
    return [];
  }
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  fileCache[file] = { ts: Date.now(), data };
}
export async function listColors(ownerId) {
  if (pool) {
    const query = ownerId ? "SELECT id, name, hex, owner_id FROM colors WHERE owner_id = $1 ORDER BY id" : "SELECT id, name, hex, owner_id FROM colors WHERE owner_id IS NOT NULL ORDER BY id";
    const res = await pool.query(query, ownerId ? [ownerId] : []);
    const seen = /* @__PURE__ */ new Set();
    return res.rows.filter((c) => {
      const key = `${(c.name || "").toLowerCase().trim()}-${(c.hex || "").toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const items = await readJson(colorsFile);
  if (ownerId) return items.filter((i) => i.owner_id === ownerId);
  return items.filter((i) => Boolean(i.owner_id));
}
export async function createColor(payload) {
  const cleanHex = (payload.hex || '').trim().toLowerCase();
  const cleanName = (payload.name || '').trim().toLowerCase();
  if (pool) {
    const existing = await pool.query(
      "SELECT id, name, hex, owner_id FROM colors WHERE (lower(hex) = lower($1) OR lower(name) = lower($2)) AND owner_id = $3 LIMIT 1",
      [cleanHex, cleanName, payload.owner_id || null]
    );
    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if ((match.hex || '').toLowerCase() === cleanHex) {
        throw new Error(`Color with hex code ${(payload.hex || '').toUpperCase()} already exists (${match.name})`);
      }
      throw new Error(`Color with name "${match.name}" already exists`);
    }
    const res = await pool.query(
      "INSERT INTO colors (name, hex, owner_id) VALUES ($1, $2, $3) RETURNING id, name, hex, owner_id",
      [payload.name.trim(), payload.hex.trim(), payload.owner_id || null]
    );
    return res.rows[0];
  }
  const items = await readJson(colorsFile);
  const found = items.find((i) =>
    ((i.hex || '').toLowerCase() === cleanHex || ((i.name || '').trim().toLowerCase() === cleanName)) &&
    (i.owner_id === payload.owner_id)
  );
  if (found) {
    if ((found.hex || '').toLowerCase() === cleanHex) {
      throw new Error(`Color with hex code ${(payload.hex || '').toUpperCase()} already exists (${found.name})`);
    }
    throw new Error(`Color with name "${found.name}" already exists`);
  }
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const color = { id, ...payload };
  items.push(color);
  await writeJson(colorsFile, items);
  return color;
}
export async function deleteColor(color_id, ownerId) {
  if (pool) {
    const query = ownerId ? "DELETE FROM colors WHERE id=$1 AND owner_id=$2" : "DELETE FROM colors WHERE id=$1";
    await pool.query(query, ownerId ? [color_id, ownerId] : [color_id]);
    return true;
  }
  const items = await readJson(colorsFile);
  const remaining = items.filter((i) => !(i.id === color_id && (!ownerId || i.owner_id === ownerId)));
  await writeJson(colorsFile, remaining);
  return true;
}
export async function listSizes(ownerId) {
  if (pool) {
    const query = ownerId ? "SELECT id, label, owner_id FROM sizes WHERE owner_id = $1 OR owner_id IS NULL ORDER BY id" : "SELECT id, label, owner_id FROM sizes ORDER BY id";
    const res = await pool.query(query, ownerId ? [ownerId] : []);
    const seen = new Set();
    return res.rows.filter((s) => {
      const key = (s.label || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const items = await readJson(sizesFile);
  const filtered = ownerId ? items.filter((i) => i.owner_id === ownerId) : items;
  const seen = new Set();
  return filtered.filter((s) => {
    const key = (s.label || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export async function createSize(payload) {
  if (pool) {
    try {
      const res = await pool.query("INSERT INTO sizes (label, owner_id) VALUES ($1, $2) RETURNING id, label, owner_id", [payload.label, payload.owner_id || null]);
      return res.rows[0];
    } catch (err) {
      if (err && err.code === "23505") throw new Error("size already exists");
      throw err;
    }
  }
  const items = await readJson(sizesFile);
  const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
  const size = { id, ...payload };
  items.push(size);
  await writeJson(sizesFile, items);
  return size;
}
export async function deleteSize(size_id, ownerId) {
  if (pool) {
    const query = ownerId ? "DELETE FROM sizes WHERE id=$1 AND owner_id=$2" : "DELETE FROM sizes WHERE id=$1";
    await pool.query(query, ownerId ? [size_id, ownerId] : [size_id]);
    return true;
  }
  const items = await readJson(sizesFile);
  const remaining = items.filter((i) => !(i.id === size_id && (!ownerId || i.owner_id === ownerId)));
  await writeJson(sizesFile, remaining);
  return true;
}
export async function upsertInventory(payload) {
  const product = payload.product || "tshirt";
  if (pool) {
    await pool.query(`
      INSERT INTO cloth_inventory (product, color_id, size_id, quantity, price, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (product, color_id, size_id, owner_id) DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price
    `, [product, payload.color_id, payload.size_id, payload.quantity, payload.price, payload.owner_id || null]);
    const rows = await pool.query("SELECT id, product, color_id, size_id, quantity, price, owner_id FROM cloth_inventory WHERE product=$1 AND color_id=$2 AND size_id=$3 AND (owner_id=$4 OR owner_id IS NULL)", [product, payload.color_id, payload.size_id, payload.owner_id || null]);
    return rows.rows[0];
  }
  const items = await readJson(inventoryFile);
  let found = items.find((i) => i.color_id === payload.color_id && i.size_id === payload.size_id && i.product === product && i.owner_id === payload.owner_id);
  if (found) {
    found.quantity = payload.quantity;
    found.price = payload.price;
  } else {
    const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
    const newItem = { id, ...payload };
    newItem.product = product;
    items.push(newItem);
    found = newItem;
  }
  await writeJson(inventoryFile, items);
  return found;
}
export async function listCatalog(ownerId) {
  const colors = await listColors(ownerId);
  const sizes = await listSizes(ownerId);
  if (pool) {
    const query = ownerId ? "SELECT id, product, color_id, size_id, quantity, price, owner_id FROM cloth_inventory WHERE owner_id = $1 ORDER BY id" : "SELECT id, product, color_id, size_id, quantity, price, owner_id FROM cloth_inventory ORDER BY id";
    const invRows = await pool.query(query, ownerId ? [ownerId] : []);
    const inventory2 = invRows.rows;
    return { colors, sizes, inventory: inventory2 };
  }
  const inventory = await readJson(inventoryFile);
  const filteredInv = ownerId ? inventory.filter((i) => i.owner_id === ownerId) : inventory;
  return { colors, sizes, inventory: filteredInv };
}
export async function listSizeChart(product = "tshirt", ownerId) {
  if (pool) {
    const query = ownerId ? "SELECT id, product, size_id, chest, length, shoulder, owner_id FROM size_chart WHERE product=$1 AND owner_id=$2 ORDER BY size_id" : "SELECT id, product, size_id, chest, length, shoulder, owner_id FROM size_chart WHERE product=$1 ORDER BY size_id";
    const rows = await pool.query(query, ownerId ? [product, ownerId] : [product]);
    return rows.rows;
  }
  const file = path.resolve(dataDir, "size_chart.json");
  const all = await readJson(file);
  return all.filter((r) => (r.product || "tshirt") === product && (!ownerId || r.owner_id === ownerId));
}
export async function upsertSizeChart(payload) {
  const product = payload.product || "tshirt";
  const ownerId = payload.owner_id || null;
  if (pool) {
    const byProduct = await pool.query("SELECT id FROM size_chart WHERE product=$1 AND size_id=$2 AND (owner_id=$3 OR owner_id IS NULL) LIMIT 1", [product, payload.size_id, ownerId]);
    if (byProduct.rows.length) {
      const id = byProduct.rows[0].id;
      await pool.query("UPDATE size_chart SET chest=$1, length=$2, shoulder=$3 WHERE id=$4", [payload.chest, payload.length, payload.shoulder, id]);
      const updated = await pool.query("SELECT * FROM size_chart WHERE id=$1", [id]);
      return updated.rows[0];
    }
    const ins = await pool.query("INSERT INTO size_chart (product, size_id, chest, length, shoulder, owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [product, payload.size_id, payload.chest, payload.length, payload.shoulder, ownerId]);
    return ins.rows[0];
  }
  const file = path.resolve(dataDir, "size_chart.json");
  const items = await readJson(file);
  let found = items.find((i) => i.size_id === payload.size_id && (i.product || "tshirt") === product && i.owner_id === ownerId);
  if (found) {
    found.chest = payload.chest;
    found.length = payload.length;
    found.shoulder = payload.shoulder;
  } else {
    const id = (items.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
    found = { id, product, ...payload };
    items.push(found);
  }
  await writeJson(file, items);
  return found;
}
export async function deleteSizeChart(product, size_id, ownerId) {
  if (pool) {
    const query = ownerId ? "DELETE FROM size_chart WHERE product=$1 AND size_id=$2 AND owner_id=$3" : "DELETE FROM size_chart WHERE product=$1 AND size_id=$2";
    await pool.query(query, ownerId ? [product, size_id, ownerId] : [product, size_id]);
    return true;
  }
  const file = path.resolve(dataDir, "size_chart.json");
  let items = await readJson(file);
  items = items.filter((i) => !(i.size_id === size_id && (i.product || "tshirt") === product && (!ownerId || i.owner_id === ownerId)));
  await writeJson(file, items);
  return true;
}
export async function createOrder(supplier_id, items) {
  if (db) {
    const r = await db.insert("orders").values({ supplier_id }).returning();
    const orderId = r[0].id;
    for (const it of items) {
      const product = it.product || "tshirt";
      await pool.query("INSERT INTO order_items (order_id, product, color_id, size_id, quantity, price) VALUES ($1,$2,$3,$4,$5,$6)", [orderId, product, it.color_id, it.size_id, it.quantity, it.price]);
      await pool.query("UPDATE cloth_inventory SET quantity = GREATEST(0, quantity - $1) WHERE product=$2 AND color_id=$3 AND size_id=$4 AND owner_id=$5", [it.quantity, product, it.color_id, it.size_id, supplier_id]);
    }
    return orderId;
  }
  return null;
}
export async function createSupplierOrder(supplier_id, placed_by, items, shipping) {
  if (db) {
    const ins = await pool.query(
      `INSERT INTO supplier_orders (supplier_id, placed_by, customer_name, customer_email, shipping_address, shipping_method, shipping_cost_cents, subtotal_cents, tax_cents, total_cents, currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [supplier_id, placed_by, shipping?.customer_name || null, shipping?.customer_email || null, shipping?.shipping_address || null, shipping?.shipping_method || null, shipping?.shipping_cost_cents || 0, 0, 0, 0, "USD"]
    );
    const orderId = ins.rows[0].id;
    for (const it of items) {
      const product = it.product || "tshirt";
      await pool.query(`INSERT INTO supplier_order_lines (order_id, design_id, design_snapshot, product_sku, size, color, quantity, unit_price_cents, line_total_cents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [orderId, it.design_id || null, it.design_snapshot ? JSON.stringify(it.design_snapshot) : null, product, it.size_id ? String(it.size_id) : null, it.color_id ? String(it.color_id) : null, it.quantity, Math.round(Number(it.price) * 100), Math.round(Number(it.price) * it.quantity * 100)]);
      try {
        await pool.query("UPDATE cloth_inventory SET quantity = GREATEST(0, quantity - $1) WHERE product=$2 AND color_id=$3 AND size_id=$4 AND owner_id=$5", [it.quantity, product, it.color_id, it.size_id, supplier_id]);
      } catch (e) {
      }
    }
    const totals = await pool.query("SELECT SUM(line_total_cents) as subtotal FROM supplier_order_lines WHERE order_id=$1", [orderId]);
    const subtotal = totals.rows[0].subtotal || 0;
    const tax = 0;
    const total = subtotal + tax + (shipping?.shipping_cost_cents || 0);
    await pool.query("UPDATE supplier_orders SET subtotal_cents=$1, tax_cents=$2, total_cents=$3 WHERE id=$4", [subtotal, tax, total, orderId]);
    return orderId;
  }
  return null;
}
export async function listSupplierOrders(supplier_id) {
  if (pool) {
    const rows = await pool.query("SELECT * FROM supplier_orders WHERE supplier_id=$1 ORDER BY created_at DESC", [supplier_id]);
    const orders = rows.rows;
    for (const o of orders) {
      const lines = await pool.query("SELECT * FROM supplier_order_lines WHERE order_id=$1", [o.id]);
      o.items = lines.rows.map((l) => {
        const ds = l.design_snapshot;
        let parsed = null;
        try {
          parsed = ds ? typeof ds === "string" ? JSON.parse(ds) : ds : null;
        } catch (e) {
          parsed = ds;
        }
        return { ...l, design_snapshot: parsed };
      });
    }
    return orders;
  }
  return [];
}
export async function getSupplierOrder(orderId) {
  if (pool) {
    const r = await pool.query("SELECT * FROM supplier_orders WHERE id=$1", [orderId]);
    if (!r.rows.length) return null;
    const o = r.rows[0];
    const lines = await pool.query("SELECT * FROM supplier_order_lines WHERE order_id=$1", [o.id]);
    o.items = lines.rows.map((l) => {
      const ds = l.design_snapshot;
      let parsed = null;
      try {
        parsed = ds ? typeof ds === "string" ? JSON.parse(ds) : ds : null;
      } catch (e) {
        parsed = ds;
      }
      return { ...l, design_snapshot: parsed };
    });
    return o;
  }
  return null;
}
export async function listAllSupplierOrdersForAdmin(ownerId) {
  const colors = await listColors(ownerId);
  const sizes = await listSizes(ownerId);
  if (pool) {
    const rows = await pool.query("SELECT * FROM supplier_orders WHERE supplier_id=$1 ORDER BY created_at DESC", [ownerId]);
    const orders = rows.rows;
    for (const o of orders) {
      const lines = await pool.query("SELECT * FROM supplier_order_lines WHERE order_id=$1", [o.id]);
      o.items = lines.rows.map((l) => {
        const ds = l.design_snapshot;
        let parsed = null;
        try {
          parsed = ds ? typeof ds === "string" ? JSON.parse(ds) : ds : null;
        } catch (e) {
          parsed = ds;
        }
        return { ...l, design_snapshot: parsed };
      });
    }
    const users = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [ownerId]);
    const usersMap = {};
    for (const u of users.rows) usersMap[u.id] = u;
    return orders.map((o) => sanitizeOrderForAdmin(o, usersMap, colors, sizes));
  }
  return [];
}
export async function getSupplierOrderForAdmin(orderId, ownerId) {
  const colors = await listColors(ownerId);
  const sizes = await listSizes(ownerId);
  const ord = await getSupplierOrder(orderId);
  if (!ord || Number(ord.supplier_id) !== ownerId) return null;
  const r = await pool.query("SELECT id, name, email FROM users WHERE id=$1", [ownerId]);
  const user = r.rows[0];
  return sanitizeOrderForAdmin(ord, user ? { [user.id]: user } : {}, colors, sizes);
}
function sanitizeOrderForAdmin(order, usersMap, colors, sizes) {
  const o = { ...order };
  if (o.supplier_id && usersMap && usersMap[o.supplier_id]) {
    o.supplier = { name: usersMap[o.supplier_id].name || null, email: usersMap[o.supplier_id].email || null };
  } else {
    o.supplier = null;
  }
  delete o.supplier_id;
  delete o.placed_by;
  delete o.id;
  o.subtotal = (o.subtotal_cents || 0) / 100;
  o.tax = (o.tax_cents || 0) / 100;
  o.shipping = (o.shipping_cost_cents || 0) / 100;
  o.total = (o.total_cents || 0) / 100;
  delete o.subtotal_cents;
  delete o.tax_cents;
  delete o.shipping_cost_cents;
  delete o.total_cents;
  o.items = (o.items || []).map((it) => {
    const copy = {};
    copy.product = it.product_sku || it.product || null;
    let sizeLabel = it.size;
    const sizeNum = Number(it.size);
    if (!isNaN(sizeNum)) {
      const sz = sizes.find((s) => Number(s.id) === sizeNum);
      if (sz) sizeLabel = sz.label;
    }
    copy.size = sizeLabel || null;
    let colorLabel = it.color;
    const colorNum = Number(it.color);
    if (!isNaN(colorNum)) {
      const c = colors.find((c2) => Number(c2.id) === colorNum);
      if (c) colorLabel = { name: c.name, hex: c.hex };
    }
    copy.color = colorLabel || null;
    copy.quantity = it.quantity || 0;
    copy.unit_price = (it.unit_price_cents || 0) / 100;
    copy.line_total = (it.line_total_cents || 0) / 100;
    if (it.design_snapshot) {
      const ds = typeof it.design_snapshot === "string" ? JSON.parse(it.design_snapshot) : it.design_snapshot;
      copy.design_snapshot = ds;
    } else {
      copy.design_snapshot = null;
    }
    return copy;
  });
  return o;
}
