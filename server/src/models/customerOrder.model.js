import { pool } from '../config/database.js';
import financialSettingsModel from './financialSettings.model.js';

export async function createOrder({
  customerId,
  customerName,
  customerEmail,
  customerPhone,
  designerId = null,
  providerId = null,
  items = [],
  shippingAddress = {},
  paymentMethod = 'razorpay',
  paymentStatus = 'pending',
  status = 'pending',
  currency = 'INR',
  shippingCostCents = 0,
  taxCents = 0,
  notes = '',
  razorpayOrderId = null,
  razorpayPaymentId = null,
  razorpaySignature = null
}) {
  if (!pool) throw new Error('Database pool not available');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Calculate subtotal and line items
    let subtotalCents = 0;
    const validatedItems = [];

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const unitPriceCents = Math.round(Number(item.price || item.unit_price || 0) * 100);
      const totalPriceCents = unitPriceCents * quantity;
      subtotalCents += totalPriceCents;

      validatedItems.push({
        listingId: item.listing_id ? Number(item.listing_id) : null,
        designId: item.design_id ? Number(item.design_id) : null,
        productId: item.product_id ? Number(item.product_id) : null,
        title: item.title || item.product_title || 'Custom Apparel',
        colorId: item.color_id ? String(item.color_id) : null,
        colorName: item.color_name || null,
        colorHex: item.color_hex || null,
        sizeLabel: item.size_label || item.size || 'M',
        quantity,
        unitPriceCents,
        totalPriceCents,
        previewUrl: item.preview_url || null
      });
    }

    // Fetch real-time global financial governance rules set by Portal Admin
    const settings = await financialSettingsModel.getFinancialSettings();

    // Calculate dynamic shipping cost based on global settings
    let effectiveShippingCostCents = shippingCostCents;
    if (settings.shipping_enabled) {
      if (subtotalCents >= Math.round(settings.free_shipping_threshold * 100)) {
        effectiveShippingCostCents = 0;
      } else if (effectiveShippingCostCents === 0 && subtotalCents > 0) {
        effectiveShippingCostCents = Math.round(settings.standard_shipping_charge * 100);
      }
    } else {
      effectiveShippingCostCents = 0;
    }

    // Dynamic GST tax calculation based on global governance settings
    let effectiveTaxCents = Math.round(Number(taxCents || 0));
    if (settings.gst_enabled && Number(settings.tax_percent) > 0 && subtotalCents > 0) {
      effectiveTaxCents = Math.round(subtotalCents * (Number(settings.tax_percent) / 100));
    } else if (settings.gst_enabled === false) {
      effectiveTaxCents = 0;
    }

    const totalCents = subtotalCents + effectiveShippingCostCents + effectiveTaxCents;

    // Dynamic global financial split configured by Portal Superadmin:
    const pctFee = Math.round(subtotalCents * (settings.platform_fee_percent / 100));
    const fixedFee = Math.round(settings.platform_fixed_fee * 100);
    const platformFeeCents = Math.max(0, pctFee + fixedFee);

    let designerEarningsCents = 0;
    let providerEarningsCents = 0;

    if (designerId && Number(designerId) !== Number(providerId)) {
      providerEarningsCents = Math.round(subtotalCents * (settings.provider_margin_percent / 100));
      designerEarningsCents = Math.max(0, subtotalCents - providerEarningsCents - platformFeeCents);
    } else {
      providerEarningsCents = Math.max(0, subtotalCents - platformFeeCents);
      designerEarningsCents = 0;
    }

    // Generate readable order number: ORD-DDMMYYYY-XXXX
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randSuffix}`;

    const orderRes = await client.query(
      `INSERT INTO orders (
        order_number, customer_id, customer_name, customer_email, customer_phone,
        designer_id, provider_id, status, payment_status, payment_method,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        currency, subtotal_cents, shipping_cost_cents, tax_cents, total_cents,
        designer_earnings_cents, provider_earnings_cents, platform_fee_cents,
        shipping_address, notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
      RETURNING *`,
      [
        orderNumber,
        customerId ? Number(customerId) : null,
        customerName,
        customerEmail,
        customerPhone || null,
        designerId ? Number(designerId) : null,
        providerId ? Number(providerId) : null,
        status,
        paymentStatus,
        paymentMethod,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        currency,
        subtotalCents,
        effectiveShippingCostCents,
        effectiveTaxCents,
        totalCents,
        designerEarningsCents,
        providerEarningsCents,
        platformFeeCents,
        JSON.stringify(shippingAddress),
        notes || null
      ]
    );

    const createdOrder = orderRes.rows[0];

    // Insert line items
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, listing_id, design_id, product_id, product_title,
          color_id, color_name, color_hex, size_label, quantity,
          unit_price_cents, total_price_cents, preview_url, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
        [
          createdOrder.id,
          item.listingId,
          item.designId,
          item.productId,
          item.title,
          item.colorId,
          item.colorName,
          item.colorHex,
          item.sizeLabel,
          item.quantity,
          item.unitPriceCents,
          item.totalPriceCents,
          item.previewUrl
        ]
      );

      // Decrement cloth inventory if linked to provider & product
      if (providerId && item.productId && item.colorId && item.sizeLabel) {
        try {
          await client.query(
            `UPDATE cloth_inventory 
             SET quantity = GREATEST(0, quantity - $1)
             WHERE owner_id = $2 AND color_id = $3 AND product ILIKE $4`,
            [item.quantity, providerId, Number(item.colorId) || 0, `%${item.title}%`]
          );
        } catch (e) {
          // ignore inventory decrement failures to prevent blocking order
        }
      }
    }

    // Insert into payments ledger if already paid/captured
    if (paymentStatus === 'paid' && (razorpayPaymentId || paymentMethod)) {
      const txId = razorpayPaymentId || `TX-${orderNumber}`;
      await client.query(
        `INSERT INTO payments (
          order_id, transaction_id, gateway, payment_method, amount_cents, currency, status, raw_payload, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'captured',$7,NOW())
        ON CONFLICT (transaction_id) DO NOTHING`,
        [
          createdOrder.id,
          txId,
          paymentMethod === 'razorpay' ? 'razorpay' : 'cod',
          paymentMethod,
          totalCents,
          currency,
          JSON.stringify({ razorpayOrderId, razorpayPaymentId, razorpaySignature })
        ]
      );
    }

    await client.query('COMMIT');
    return await getOrderById(createdOrder.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrderById(orderId) {
  if (!pool) return null;
  const res = await pool.query(
    `SELECT o.*,
            c.name as customer_account_name, c.email as customer_account_email,
            d.name as designer_name, d.email as designer_email,
            p.name as provider_name, p.email as provider_email
     FROM orders o
     LEFT JOIN users c ON c.id = o.customer_id
     LEFT JOIN users d ON d.id = o.designer_id
     LEFT JOIN users p ON p.id = o.provider_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!res.rows.length) return null;
  const order = res.rows[0];

  const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [order.id]);
  order.items = itemsRes.rows.map(formatOrderItem);

  const paymentsRes = await pool.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC', [order.id]);
  order.payments = paymentsRes.rows;

  return formatOrder(order);
}

