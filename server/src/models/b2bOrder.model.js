import { pool } from '../config/database.js';
import b2bFinancialSettingsModel from './b2bFinancialSettings.model.js';

function generateOrderNumber() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `B2B-${day}${month}${year}-${rand}`;
}

export async function createB2BOrder({
  designerId,
  providerId,
  items = [],
  shippingAddress = {},
  designerNotes = '',
  paymentMethod = 'razorpay'
}) {
  if (!pool) throw new Error('Database pool not available');
  if (!designerId) throw new Error('Designer authentication required');
  if (!providerId) throw new Error('Print Provider ID is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one product item is required');
  }

  // 1. Calculate live quotation
  const quote = await b2bFinancialSettingsModel.calculateB2BQuote(items);

  const orderType = quote.orderType || (quote.totalUnits <= 1 ? 'sample' : 'bulk');
  const orderNumber = generateOrderNumber();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertOrderQuery = `
      INSERT INTO b2b_designer_orders (
        order_number, designer_id, provider_id, order_type, total_quantity,
        base_subtotal_cents, discount_cents, subtotal_cents,
        shipping_cost_cents, tax_cents, total_cents,
        b2b_platform_fee_percent, platform_commission_cents, provider_earnings_cents,
        payment_status, payment_method, status,
        shipping_address, designer_notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17,
        $18, $19, NOW(), NOW()
      ) RETURNING *
    `;

    const orderValues = [
      orderNumber,
      Number(designerId),
      Number(providerId),
      orderType,
      quote.totalUnits,
      quote.rawSubtotalCents,
      quote.discountCents,
      quote.netSubtotalCents,
      quote.shippingCostCents,
      quote.taxCents,
      quote.totalCents,
      quote.b2bPlatformFeePercent,
      quote.platformCommissionCents,
      quote.providerEarningsCents,
      'pending',
      paymentMethod,
      'pending',
      JSON.stringify(shippingAddress || {}),
      designerNotes || null
    ];

    const orderRes = await client.query(insertOrderQuery, orderValues);
    const order = orderRes.rows[0];

    // Insert line items
    const insertedItems = [];
    for (const it of items) {
      const q = Math.max(1, Number(it.quantity || 1));
      const unitCents = Math.round(Number(it.unit_price_cents || 0));
      const lineCents = unitCents * q;

      let mockupUrl = it.custom_mockup_url || null;
      if ((!mockupUrl || mockupUrl === '/templates/tshirt.png') && it.product_id) {
        try {
          const pfRes = await client.query('SELECT designs FROM products_full WHERE id = $1', [Number(it.product_id)]);
          if (pfRes.rows[0]?.designs) {
            const d = pfRes.rows[0].designs;
            if (Array.isArray(d) && d.length > 0) {
              mockupUrl = d[0]?.image || d[1]?.image || null;
            } else if (d && typeof d === 'object') {
              mockupUrl = d.front?.image || d.back?.image || null;
            }
          }
        } catch (imgErr) {
          console.warn('[B2B Order] Could not resolve garment design image:', imgErr.message);
        }
      }

      const itemRes = await client.query(
        `INSERT INTO b2b_designer_order_items (
          b2b_order_id, product_id, product_name, product_sku,
          color_name, color_hex, garment_size,
          custom_design_id, custom_mockup_url,
          quantity, unit_price_cents, line_total_cents, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *`,
        [
          order.id,
          it.product_id ? Number(it.product_id) : null,
          it.product_name || 'Wholesale Garment',
          it.product_sku || null,
          it.color_name || 'Standard',
          it.color_hex || null,
          it.garment_size || 'L',
          it.custom_design_id ? Number(it.custom_design_id) : null,
          mockupUrl || it.custom_mockup_url || '/templates/tshirt.png',
          q,
          unitCents,
          lineCents
        ]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    return { ...order, items: insertedItems, quote };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function attachRazorpayOrder(orderId, razorpayOrderId) {
  if (!pool) return null;
  const res = await pool.query(
    'UPDATE b2b_designer_orders SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [razorpayOrderId, Number(orderId)]
  );
  return res.rows[0] || null;
}

export async function markOrderPaid(orderId, { razorpayPaymentId, razorpayOrderId, razorpaySignature }) {
  if (!pool) return null;
  const res = await pool.query(
    `UPDATE b2b_designer_orders
     SET payment_status = 'paid',
         status = 'confirmed',
         razorpay_payment_id = $1,
         razorpay_order_id = COALESCE($2, razorpay_order_id),
         razorpay_signature = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [razorpayPaymentId, razorpayOrderId, razorpaySignature, Number(orderId)]
  );
  return res.rows[0] || null;
}

export async function getB2BOrderById(orderId) {
  if (!pool) return null;
  const orderRes = await pool.query(
    `SELECT o.*,
            d.name as designer_name, d.email as designer_email,
            p.name as provider_name, p.email as provider_email
     FROM b2b_designer_orders o
     JOIN users d ON d.id = o.designer_id
     JOIN users p ON p.id = o.provider_id
     WHERE o.id = $1`,
    [Number(orderId)]
  );
  if (orderRes.rows.length === 0) return null;
  const order = orderRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT i.*,
            COALESCE(
              NULLIF(i.custom_mockup_url, '/templates/tshirt.png'),
              pf.designs->0->>'image',
              pf.designs->1->>'image',
              i.custom_mockup_url,
              '/templates/tshirt.png'
            ) AS custom_mockup_url
     FROM b2b_designer_order_items i
     LEFT JOIN products_full pf ON pf.id = i.product_id
     WHERE i.b2b_order_id = $1
     ORDER BY i.id ASC`,
    [Number(orderId)]
  );
  return { ...order, items: itemsRes.rows };
}

export async function listOrdersForDesigner(designerId) {
  if (!pool) return [];
  const query = `
    SELECT o.*,
           p.name as provider_name, p.email as provider_email,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', i.id,
                 'product_id', i.product_id,
                 'product_name', i.product_name,
                 'color_name', i.color_name,
                 'color_hex', i.color_hex,
                 'garment_size', i.garment_size,
                 'quantity', i.quantity,
                 'unit_price_cents', i.unit_price_cents,
                 'line_total_cents', i.line_total_cents,
                 'custom_mockup_url', COALESCE(
                   NULLIF(i.custom_mockup_url, '/templates/tshirt.png'),
                   pf.designs->0->>'image',
                   pf.designs->1->>'image',
                   i.custom_mockup_url,
                   '/templates/tshirt.png'
                 )
               ) ORDER BY i.id ASC
             ) FILTER (WHERE i.id IS NOT NULL), '[]'
           ) as items
    FROM b2b_designer_orders o
    JOIN users p ON p.id = o.provider_id
    LEFT JOIN b2b_designer_order_items i ON i.b2b_order_id = o.id
    LEFT JOIN products_full pf ON pf.id = i.product_id
    WHERE o.designer_id = $1
    GROUP BY o.id, p.name, p.email
    ORDER BY o.created_at DESC
  `;
  const res = await pool.query(query, [Number(designerId)]);
  return res.rows;
}

export async function listOrdersForProvider(providerId) {
  if (!pool) return [];
  const query = `
    SELECT o.*,
           d.name as designer_name, d.email as designer_email,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', i.id,
                 'product_id', i.product_id,
                 'product_name', i.product_name,
                 'color_name', i.color_name,
                 'color_hex', i.color_hex,
                 'garment_size', i.garment_size,
                 'quantity', i.quantity,
                 'unit_price_cents', i.unit_price_cents,
                 'line_total_cents', i.line_total_cents,
                 'custom_mockup_url', COALESCE(
                   NULLIF(i.custom_mockup_url, '/templates/tshirt.png'),
                   pf.designs->0->>'image',
                   pf.designs->1->>'image',
                   i.custom_mockup_url,
                   '/templates/tshirt.png'
                 )
               ) ORDER BY i.id ASC
             ) FILTER (WHERE i.id IS NOT NULL), '[]'
           ) as items
    FROM b2b_designer_orders o
    JOIN users d ON d.id = o.designer_id
    LEFT JOIN b2b_designer_order_items i ON i.b2b_order_id = o.id
    LEFT JOIN products_full pf ON pf.id = i.product_id
    WHERE o.provider_id = $1
    GROUP BY o.id, d.name, d.email
    ORDER BY o.created_at DESC
  `;
  const res = await pool.query(query, [Number(providerId)]);
  return res.rows;
}

export async function listAllB2BOrdersForAdmin() {
  if (!pool) return [];
  const query = `
    SELECT o.*,
           d.name as designer_name, d.email as designer_email,
           p.name as provider_name, p.email as provider_email,
           COUNT(i.id) as item_count
    FROM b2b_designer_orders o
    JOIN users d ON d.id = o.designer_id
    JOIN users p ON p.id = o.provider_id
    LEFT JOIN b2b_designer_order_items i ON i.b2b_order_id = o.id
    GROUP BY o.id, d.name, d.email, p.name, p.email
    ORDER BY o.created_at DESC
  `;
  const res = await pool.query(query);
  return res.rows;
}

export async function updateOrderStatus(orderId, status, trackingInfo = null, providerId = null) {
  if (!pool) return null;
  const updates = ['status = $1', 'updated_at = NOW()'];
  const values = [status, Number(orderId)];
  let idx = 3;

  if (trackingInfo) {
    updates.push(`tracking_info = $${idx++}`);
    values.push(JSON.stringify(trackingInfo));
  }

  let providerClause = '';
  if (providerId) {
    providerClause = ` AND provider_id = $${idx++}`;
    values.push(Number(providerId));
  }

  const query = `
    UPDATE b2b_designer_orders
    SET ${updates.join(', ')}
    WHERE id = $2 ${providerClause}
    RETURNING *
  `;

  const res = await pool.query(query, values);
  return res.rows[0] || null;
}

export default {
  createB2BOrder,
  attachRazorpayOrder,
  markOrderPaid,
  getB2BOrderById,
  listOrdersForDesigner,
  listOrdersForProvider,
  listAllB2BOrdersForAdmin,
  updateOrderStatus
};

