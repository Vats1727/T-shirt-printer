import { pool } from '../config/database.js';
import productModel from './product.model.js';

export async function createSupplierOrder(supplier_id, placed_by, items, shipping) {
  if (!pool) return null;

  const ins = await pool.query(
    `INSERT INTO supplier_orders (supplier_id, placed_by, customer_name, customer_email, shipping_address, shipping_method, shipping_cost_cents, subtotal_cents, tax_cents, total_cents, currency, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',NOW()) RETURNING id`,
    [
      supplier_id,
      placed_by,
      shipping?.customer_name || null,
      shipping?.customer_email || null,
      shipping?.shipping_address || null,
      shipping?.shipping_method || null,
      shipping?.shipping_cost_cents || 0,
      0,
      0,
      0,
      'USD'
    ]
  );
  const orderId = ins.rows[0].id;

  for (const it of items) {
    const product = it.product || 'tshirt';
    await pool.query(
      `INSERT INTO supplier_order_lines (order_id, design_id, design_snapshot, product_sku, size, color, quantity, unit_price_cents, line_total_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        orderId,
        it.design_id || null,
        it.design_snapshot ? JSON.stringify(it.design_snapshot) : null,
        product,
        it.size_id ? String(it.size_id) : null,
        it.color_id ? String(it.color_id) : null,
        it.quantity,
        Math.round(Number(it.price) * 100),
        Math.round(Number(it.price) * it.quantity * 100)
      ]
    );

    try {
      await pool.query(
        'UPDATE cloth_inventory SET quantity = GREATEST(0, quantity - $1) WHERE product=$2 AND color_id=$3 AND size_id=$4 AND owner_id=$5',
        [it.quantity, product, it.color_id, it.size_id, supplier_id]
      );
    } catch (e) {
      // ignore inventory decrement failures
    }
  }

  const totals = await pool.query('SELECT SUM(line_total_cents) as subtotal FROM supplier_order_lines WHERE order_id=$1', [orderId]);
  const subtotal = totals.rows[0].subtotal || 0;
  const tax = 0;
  const total = subtotal + tax + (shipping?.shipping_cost_cents || 0);
  await pool.query('UPDATE supplier_orders SET subtotal_cents=$1, tax_cents=$2, total_cents=$3 WHERE id=$4', [subtotal, tax, total, orderId]);

  return orderId;
}

export async function listSupplierOrders(userId) {
  if (!pool) return [];
  const rows = await pool.query(
    `SELECT so.*, 
            prov.name as provider_name, 
            prov.email as provider_email,
            u.name as designer_name, 
            u.email as designer_email
     FROM supplier_orders so
     LEFT JOIN users prov ON prov.id = so.supplier_id
     LEFT JOIN users u ON u.id = so.placed_by
     WHERE so.placed_by=$1 OR so.supplier_id=$1
     ORDER BY so.created_at DESC`,
    [userId]
  );
  const orders = rows.rows;
  for (const o of orders) {
    const lines = await pool.query(
      `SELECT sol.*, pf.name as product_name, pf.slug as product_slug, pf.designs as product_designs
       FROM supplier_order_lines sol
       LEFT JOIN products_full pf ON pf.id = sol.product_id
       WHERE sol.order_id=$1`,
      [o.id]
    );
    o.subtotal = (o.subtotal_cents || 0) / 100;
    o.tax = (o.tax_cents || 0) / 100;
    o.shipping = (o.shipping_cost_cents || 0) / 100;
    o.total = (o.total_cents || 0) / 100;
    o.items = lines.rows.map((l) => {
      const ds = l.design_snapshot;
      let parsed = null;
      try { parsed = ds ? (typeof ds === 'string' ? JSON.parse(ds) : ds) : null; } catch (e) { parsed = ds; }
      
      let image = null;
      let rawDes = l.product_designs;
      try {
        if (typeof rawDes === 'string') rawDes = JSON.parse(rawDes);
      } catch (e) {}

      if (Array.isArray(rawDes)) {
        image = rawDes[0]?.image || rawDes[0]?.image_url || null;
      } else if (rawDes && typeof rawDes === 'object') {
        image = rawDes.front?.image || rawDes.front?.image_url || rawDes.image || null;
      }

      return {
        ...l,
        product: l.product_name || l.product_sku || 'Garment',
        product_slug: l.product_slug || null,
        image,
        unit_price: (l.unit_price_cents || 0) / 100,
        line_total: (l.line_total_cents || 0) / 100,
        design_snapshot: parsed
      };
    });
  }
  return orders;
}

export async function getSupplierOrder(orderId) {
  if (!pool) return null;
  const r = await pool.query('SELECT * FROM supplier_orders WHERE id=$1', [orderId]);
  if (!r.rows.length) return null;
  const o = r.rows[0];
  const lines = await pool.query('SELECT * FROM supplier_order_lines WHERE order_id=$1', [o.id]);
  o.items = lines.rows.map((l) => {
    const ds = l.design_snapshot;
    let parsed = null;
    try { parsed = ds ? (typeof ds === 'string' ? JSON.parse(ds) : ds) : null; } catch (e) { parsed = ds; }
    return { ...l, design_snapshot: parsed };
  });
  return o;
}

export async function listOrdersForAdmin(ownerId) {
  if (!pool) return [];
  const colors = await productModel.listColors(ownerId);
  const sizes = await productModel.listSizes(ownerId);

  const rows = await pool.query(
    `SELECT so.*, u.name as designer_name, u.email as designer_email
     FROM supplier_orders so
     LEFT JOIN users u ON u.id = so.placed_by
     WHERE so.supplier_id=$1
        OR so.id IN (
          SELECT sol.order_id 
          FROM supplier_order_lines sol 
          JOIN products_full pf ON pf.id = sol.product_id 
          WHERE pf.owner_id = $1
        )
     ORDER BY so.created_at DESC`,
    [ownerId]
  );
  const orders = rows.rows;
  for (const o of orders) {
    const lines = await pool.query('SELECT * FROM supplier_order_lines WHERE order_id=$1', [o.id]);
    o.items = lines.rows.map((l) => {
      const ds = l.design_snapshot;
      let parsed = null;
      try { parsed = ds ? (typeof ds === 'string' ? JSON.parse(ds) : ds) : null; } catch (e) { parsed = ds; }
      return { ...l, design_snapshot: parsed };
    });
  }

  const users = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [ownerId]);
  const usersMap = {};
  for (const u of users.rows) usersMap[u.id] = u;

  return orders.map((o) => sanitizeOrderForAdmin(o, usersMap, colors, sizes));
}

export async function getOrderForAdmin(orderId, ownerId) {
  if (!pool) return null;
  const colors = await productModel.listColors(ownerId);
  const sizes = await productModel.listSizes(ownerId);
  const ord = await getSupplierOrder(orderId);
  if (!ord || Number(ord.supplier_id) !== Number(ownerId)) return null;
  const r = await pool.query('SELECT id, name, email FROM users WHERE id=$1', [ownerId]);
  const user = r.rows[0];
  return sanitizeOrderForAdmin(ord, user ? { [user.id]: user } : {}, colors, sizes);
}

export async function createDesignerPurchaseRequest({ designerId, providerId, productId, productSku, size, color, quantity = 1, unitPrice = 0, shipping = {} }) {
  if (!pool) return null;

  const unitPriceCents = Math.round(Number(unitPrice || 0) * 100);
  const subtotalCents = unitPriceCents * Number(quantity || 1);
  const totalCents = subtotalCents + (shipping?.shipping_cost_cents || 0);

  const ins = await pool.query(
    `INSERT INTO supplier_orders (supplier_id, placed_by, customer_name, customer_email, shipping_address, shipping_method, shipping_cost_cents, subtotal_cents, tax_cents, total_cents, currency, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, 'INR', 'pending', NOW(), NOW())
     RETURNING id, status, created_at`,
    [
      providerId,
      designerId,
      shipping?.customer_name || null,
      shipping?.customer_email || null,
      shipping?.shipping_address ? JSON.stringify(shipping.shipping_address) : null,
      shipping?.shipping_method || 'Standard',
      shipping?.shipping_cost_cents || 0,
      subtotalCents,
      totalCents
    ]
  );
  const orderId = ins.rows[0].id;

  await pool.query(
    `INSERT INTO supplier_order_lines (order_id, product_id, product_sku, size, color, quantity, unit_price_cents, line_total_cents, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      orderId,
      productId ? Number(productId) : null,
      productSku || String(productId || 'tshirt'),
      size ? String(size) : null,
      color ? String(color) : null,
      Number(quantity || 1),
      unitPriceCents,
      subtotalCents
    ]
  );

  return { orderId, status: 'pending', created_at: ins.rows[0].created_at };
}

export async function getDesignerProductPurchaseStatus(designerId, productId, providerId = null) {
  if (!pool) return { status: 'none', canSave: false, order: null };

  const query = `
    SELECT so.id, so.status, so.created_at, so.total_cents, sol.quantity, sol.size, sol.color, sol.unit_price_cents, sol.line_total_cents, pf.name as product_name
    FROM supplier_orders so
    JOIN supplier_order_lines sol ON sol.order_id = so.id
    LEFT JOIN products_full pf ON pf.id = sol.product_id
    WHERE so.placed_by = $1
      AND (sol.product_id = $2 OR sol.product_sku = $2::text)
      AND ($3::int IS NULL OR so.supplier_id = $3)
    ORDER BY so.id DESC
    LIMIT 1
  `;
  const res = await pool.query(query, [Number(designerId), Number(productId), providerId ? Number(providerId) : null]);
  if (!res.rows.length) {
    return { status: 'none', canSave: false, order: null };
  }

  const row = res.rows[0];
  const approvedStatuses = ['confirmed', 'paid', 'processing', 'completed'];
  const isApproved = approvedStatuses.includes((row.status || '').toLowerCase());
  const isPending = (row.status || '').toLowerCase() === 'pending';
  const isRejected = ['cancelled', 'rejected'].includes((row.status || '').toLowerCase());

  let status = 'none';
  if (isApproved) status = 'approved';
  else if (isPending) status = 'pending';
  else if (isRejected) status = 'rejected';
  else status = row.status;

  return {
    status,
    canSave: true, // Designers are permitted to design and save without purchase requirement
    order: {
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      quantity: row.quantity,
      size: row.size,
      color: row.color,
      unit_price: (row.unit_price_cents || 0) / 100,
      total: (row.total_cents || 0) / 100,
      product_name: row.product_name
    }
  };
}

export async function hasDesignerApprovedPurchase(designerId, productId, providerId = null) {
  return true;
}


export async function updateOrderStatus(orderId, status, providerId = null) {
  if (!pool) return null;
  const res = await pool.query(
    `UPDATE supplier_orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND ($3::int IS NULL OR supplier_id = $3)
     RETURNING *`,
    [status, Number(orderId), providerId ? Number(providerId) : null]
  );
  return res.rows[0] || null;
}

function sanitizeOrderForAdmin(order, usersMap, colors, sizes) {
  const o = { ...order };
  if (o.supplier_id && usersMap && usersMap[o.supplier_id]) {
    o.supplier = { name: usersMap[o.supplier_id].name || null, email: usersMap[o.supplier_id].email || null };
  } else {
    o.supplier = null;
  }
  if (o.designer_name || o.designer_email) {
    o.designer = { name: o.designer_name || 'Designer', email: o.designer_email || null };
  } else {
    o.designer = null;
  }
  // Keep order ID for administrative action, but do not leak placed_by directly
  delete o.supplier_id;
  delete o.placed_by;
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
    copy.product_id = it.product_id || null;
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
      const c = colors.find((c) => Number(c.id) === colorNum);
      if (c) colorLabel = { name: c.name, hex: c.hex };
    }
    copy.color = colorLabel || null;
    copy.quantity = it.quantity || 0;
    copy.unit_price = (it.unit_price_cents || 0) / 100;
    copy.line_total = (it.line_total_cents || 0) / 100;
    if (it.design_snapshot) {
      const ds = typeof it.design_snapshot === 'string' ? JSON.parse(it.design_snapshot) : it.design_snapshot;
      copy.design_snapshot = ds;
    } else {
      copy.design_snapshot = null;
    }
    return copy;
  });
  return o;
}

export default {
  createSupplierOrder,
  listSupplierOrders,
  getSupplierOrder,
  listOrdersForAdmin,
  getOrderForAdmin,
  createDesignerPurchaseRequest,
  getDesignerProductPurchaseStatus,
  hasDesignerApprovedPurchase,
  updateOrderStatus
};