export async function getOrderByNumber(orderNumber) {
  if (!pool) return null;
  const res = await pool.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
  if (!res.rows.length) return null;
  return await getOrderById(res.rows[0].id);
}

export async function listOrdersByCustomer(customerId) {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT o.*,
            d.name as designer_name,
            p.name as provider_name
     FROM orders o
     LEFT JOIN users d ON d.id = o.designer_id
     LEFT JOIN users p ON p.id = o.provider_id
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC`,
    [customerId]
  );

  const orders = [];
  for (const row of res.rows) {
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [row.id]);
    row.items = itemsRes.rows.map(formatOrderItem);
    orders.push(formatOrder(row));
  }
  return orders;
}

export async function listOrdersByDesigner(designerId) {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT o.*,
            p.name as provider_name,
            p.email as provider_email
     FROM orders o
     LEFT JOIN users p ON p.id = o.provider_id
     WHERE o.designer_id = $1
     ORDER BY o.created_at DESC`,
    [designerId]
  );

  const orders = [];
  for (const row of res.rows) {
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [row.id]);
    row.items = itemsRes.rows.map(formatOrderItem);
    orders.push(formatOrder(row));
  }
  return orders;
}

export async function listOrdersByProvider(providerId) {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT o.*,
            d.name as designer_name,
            d.email as designer_email
     FROM orders o
     LEFT JOIN users d ON d.id = o.designer_id
     WHERE o.provider_id = $1
     ORDER BY o.created_at DESC`,
    [providerId]
  );

  const orders = [];
  for (const row of res.rows) {
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [row.id]);
    row.items = itemsRes.rows.map(formatOrderItem);
    orders.push(formatOrder(row));
  }
  return orders;
}

export async function listAllOrdersForAdmin() {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT o.*,
            d.name as designer_name,
            p.name as provider_name
     FROM orders o
     LEFT JOIN users d ON d.id = o.designer_id
     LEFT JOIN users p ON p.id = o.provider_id
     ORDER BY o.created_at DESC`
  );

  const orders = [];
  for (const row of res.rows) {
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [row.id]);
    row.items = itemsRes.rows.map(formatOrderItem);
    orders.push(formatOrder(row));
  }
  return orders;
}

