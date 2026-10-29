import b2bOrderModel from '../models/b2bOrder.model.js';
import b2bFinancialSettingsModel from '../models/b2bFinancialSettings.model.js';
import paymentService from '../services/payment.service.js';

export async function getB2BQuote(req, res, next) {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required to generate quote' });
    }
    const quote = await b2bFinancialSettingsModel.calculateB2BQuote(items);
    return res.json({ success: true, quote });
  } catch (err) {
    next(err);
  }
}

export async function checkoutB2BOrder(req, res, next) {
  try {
    const designerId = req.user?.id || req.user?.sub;
    const {
      providerId,
      items,
      shippingAddress,
      designerNotes = '',
      paymentMethod = 'razorpay'
    } = req.body;

    if (!providerId) {
      return res.status(400).json({ message: 'Target print provider ID is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    // 1. Create order in database
    const order = await b2bOrderModel.createB2BOrder({
      designerId,
      providerId: Number(providerId),
      items,
      shippingAddress,
      designerNotes,
      paymentMethod
    });

    // 2. If Razorpay payment method, generate Razorpay order
    let razorpayPayload = null;
    if (paymentMethod === 'razorpay') {
      const rzpOrder = await paymentService.createRazorpayOrder({
        amount: order.total_cents / 100,
        currency: 'INR',
        receipt: `b2b_${order.id}`,
        notes: {
          b2b_order_id: String(order.id),
          order_number: order.order_number,
          designer_id: String(designerId),
          provider_id: String(providerId)
        }
      });

      await b2bOrderModel.attachRazorpayOrder(order.id, rzpOrder.id);
      razorpayPayload = rzpOrder;
    }

    return res.status(201).json({
      success: true,
      order,
      razorpay: razorpayPayload
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyB2BPayment(req, res, next) {
  try {
    const {
      orderId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    if (!orderId || !razorpay_payment_id) {
      return res.status(400).json({ message: 'Order ID and Razorpay Payment ID are required' });
    }

    const order = await b2bOrderModel.getB2BOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'B2B order not found' });
    }

    // Verify signature
    const isValid = await paymentService.verifyPaymentSignature({
      razorpay_order_id: razorpay_order_id || order.razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid payment signature or verification failed' });
    }

    const updated = await b2bOrderModel.markOrderPaid(orderId, {
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id || order.razorpay_order_id,
      razorpaySignature: razorpay_signature
    });

    return res.json({
      success: true,
      message: 'B2B Wholesale order confirmed and payment captured',
      order: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function listDesignerB2BOrders(req, res, next) {
  try {
    const designerId = req.user?.id || req.user?.sub;
    const orders = await b2bOrderModel.listOrdersForDesigner(designerId);
    return res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
}

export async function listProviderB2BOrders(req, res, next) {
  try {
    const providerId = req.user?.id || req.user?.sub;
    const orders = await b2bOrderModel.listOrdersForProvider(providerId);
    return res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
}

export async function listAdminB2BOrders(_req, res, next) {
  try {
    const orders = await b2bOrderModel.listAllB2BOrdersForAdmin();
    return res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
}

export async function updateB2BOrderStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const providerId = req.user?.role === 'portal_admin' ? null : (req.user?.id || req.user?.sub);
    const { status, tracking_info } = req.body;

    const allowed = ['confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const updated = await b2bOrderModel.updateOrderStatus(orderId, status, tracking_info, providerId);
    if (!updated) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    return res.json({ success: true, order: updated });
  } catch (err) {
    next(err);
  }
}

export default {
  getB2BQuote,
  checkoutB2BOrder,
  verifyB2BPayment,
  listDesignerB2BOrders,
  listProviderB2BOrders,
  listAdminB2BOrders,
  updateB2BOrderStatus
};

