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

    // Strict Apparel Marketplace Governance: Verify that all products are approved and mapped to active garments
    for (const item of items) {
      const prodId = item.product_id ? Number(item.product_id) : null;
      const listingId = item.listing_id ? Number(item.listing_id) : null;
      let checkProdId = prodId;

      if (!checkProdId && listingId) {
        const lRow = await client.query(
          `SELECT d.product_id FROM listings l 
           LEFT JOIN designs d ON d.id = CASE WHEN l.design_key ~ '^[0-9]+$' THEN l.design_key::int WHEN l.design_key ~ '^design-\\d+$' THEN substring(l.design_key from 8)::int ELSE NULL END
           WHERE l.id = $1`,
          [listingId]
        );
        if (lRow.rows[0]?.product_id) {
          checkProdId = Number(lRow.rows[0].product_id);
        }
      }

      if (checkProdId) {
        const pCheck = await client.query(
          `SELECT pf.id, pf.name, pf.is_approved, pf.garment_id, amg.is_active as garment_active
           FROM products_full pf
           LEFT JOIN apparel_master_garments amg ON amg.id = pf.garment_id
           WHERE pf.id = $1`,
          [checkProdId]
        );
        if (pCheck.rows.length === 0) {
          const err = new Error(`Product #${checkProdId} not found in marketplace catalog`);
          err.statusCode = 422;
          throw err;
        }
        const p = pCheck.rows[0];
        if (!p.garment_id || p.garment_active === false) {
          const err = new Error(`Cannot purchase product "${p.name}": master garment is unmapped or inactive.`);
          err.statusCode = 422;
          throw err;
        }
      }
    }

    // Calculate subtotal and line items
    let subtotalCents = 0;
    const validatedItems = [];

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const unitPriceCents = Math.round(Number(item.price || item.unit_price || 0) * 100);
      const totalPriceCents = unitPriceCents * quantity;
      subtotalCents += totalPriceCents;

      let resolvedDesignId = item.design_id ? Number(item.design_id) : null;
      let printFileUrl = item.print_file_url || null;
      let backPrintFileUrl = item.back_print_file_url || null;
      let backPreviewUrl = item.back_preview_url || item.preview_back_url || null;

      if ((!printFileUrl || !backPrintFileUrl) && (resolvedDesignId || item.listing_id)) {
        try {
          const dQuery = resolvedDesignId
            ? `SELECT d.id, d.image, d.back_image FROM designs d WHERE d.id = $1`
            : `SELECT d.id, d.image, d.back_image FROM listings l
               JOIN designs d ON (d.id = substring(l.design_key from 'design-([0-9]+)')::int)
               WHERE l.id = $1`;
          const dParam = resolvedDesignId || Number(item.listing_id);
          const dRow = await client.query(dQuery, [dParam]);
          if (dRow.rows.length) {
            resolvedDesignId = resolvedDesignId || dRow.rows[0].id;
            if (!printFileUrl && dRow.rows[0].image) printFileUrl = dRow.rows[0].image;
            if (!backPrintFileUrl && dRow.rows[0].back_image) backPrintFileUrl = dRow.rows[0].back_image;
          }
        } catch (e) {
          // ignore lookup error
        }
      }

      const standardFrontDimensions = item.print_dimensions || {
        width_in: 11.0,
        height_in: 13.5,
        width_cm: 27.9,
        height_cm: 34.3,
        top_offset_in: 2.5,
        top_offset_cm: 6.35,
        location: "Center Front Chest",
        platen_type: "Adult Standard (14x16 in)",
        resolution_dpi: 300,
        underbase_required: true,
        curing_temp_c: 160,
        curing_time_sec: 15
      };

      const standardBackDimensions = item.back_print_dimensions || {
        width_in: 11.0,
        height_in: 13.5,
        width_cm: 27.9,
        height_cm: 34.3,
        top_offset_in: 3.0,
        top_offset_cm: 7.62,
        location: "Center Upper Back",
        platen_type: "Adult Standard (14x16 in)",
        resolution_dpi: 300,
        underbase_required: true,
        curing_temp_c: 160,
        curing_time_sec: 15
      };

      validatedItems.push({
        listingId: item.listing_id ? Number(item.listing_id) : null,
        designId: resolvedDesignId,
        productId: item.product_id ? Number(item.product_id) : null,
        title: item.title || item.product_title || 'Custom Apparel',
        colorId: item.color_id ? String(item.color_id) : null,
        colorName: item.color_name || null,
        colorHex: item.color_hex || null,
        sizeLabel: item.size_label || item.size || 'M',
        sizeId: item.sizeId || item.size_id || null,
        reservationToken: item.reservation_token || item.reservationToken || null,
        quantity,
        unitPriceCents,
        totalPriceCents,
        previewUrl: item.preview_url || null,
        backPreviewUrl,
        printFileUrl,
        backPrintFileUrl,
        printDimensions: standardFrontDimensions,
        backPrintDimensions: standardBackDimensions,
        printMethod: item.print_method || 'DTF'
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

    // Dynamic financial split (Provider-Led Checkout: 100% direct split between Provider & Designer):
    const platformFeeCents = 0;

    let designerEarningsCents = 0;
    let providerEarningsCents = 0;

    if (designerId && Number(designerId) !== Number(providerId)) {
      // Check if the Print Provider has configured their own custom designer royalty margin
      let effDesignerMarginPct = Number(settings.designer_margin_percent || 35);
      if (providerId) {
        try {
          const provRes = await client.query('SELECT store_settings FROM users WHERE id = $1', [providerId]);
          const provSettings = provRes.rows[0]?.store_settings || {};
          if (provSettings.designer_margin_percent !== undefined && !isNaN(Number(provSettings.designer_margin_percent))) {
            effDesignerMarginPct = Number(provSettings.designer_margin_percent);
          }
        } catch (provLookupErr) {
          console.warn('[OrderModel] Could not lookup provider custom margin:', provLookupErr.message);
        }
      }

      // Safeguard: Ensure designer margin respects platform minimum
      if (settings.min_designer_margin_percent && effDesignerMarginPct < Number(settings.min_designer_margin_percent)) {
        effDesignerMarginPct = Number(settings.min_designer_margin_percent);
      }

      // Designer Royalty
      designerEarningsCents = Math.round(subtotalCents * (effDesignerMarginPct / 100));
      // Provider keeps remaining balance
      providerEarningsCents = Math.max(0, subtotalCents - designerEarningsCents);
    } else {
      providerEarningsCents = subtotalCents;
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

    // Initialize tracking timeline audit trail
    const initialTimeline = [
      {
        status: 'placed',
        title: 'Order Placed',
        description: paymentStatus === 'paid' ? `Payment received via ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}` : 'Order placed, awaiting payment confirmation',
        timestamp: new Date().toISOString()
      }
    ];
    if (status === 'confirmed') {
      initialTimeline.push({
        status: 'confirmed',
        title: 'Order Approved for Production',
        description: 'Print provider accepted and queued the order for printing',
        timestamp: new Date().toISOString()
      });
    }
    const initialTrackingInfo = { timeline: initialTimeline };

    const orderRes = await client.query(
      `INSERT INTO orders (
        order_number, customer_id, customer_name, customer_email, customer_phone,
        designer_id, provider_id, status, payment_status, payment_method,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        currency, subtotal_cents, shipping_cost_cents, tax_cents, total_cents,
        subtotal_paise, shipping_cost_paise, tax_paise, total_paise,
        designer_earnings_cents, provider_earnings_cents, platform_fee_cents,
        designer_royalty_payable_paise, provider_earnings_paise,
        shipping_address, tracking_info, notes, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW(),NOW())
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
        subtotalCents,
        effectiveShippingCostCents,
        effectiveTaxCents,
        totalCents,
        designerEarningsCents,
        providerEarningsCents,
        platformFeeCents,
        designerEarningsCents,
        providerEarningsCents,
        JSON.stringify(shippingAddress),
        JSON.stringify(initialTrackingInfo),
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
          unit_price_cents, total_price_cents, preview_url,
          print_file_url, print_dimensions, print_method,
          back_print_file_url, back_preview_url, back_print_dimensions, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())`,
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
          item.previewUrl,
          item.printFileUrl,
          JSON.stringify(item.printDimensions),
          item.printMethod,
          item.backPrintFileUrl,
          item.backPreviewUrl,
          JSON.stringify(item.backPrintDimensions)
        ]
      );

      // Safely and atomically confirm reservation or decrement cloth inventory
      const resToken = item.reservationToken || item.reservation_token;
      const isPaid = paymentStatus === 'paid';

      if (resToken) {
        if (isPaid) {
          // Backend-verified payment: permanently deduct physical quantity and release reservation hold
          const rUpdate = await client.query(
            `UPDATE inventory_reservations 
             SET status = 'confirmed', order_id = $1, updated_at = NOW() 
             WHERE reservation_token = $2 AND status = 'reserved'
             RETURNING inventory_id, quantity`,
            [createdOrder.id, resToken]
          );
          if (rUpdate.rows.length > 0) {
            const { inventory_id, quantity: reservedQty } = rUpdate.rows[0];
            await client.query(
              `UPDATE cloth_inventory 
               SET quantity = GREATEST(0, quantity - $1),
                   reserved_quantity = GREATEST(0, reserved_quantity - $1)
               WHERE id = $2`,
              [Number(reservedQty), inventory_id]
            );
          }
        } else {
          // Payment pending / unverified: retain reservation in 'reserved' state, simply link order_id
          await client.query(
            `UPDATE inventory_reservations 
             SET order_id = $1, updated_at = NOW() 
             WHERE reservation_token = $2 AND status = 'reserved'`,
            [createdOrder.id, resToken]
          );
        }
      } else if (isPaid && (providerId || item.colorId || item.sizeLabel)) {
        // Direct purchase without prior reservation token (e.g. instant checkout or API order)
        try {
          const colorNum = Number(item.colorId) || 0;
          const sizeNum = Number(item.sizeId) || 0;
          const prodTitle = item.title || item.product || '';
          await client.query(
            `UPDATE cloth_inventory 
             SET quantity = GREATEST(0, quantity - $1)
             WHERE id = (
               SELECT ci.id FROM cloth_inventory ci
               LEFT JOIN sizes s ON s.id = ci.size_id
               WHERE (ci.owner_id = $2 OR ci.owner_id IS NULL)
                 AND (ci.color_id = $3 OR $3 = 0)
                 AND (ci.size_id = $4 OR LOWER(COALESCE(s.label, '')) = LOWER($5))
                 AND (ci.product ILIKE $6 OR ci.product ILIKE '%hoodie%' OR ci.product ILIKE '%tshirt%')
               ORDER BY ci.owner_id DESC NULLS LAST
               LIMIT 1
             )`,
            [item.quantity, providerId || null, colorNum, sizeNum, String(item.sizeLabel || ''), `%${prodTitle}%`]
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

const ORDER_ITEMS_SELECT_QUERY = `
  SELECT oi.*,
         COALESCE(
           oi.print_file_url,
           d.image
         ) AS print_file_url,
         COALESCE(
           oi.back_print_file_url,
           d.back_image
         ) AS back_print_file_url,
         COALESCE(
           oi.back_preview_url,
           dv.payload->'metadata'->>'preview_back',
           d.back_image
         ) AS back_preview_url,
         dv.payload AS design_version_payload,
         d.slogan AS design_slogan,
         d.color AS design_color,
         d.text_size AS design_text_size,
         d.text_rotation AS design_text_rotation,
         d.text_position AS design_text_position,
         d.image AS design_raw_image,
         d.image_scale AS design_image_scale,
         d.image_rotation AS design_image_rotation,
         d.image_position AS design_image_position,
         d.back_slogan AS design_back_slogan,
         d.back_text_size AS design_back_text_size,
         d.back_text_rotation AS design_back_text_rotation,
         d.back_text_position AS design_back_text_position,
         d.back_image AS design_raw_back_image,
         d.back_image_scale AS design_back_image_scale,
         d.back_image_rotation AS design_back_image_rotation,
         d.back_image_position AS design_back_image_position
  FROM order_items oi
  LEFT JOIN listings l ON l.id = oi.listing_id
  LEFT JOIN designs d ON (
    d.id = oi.design_id
    OR (l.design_key ~ '^design-[0-9]+$' AND d.id = substring(l.design_key from 'design-([0-9]+)')::int)
  )
  LEFT JOIN LATERAL (
    SELECT payload FROM design_versions WHERE design_id = d.id ORDER BY id DESC LIMIT 1
  ) dv ON true
  WHERE oi.order_id = $1
  ORDER BY oi.id ASC
`;

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

  const itemsRes = await pool.query(ORDER_ITEMS_SELECT_QUERY, [order.id]);
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
    const itemsRes = await pool.query(ORDER_ITEMS_SELECT_QUERY, [row.id]);
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
    const itemsRes = await pool.query(ORDER_ITEMS_SELECT_QUERY, [row.id]);
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
    const itemsRes = await pool.query(ORDER_ITEMS_SELECT_QUERY, [row.id]);
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
    const itemsRes = await pool.query(ORDER_ITEMS_SELECT_QUERY, [row.id]);
    row.items = itemsRes.rows.map(formatOrderItem);
    orders.push(formatOrder(row));
  }
  return orders;
}

export async function updateOrderStatus(orderId, status, trackingInfo = null) {
  if (!pool) return null;

  // Retrieve existing tracking_info and order metadata
  const existingRes = await pool.query(
    'SELECT tracking_info, created_at, updated_at, payment_status, payment_method FROM orders WHERE id = $1',
    [orderId]
  );
  if (!existingRes.rows.length) return null;
  const existingRow = existingRes.rows[0];

  let currentTracking = {};
  try {
    if (typeof existingRow.tracking_info === 'string') {
      currentTracking = JSON.parse(existingRow.tracking_info || '{}');
    } else if (existingRow.tracking_info && typeof existingRow.tracking_info === 'object') {
      currentTracking = { ...existingRow.tracking_info };
    }
  } catch (e) {
    currentTracking = {};
  }

  // Ensure timeline array exists
  let timeline = Array.isArray(currentTracking.timeline) ? [...currentTracking.timeline] : [];

  // Seed with initial placed event if missing
  if (timeline.length === 0) {
    timeline.push({
      status: 'placed',
      title: 'Order Placed',
      description: existingRow.payment_status === 'paid' ? `Payment received via ${existingRow.payment_method === 'cod' ? 'Cash on Delivery' : 'Razorpay'}` : 'Order placed, awaiting payment',
      timestamp: existingRow.created_at ? new Date(existingRow.created_at).toISOString() : new Date().toISOString()
    });
  }

  // Generate event details for the transition
  const statusLabels = {
    confirmed: {
      title: 'Order Approved for Production',
      description: 'Print provider accepted and queued the order for printing'
    },
    in_printing: {
      title: 'Garment Printing Started',
      description: 'Garment is on the production platen being printed and heat-cured'
    },
    processing: {
      title: 'Garment Printing Started',
      description: 'Garment is on the production platen being printed and heat-cured'
    },
    printing: {
      title: 'Garment Printing Started',
      description: 'Garment is on the production platen being printed and heat-cured'
    },
    shipped: {
      title: trackingInfo?.courier ? `Dispatched via ${trackingInfo.courier}` : 'Dispatched via Courier',
      description: trackingInfo?.tracking_number
        ? `Tracking number: ${trackingInfo.tracking_number}`
        : 'Garment packed and handed over to courier'
    },
    delivered: {
      title: 'Order Delivered',
      description: 'Garment package has been safely delivered to customer'
    },
    completed: {
      title: 'Order Delivered',
      description: 'Garment package has been safely delivered to customer'
    },
    cancelled: {
      title: 'Order Cancelled',
      description: 'Order was declined or cancelled'
    }
  };

  const currentEventDef = statusLabels[status];
  if (currentEventDef) {
    const lastEvent = timeline[timeline.length - 1];
    if (!lastEvent || lastEvent.status !== status) {
      timeline.push({
        status,
        title: currentEventDef.title,
        description: currentEventDef.description,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Merge any new courier fields provided in trackingInfo
  const updatedTracking = {
    ...currentTracking,
    ...(trackingInfo && typeof trackingInfo === 'object' ? trackingInfo : {}),
    timeline
  };

  const res = await pool.query(
    `UPDATE orders SET status = $2, tracking_info = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [orderId, status, JSON.stringify(updatedTracking)]
  );
  if (!res.rows.length) return null;
  return await getOrderById(orderId);
}

export async function confirmOrderPayment(orderId, {
  paymentMethod = 'razorpay',
  razorpayPaymentId = null,
  razorpaySignature = null,
  rawPayload = {}
}) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const order = orderRes.rows[0];

    // Concurrency Protection: If already paid by another simultaneous transaction, fail-safe reject or idempotent match
    if (order.payment_status === 'paid') {
      if (razorpayPaymentId && order.razorpay_payment_id === razorpayPaymentId) {
        await client.query('COMMIT');
        return await getOrderById(orderId);
      }
      await client.query('ROLLBACK');
      const err = new Error(`Order #${orderId} is already confirmed as paid (payment method: ${order.payment_method || 'unknown'})`);
      err.statusCode = 409;
      throw err;
    }

    // Verify that the transaction ID is unique to this order
    const txId = razorpayPaymentId || `TX-${order.order_number}`;
    const existingPay = await client.query('SELECT order_id FROM payments WHERE transaction_id = $1', [txId]);
    if (existingPay.rows.length > 0 && Number(existingPay.rows[0].order_id) !== Number(orderId)) {
      await client.query('ROLLBACK');
      const err = new Error(`Transaction ID ${txId} has already been credited to Order #${existingPay.rows[0].order_id}`);
      err.statusCode = 400;
      throw err;
    }

    // Update order status and payment status
    await client.query(
      `UPDATE orders 
       SET payment_status = 'paid',
           payment_method = COALESCE($2, payment_method),
           razorpay_payment_id = COALESCE($3, razorpay_payment_id),
           razorpay_signature = COALESCE($4, razorpay_signature),
           status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, paymentMethod, razorpayPaymentId, razorpaySignature]
    );

    // Record in payments table if transaction ID is present
    await client.query(
      `INSERT INTO payments (
        order_id, transaction_id, gateway, payment_method, amount_cents, currency, status, raw_payload, created_at
      ) VALUES ($1,$2,'razorpay',$3,$4,$5,'captured',$6,NOW())
      ON CONFLICT (transaction_id) DO NOTHING`,
      [order.id, txId, paymentMethod, order.total_cents, order.currency, JSON.stringify(rawPayload)]
    );

    // Atomically confirm active inventory reservations linked to this order
    const resUpdate = await client.query(
      `UPDATE inventory_reservations 
       SET status = 'confirmed', updated_at = NOW() 
       WHERE order_id = $1 AND status = 'reserved'
       RETURNING inventory_id, quantity`,
      [orderId]
    );

    for (const rRow of resUpdate.rows) {
      await client.query(
        `UPDATE cloth_inventory 
         SET quantity = GREATEST(0, quantity - $1),
             reserved_quantity = GREATEST(0, reserved_quantity - $1)
         WHERE id = $2`,
        [Number(rRow.quantity), rRow.inventory_id]
      );
    }

    await client.query('COMMIT');
    return await getOrderById(orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmManualPayment(orderId, {
  paymentMethod,
  transactionReference,
  confirmationReason,
  adminId,
  adminName,
  adminRole
}) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      const err = new Error(`Order #${orderId} not found`);
      err.statusCode = 404;
      throw err;
    }
    const order = orderRes.rows[0];

    if (order.payment_status === 'paid') {
      await client.query('ROLLBACK');
      const err = new Error(`Order #${orderId} is already marked as paid (payment method: ${order.payment_method || 'unknown'})`);
      err.statusCode = 409;
      throw err;
    }

    if (order.status === 'cancelled') {
      await client.query('ROLLBACK');
      const err = new Error(`Cannot confirm payment for cancelled order #${orderId}`);
      err.statusCode = 400;
      throw err;
    }

    // Append audit event to tracking_info timeline
    let currentTracking = {};
    try {
      if (typeof order.tracking_info === 'string') {
        currentTracking = JSON.parse(order.tracking_info || '{}');
      } else if (order.tracking_info && typeof order.tracking_info === 'object') {
        currentTracking = { ...order.tracking_info };
      }
    } catch (e) {
      currentTracking = {};
    }
    const timeline = Array.isArray(currentTracking.timeline) ? [...currentTracking.timeline] : [];
    timeline.push({
      status: 'manual_payment_confirmed',
      title: 'Manual Payment Confirmed',
      description: `Manual payment (${paymentMethod}) confirmed by ${adminName || 'Admin Staff'} (Role: ${adminRole || 'admin'}): ${confirmationReason} [Ref: ${transactionReference}]`,
      timestamp: new Date().toISOString()
    });
    currentTracking.timeline = timeline;

    // Update order
    await client.query(
      `UPDATE orders 
       SET payment_status = 'paid',
           payment_method = $2,
           status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
           tracking_info = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, paymentMethod, JSON.stringify(currentTracking)]
    );

    // Record in payments table with full audit payload
    const safeRef = String(transactionReference || 'REF').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const txId = `MANUAL-${safeRef}-${order.id}`;
    const auditPayload = {
      confirmed_by_admin_id: adminId,
      confirmed_by_admin_name: adminName,
      confirmed_by_role: adminRole,
      confirmation_reason: confirmationReason,
      transaction_reference: transactionReference,
      confirmed_at: new Date().toISOString()
    };

    await client.query(
      `INSERT INTO payments (
        order_id, transaction_id, gateway, payment_method, amount_cents, currency, status, raw_payload, created_at
      ) VALUES ($1,$2,'manual',$3,$4,$5,'captured',$6,NOW())
      ON CONFLICT (transaction_id) DO NOTHING`,
      [order.id, txId, paymentMethod, order.total_cents, order.currency, JSON.stringify(auditPayload)]
    );

    // Atomically confirm active inventory reservations linked to this order
    const resUpdate = await client.query(
      `UPDATE inventory_reservations 
       SET status = 'confirmed', updated_at = NOW() 
       WHERE order_id = $1 AND status = 'reserved'
       RETURNING inventory_id, quantity`,
      [orderId]
    );

    for (const rRow of resUpdate.rows) {
      await client.query(
        `UPDATE cloth_inventory 
         SET quantity = GREATEST(0, quantity - $1),
             reserved_quantity = GREATEST(0, reserved_quantity - $1)
         WHERE id = $2`,
        [Number(rRow.quantity), rRow.inventory_id]
      );
    }

    await client.query('COMMIT');
    return await getOrderById(orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePaymentStatus(orderId, {
  paymentStatus,
  razorpayPaymentId = null,
  razorpaySignature = null,
  rawPayload = {}
}) {
  if (paymentStatus === 'paid') {
    return await confirmOrderPayment(orderId, {
      paymentMethod: 'online',
      razorpayPaymentId,
      razorpaySignature,
      rawPayload
    });
  }

  if (!pool) return null;
  const res = await pool.query(
    `UPDATE orders 
     SET payment_status = $2::varchar,
         razorpay_payment_id = COALESCE($3, razorpay_payment_id),
         razorpay_signature = COALESCE($4, razorpay_signature),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, paymentStatus, razorpayPaymentId, razorpaySignature]
  );
  if (!res.rows.length) return null;
  return await getOrderById(orderId);
}

function formatOrderItem(item) {
  const standardFrontDimensions = {
    width_in: 11.0,
    height_in: 13.5,
    width_cm: 27.9,
    height_cm: 34.3,
    top_offset_in: 2.5,
    top_offset_cm: 6.35,
    location: "Center Front Chest",
    platen_type: "Adult Standard (14x16 in)",
    resolution_dpi: 300,
    underbase_required: true,
    curing_temp_c: 160,
    curing_time_sec: 15
  };

  const standardBackDimensions = {
    width_in: 11.0,
    height_in: 13.5,
    width_cm: 27.9,
    height_cm: 34.3,
    top_offset_in: 3.0,
    top_offset_cm: 7.62,
    location: "Center Upper Back",
    platen_type: "Adult Standard (14x16 in)",
    resolution_dpi: 300,
    underbase_required: true,
    curing_temp_c: 160,
    curing_time_sec: 15
  };

  let parsedFrontDims = standardFrontDimensions;
  if (item.print_dimensions) {
    parsedFrontDims = typeof item.print_dimensions === 'string'
      ? JSON.parse(item.print_dimensions)
      : item.print_dimensions;
  }

  let parsedBackDims = null;
  if (item.back_print_dimensions) {
    parsedBackDims = typeof item.back_print_dimensions === 'string'
      ? JSON.parse(item.back_print_dimensions)
      : item.back_print_dimensions;
  } else if (item.back_print_file_url || item.back_preview_url) {
    parsedBackDims = standardBackDimensions;
  }

  let designVersion = null;
  if (item.design_version_payload) {
    try {
      designVersion = typeof item.design_version_payload === 'string'
        ? JSON.parse(item.design_version_payload)
        : item.design_version_payload;
    } catch (e) { }
  }

  const frontLayers = designVersion?.sides?.find(s => s.name === 'front')?.layers || [];
  const backLayers = designVersion?.sides?.find(s => s.name === 'back')?.layers || [];

  let hasBackArtwork = false;
  if (designVersion) {
    hasBackArtwork = (backLayers.length > 0) || Boolean(item.design_back_slogan);
  } else {
    hasBackArtwork = Boolean(
      item.design_back_slogan ||
      (item.design_raw_back_image && !item.design_raw_back_image.includes('/templates/'))
    );
  }

  let hasFrontArtwork = false;
  if (designVersion) {
    hasFrontArtwork = (frontLayers.length > 0) || Boolean(item.design_slogan);
  } else {
    hasFrontArtwork = Boolean(
      item.design_slogan ||
      (item.design_raw_image && !item.design_raw_image.includes('/templates/'))
    );
  }

  return {
    id: item.id,
    order_id: item.order_id,
    listing_id: item.listing_id,
    design_id: item.design_id,
    product_id: item.product_id,
    title: item.product_title,
    product_title: item.product_title,
    color_id: item.color_id,
    color_name: item.color_name,
    color_hex: item.color_hex,
    size: item.size_label,
    size_label: item.size_label,
    quantity: item.quantity,
    unit_price: (item.unit_price_cents || 0) / 100,
    total_price: (item.total_price_cents || 0) / 100,
    unit_price_cents: item.unit_price_cents,
    total_price_cents: item.total_price_cents,
    preview_url: item.preview_url,
    mockup_url: item.preview_url,
    print_file_url: item.print_file_url || null,
    print_dimensions: parsedFrontDims,
    print_method: item.print_method || 'DTF',
    back_preview_url: item.back_preview_url || null,
    back_mockup_url: item.back_preview_url || null,
    back_print_file_url: item.back_print_file_url || null,
    back_print_dimensions: parsedBackDims,
    front_layers: frontLayers,
    back_layers: backLayers,
    has_front_artwork: hasFrontArtwork,
    has_back_artwork: hasBackArtwork,
    design_details: {
      slogan: item.design_slogan,
      color: item.design_color,
      textSize: item.design_text_size,
      textRotation: item.design_text_rotation,
      textPosition: item.design_text_position,
      image: item.design_raw_image,
      imageScale: item.design_image_scale,
      imageRotation: item.design_image_rotation,
      imagePosition: item.design_image_position,
      backSlogan: item.design_back_slogan,
      backTextSize: item.design_back_text_size,
      backTextRotation: item.design_back_text_rotation,
      backTextPosition: item.design_back_text_position,
      backImage: item.design_raw_back_image,
      backImageScale: item.design_back_image_scale,
      backImageRotation: item.design_back_image_rotation,
      backImagePosition: item.design_back_image_position
    }
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
  updatePaymentStatus,
  confirmOrderPayment,
  confirmManualPayment
};