export async function updateOrderStatus(orderId, status, trackingInfo = null) {
  if (!pool) return null;
  const updates = ['status = $2', 'updated_at = NOW()'];
  const values = [orderId, status];

  if (trackingInfo) {
    updates.push(`tracking_info = $${values.length + 1}`);
    values.push(JSON.stringify(trackingInfo));
  }

  const res = await pool.query(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  if (!res.rows.length) return null;
  return await getOrderById(orderId);
}

export async function updatePaymentStatus(orderId, {
  paymentStatus,
  razorpayPaymentId = null,
  razorpaySignature = null,
  rawPayload = {}
}) {
  if (!pool) return null;
  const res = await pool.query(
    `UPDATE orders 
     SET payment_status = $2,
         razorpay_payment_id = COALESCE($3, razorpay_payment_id),
         razorpay_signature = COALESCE($4, razorpay_signature),
         status = CASE WHEN $2 = 'paid' AND status = 'pending' THEN 'confirmed' ELSE status END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, paymentStatus, razorpayPaymentId, razorpaySignature]
  );
  if (!res.rows.length) return null;

  const order = res.rows[0];

  // Record payment in payments ledger if paid
  if (paymentStatus === 'paid' && razorpayPaymentId) {
    await pool.query(
      `INSERT INTO payments (
        order_id, transaction_id, gateway, payment_method, amount_cents, currency, status, raw_payload, created_at
      ) VALUES ($1,$2,'razorpay','online',$3,$4,'captured',$5,NOW())
      ON CONFLICT (transaction_id) DO NOTHING`,
      [order.id, razorpayPaymentId, order.total_cents, order.currency, JSON.stringify(rawPayload)]
    );
  }

  return await getOrderById(orderId);
}

function formatOrderItem(item) {
  return {
    id: item.id,
    order_id: item.order_id,
    listing_id: item.listing_id,
    design_id: item.design_id,
    product_id: item.product_id,
    title: item.product_title,
    color_id: item.color_id,
    color_name: item.color_name,
    color_hex: item.color_hex,
    size: item.size_label,
    quantity: item.quantity,
    unit_price: (item.unit_price_cents || 0) / 100,
    total_price: (item.total_price_cents || 0) / 100,
    preview_url: item.preview_url
  };
}

function formatDDMMYYYY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatOrder(order) {
  return {
    ...order,
    created_at_formatted: formatDDMMYYYY(order.created_at),
    updated_at_formatted: formatDDMMYYYY(order.updated_at),
    subtotal: (order.subtotal_cents || 0) / 100,
    shipping_cost: (order.shipping_cost_cents || 0) / 100,
    tax: (order.tax_cents || 0) / 100,
    total: (order.total_cents || 0) / 100,
    designer_earnings: (order.designer_earnings_cents || 0) / 100,
    provider_earnings: (order.provider_earnings_cents || 0) / 100,
    platform_fee: (order.platform_fee_cents || 0) / 100,
    shipping_address: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address,
    tracking_info: typeof order.tracking_info === 'string' ? JSON.parse(order.tracking_info) : order.tracking_info
  };
}

export default {
  createOrder,
  getOrderById,
  getOrderByNumber,
  listOrdersByCustomer,
  listOrdersByDesigner,
  listOrdersByProvider,
  listAllOrdersForAdmin,
  updateOrderStatus,
  updatePaymentStatus
};

