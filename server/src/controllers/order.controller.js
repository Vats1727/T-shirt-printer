import orderService from '../services/order.service.js';
import * as productsStore from '../services/productsStore.js';
import customerOrderModel from '../models/customerOrder.model.js';
import b2bOrderModel from '../models/b2bOrder.model.js';
import { pool } from '../config/database.js';

export async function createCustomerOrder(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id || null;
    const {
      items,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      paymentMethod = 'razorpay',
      paymentStatus = 'pending',
      razorpayOrderId = null,
      razorpayPaymentId = null,
      razorpaySignature = null,
      shippingCostCents = 0,
      taxCents = 0,
      notes = ''
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }
    if (!customerName || !customerEmail) {
      return res.status(400).json({ message: 'Customer name and email are required' });
    }

    // Resolve designerId and providerId from items/listings
    let resolvedDesignerId = req.body.designerId || null;
    let resolvedProviderId = req.body.providerId || null;

    if (pool && (!resolvedDesignerId || !resolvedProviderId)) {
      for (const it of items) {
        if (it.listing_id && (!resolvedDesignerId || !resolvedProviderId)) {
          try {
            const lRes = await pool.query(
              `SELECT l.supplier_id, l.design_key, u.role as supplier_role, u.associated_provider_id,
                      d.owner_id as design_owner_id, d.product_id,
                      pf.owner_id as pf_owner_id
               FROM listings l
               LEFT JOIN users u ON u.id = l.supplier_id
               LEFT JOIN designs d ON d.id = CASE WHEN l.design_key ~ '^[0-9]+$' THEN l.design_key::int WHEN l.design_key ~ '^design-\\d+$' THEN substring(l.design_key from 8)::int ELSE NULL END
               LEFT JOIN products_full pf ON pf.id = d.product_id
               WHERE l.id = $1`,
              [Number(it.listing_id)]
            );
            if (lRes.rows.length) {
              const row = lRes.rows[0];
              if (row.supplier_role === 'designer' || row.supplier_role === 'supplier') {
                if (!resolvedDesignerId) resolvedDesignerId = row.supplier_id;
                if (!resolvedProviderId) resolvedProviderId = row.pf_owner_id || row.associated_provider_id;
              } else if (row.supplier_role === 'admin' || row.supplier_role === 'print_provider') {
                if (!resolvedProviderId) resolvedProviderId = row.supplier_id;
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    // If designer exists but provider not yet resolved, check designer's associated_provider_id
    if (resolvedDesignerId && !resolvedProviderId && pool) {
      try {
        const dRes = await pool.query('SELECT associated_provider_id FROM users WHERE id = $1', [resolvedDesignerId]);
        if (dRes.rows[0]?.associated_provider_id) {
          resolvedProviderId = dRes.rows[0].associated_provider_id;
        }
      } catch (e) {}
    }

    // Final fallback to active provider if still unassigned
    if (!resolvedProviderId && pool) {
      try {
        const provRes = await pool.query(
          "SELECT id FROM users WHERE role = 'print_provider' AND (status = 'active' OR status IS NULL) ORDER BY id DESC LIMIT 1"
        );
        if (provRes.rows.length) resolvedProviderId = provRes.rows[0].id;
      } catch (e) {}
    }

    const order = await customerOrderModel.createOrder({
      customerId: userId,
      customerName,
      customerEmail,
      customerPhone,
      designerId: resolvedDesignerId,
      providerId: resolvedProviderId,
      items,
      shippingAddress: shippingAddress || {},
      paymentMethod,
      paymentStatus,
      status: paymentStatus === 'paid' || paymentMethod === 'cod' ? 'confirmed' : 'pending',
      shippingCostCents: Math.round(Number(shippingCostCents || 0)),
      taxCents: Math.round(Number(taxCents || 0)),
      notes,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    return res.status(201).json({
      success: true,
      order
    });
  } catch (err) {
    next(err);
  }
}

export async function listCustomerOrders(req, res, next) {
  try {
    const customerId = req.user?.sub || req.user?.id;
    if (!customerId) return res.status(401).json({ message: 'Unauthorized' });

    const orders = await customerOrderModel.listOrdersByCustomer(customerId);
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerOrder(req, res, next) {
  try {
    const orderId = parseInt(req.params.id, 10);
    const userId = req.user?.sub || req.user?.id;

    const order = await customerOrderModel.getOrderById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Allow owner, designer, provider, or admin
    const isOwner = Number(order.customer_id) === Number(userId);
    const isDesigner = Number(order.designer_id) === Number(userId);
    const isProvider = Number(order.provider_id) === Number(userId);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'portal_admin';

    if (!isOwner && !isDesigner && !isProvider && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      success: true,
      order,
      ...order
    });
  } catch (err) {
    next(err);
  }
}

export async function trackOrderByNumber(req, res, next) {
  try {
    const { orderNumber } = req.params;
    const order = await customerOrderModel.getOrderByNumber(orderNumber);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Return tracking information
    return res.json({
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      tracking_info: order.tracking_info,
      items_count: (order.items || []).length,
      items: (order.items || []).map(i => ({
        title: i.title,
        color_name: i.color_name,
        color_hex: i.color_hex,
        size: i.size,
        quantity: i.quantity,
        preview_url: i.preview_url
      }))
    });
  } catch (err) {
    next(err);
  }
}

export async function placeOrder(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const { items, shipping } = req.body;
    const result = await orderService.placeSupplierOrder(userId, items, shipping);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listSupplierOrders(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    
    // 1. Fetch customer orders placed for this designer's listings
    const customerOrders = await customerOrderModel.listOrdersByDesigner(userId);

    // 2. Fetch legacy sample purchase orders placed by this designer
    const legacyOrders = await orderService.listSupplierOrders(userId);

    // 3. Fetch dedicated B2B orders (Sample & Bulk) placed by this designer
    let b2bOrders = [];
    try {
      b2bOrders = await b2bOrderModel.listOrdersForDesigner(userId);
    } catch (b2bErr) {
      console.warn('Could not load B2B orders for designer:', b2bErr.message);
    }

    // Combine all sets
    const combined = [
      ...customerOrders.map(o => ({
        ...o,
        is_customer_order: true,
        order_type: 'customer_sale'
      })),
      ...(legacyOrders || []).map(o => ({
        ...o,
        is_customer_order: false,
        order_type: 'sample_purchase'
      })),
      ...(b2bOrders || []).map(o => ({
        ...o,
        is_b2b_order: true,
        is_customer_order: false,
        order_type: o.order_type || 'bulk', // 'sample' or 'bulk'
        provider_name: o.provider_name,
        provider_email: o.provider_email,
        total: (o.total_cents || 0) / 100,
        items: (o.items || []).map(i => ({
          ...i,
          product_title: i.product_name,
          product: i.product_name,
          size: i.garment_size,
          color: i.color_name,
          color_hex: i.color_hex,
          preview_url: i.custom_mockup_url || '/templates/tshirt.png',
          print_file_url: i.print_file_url || i.custom_mockup_url || '/templates/tshirt.png',
          print_dimensions: i.print_dimensions || null,
          print_method: i.print_method || 'DTF',
          unit_price: (i.unit_price_cents || 0) / 100,
          price: (i.line_total_cents || 0) / 100
        }))
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json(combined);
  } catch (err) {
    next(err);
  }
}

export async function getSupplierOrder(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Try customer order first
    const custOrder = await customerOrderModel.getOrderById(id);
    if (custOrder) {
      return res.json(custOrder);
    }

    // Try B2B designer order
    try {
      const b2bOrder = await b2bOrderModel.getB2BOrderById(id);
      if (b2bOrder) {
        return res.json({
          ...b2bOrder,
          is_b2b_order: true,
          items: (b2bOrder.items || []).map(i => ({
            ...i,
            product_title: i.product_name,
            product: i.product_name,
            size: i.garment_size,
            color: i.color_name,
            color_hex: i.color_hex,
            preview_url: i.custom_mockup_url || '/templates/tshirt.png',
            print_file_url: i.print_file_url || i.custom_mockup_url || '/templates/tshirt.png',
            print_dimensions: i.print_dimensions || null,
            print_method: i.print_method || 'DTF',
            unit_price: (i.unit_price_cents || 0) / 100,
            price: (i.line_total_cents || 0) / 100
          }))
        });
      }
    } catch (e) {}

    // Fallback to legacy supplier order
    const order = await orderService.getSupplierOrder(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function listAdminOrders(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const userRole = req.user?.role;

    let customerOrders = [];
    if (userRole === 'admin' || userRole === 'portal_admin') {
      customerOrders = await customerOrderModel.listAllOrdersForAdmin();
    } else {
      customerOrders = await customerOrderModel.listOrdersByProvider(userId);
    }

    const legacyOrders = await orderService.listAdminOrders(userId);

    // Fetch B2B wholesale / sample orders
    let b2bOrders = [];
    try {
      if (userRole === 'admin' || userRole === 'portal_admin') {
        b2bOrders = await b2bOrderModel.listAllB2BOrdersForAdmin();
      } else {
        b2bOrders = await b2bOrderModel.listOrdersForProvider(userId);
      }
    } catch (b2bErr) {
      console.warn('Could not load B2B orders for provider:', b2bErr.message);
    }

    const combined = [
      ...customerOrders.map(o => ({
        ...o,
        is_customer_order: true,
        order_type: 'production_fulfillment'
      })),
      ...(legacyOrders || []).map(o => ({
        ...o,
        is_customer_order: false,
        order_type: 'designer_batch'
      })),
      ...(b2bOrders || []).map(o => ({
        ...o,
        is_b2b_order: true,
        is_customer_order: false,
        order_type: o.order_type || 'bulk', // 'sample' or 'bulk'
        customer_name: o.designer_name || 'Wholesale Designer',
        customer_email: o.designer_email || '',
        customer_phone: o.shipping_address?.phone || '',
        shipping_address_display: o.shipping_address ? `${o.shipping_address.name}, ${o.shipping_address.address}, ${o.shipping_address.city} ${o.shipping_address.pincode}` : '',
        designer: {
          id: o.designer_id,
          name: o.designer_name,
          email: o.designer_email
        },
        total: (o.total_cents || 0) / 100,
        provider_earnings_cents: o.provider_earnings_cents,
        items: (o.items || []).map(i => ({
          ...i,
          product_title: i.product_name,
          product: i.product_name,
          size: i.garment_size,
          color: i.color_name,
          color_hex: i.color_hex,
          preview_url: i.custom_mockup_url || '/templates/tshirt.png',
          print_file_url: i.print_file_url || i.custom_mockup_url || '/templates/tshirt.png',
          print_dimensions: i.print_dimensions || null,
          print_method: i.print_method || 'DTF',
          unit_price: (i.unit_price_cents || 0) / 100,
          price: (i.line_total_cents || 0) / 100
        }))
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ orders: combined });
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrder(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.sub || req.user?.id;

    const custOrder = await customerOrderModel.getOrderById(id);
    if (custOrder) {
      return res.json(custOrder);
    }

    try {
      const b2bOrder = await b2bOrderModel.getB2BOrderById(id);
      if (b2bOrder) {
        return res.json({
          ...b2bOrder,
          is_b2b_order: true,
          items: (b2bOrder.items || []).map(i => ({
            ...i,
            product_title: i.product_name,
            product: i.product_name,
            size: i.garment_size,
            color: i.color_name,
            color_hex: i.color_hex,
            preview_url: i.custom_mockup_url || '/templates/tshirt.png',
            print_file_url: i.print_file_url || i.custom_mockup_url || '/templates/tshirt.png',
            print_dimensions: i.print_dimensions || null,
            print_method: i.print_method || 'DTF',
            unit_price: (i.unit_price_cents || 0) / 100,
            price: (i.line_total_cents || 0) / 100
          }))
        });
      }
    } catch (e) {}

    const order = await orderService.getAdminOrder(id, userId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function getDesignerProductPurchaseStatus(req, res, next) {
  try {
    const designerId = req.user?.sub || req.user?.id;
    const productId = parseInt(req.params.id, 10);
    let providerId = req.query.providerId ? parseInt(req.query.providerId, 10) : req.user?.associated_provider_id;
    if (!providerId && productId) {
      const prod = await productsStore.getProduct(productId);
      if (prod?.owner_id) providerId = prod.owner_id;
    }

    const statusInfo = await orderService.getDesignerProductPurchaseStatus(designerId, productId, providerId);
    return res.json(statusInfo);
  } catch (err) {
    next(err);
  }
}

export async function createDesignerPurchaseRequest(req, res, next) {
  try {
    const designerId = req.user?.sub || req.user?.id;
    const { productId, providerId, productSku, size, color, quantity, unitPrice, shipping } = req.body;

    let resolvedProviderId = providerId || req.user?.associated_provider_id;
    if (!resolvedProviderId && productId) {
      const prod = await productsStore.getProduct(Number(productId));
      if (prod?.owner_id) resolvedProviderId = prod.owner_id;
    }
    if (!resolvedProviderId) {
      return res.status(400).json({ message: 'Print provider is required for purchase request' });
    }

    const result = await orderService.createDesignerPurchaseRequest({
      designerId,
      providerId: Number(resolvedProviderId),
      productId: Number(productId),
      productSku,
      size,
      color,
      quantity: Number(quantity || 1),
      unitPrice: Number(unitPrice || 0),
      shipping: shipping || {
        customer_name: req.user?.name || 'Designer',
        customer_email: req.user?.email || null
      }
    });

    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const orderId = parseInt(req.params.id, 10);
    const providerId = req.user?.sub || req.user?.id;
    const { status, tracking_info } = req.body;

    const allowedStatuses = ['confirmed', 'cancelled', 'paid', 'processing', 'in_printing', 'printing', 'shipped', 'delivered', 'completed', 'pending'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    // Disambiguate between customer storefront order, B2B wholesale order, and legacy designer batch order
    let updated = null;
    if (req.body.is_b2b_order || req.body.order_type === 'sample' || req.body.order_type === 'bulk') {
      updated = await b2bOrderModel.updateOrderStatus(orderId, status, tracking_info, req.user?.role === 'portal_admin' ? null : providerId);
    } else if (req.body.is_customer_order === false || req.body.order_type === 'designer_batch') {
      updated = await orderService.updateOrderStatus(orderId, status, providerId);
    } else {
      updated = await customerOrderModel.updateOrderStatus(orderId, status, tracking_info);
      if (!updated) {
        updated = await b2bOrderModel.updateOrderStatus(orderId, status, tracking_info, req.user?.role === 'portal_admin' ? null : providerId);
      }
      if (!updated) {
        updated = await orderService.updateOrderStatus(orderId, status, providerId);
      }
    }

    if (!updated) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    return res.json({ success: true, order: updated });
  } catch (err) {
    next(err);
  }
}

export default {
  createCustomerOrder,
  listCustomerOrders,
  getCustomerOrder,
  trackOrderByNumber,
  placeOrder,
  listSupplierOrders,
  getSupplierOrder,
  listAdminOrders,
  getAdminOrder,
  getDesignerProductPurchaseStatus,
  createDesignerPurchaseRequest,
  updateOrderStatus
};
