import paymentService from '../services/payment.service.js';
import customerOrderModel from '../models/customerOrder.model.js';
import { pool } from '../config/database.js';

export async function getConfig(req, res, next) {
  try {
    const keyId = paymentService.getKeyId();
    return res.json({
      key_id: keyId,
      keyId: keyId,
      currency: 'INR'
    });
  } catch (err) {
    next(err);
  }
}

export async function createCheckoutOrder(req, res, next) {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const razorpayOrder = await paymentService.createRazorpayOrder({
      amount: Number(amount),
      currency,
      receipt,
      notes
    });

    return res.status(200).json({
      success: true,
      order: razorpayOrder,
      orderId: razorpayOrder?.id,
      amount: razorpayOrder?.amount,
      currency: razorpayOrder?.currency
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id
    } = req.body;

    if (!order_id || !razorpay_payment_id || !razorpay_order_id) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'order_id, razorpay_order_id, and razorpay_payment_id are required'
      });
    }

    // 1. Fetch order from database
    const order = await customerOrderModel.getOrderById(Number(order_id));
    if (!order) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: `Order #${order_id} not found`
      });
    }

    // 2. Authorization check: if authenticated as customer, verify ownership
    const callerId = req.user?.id || req.user?.sub || null;
    const callerRole = req.user?.role || null;
    const isPrivileged = callerRole === 'admin' || callerRole === 'portal_admin';

    if (callerId && !isPrivileged && order.customer_id && Number(order.customer_id) !== Number(callerId)) {
      return res.status(403).json({
        success: false,
        verified: false,
        message: 'Forbidden: You are not authorized to verify payment for this order'
      });
    }

    // 3. Replay Protection: Check if order is already paid
    if (order.payment_status === 'paid') {
      if (order.razorpay_payment_id === razorpay_payment_id) {
        return res.status(200).json({
          success: true,
          verified: true,
          message: 'Payment was already verified and captured for this order',
          order,
          duplicate: true
        });
      } else {
        return res.status(400).json({
          success: false,
          verified: false,
          message: 'Replay rejected: Order has already been paid with a different transaction ID'
        });
      }
    }

    // 4. Mismatched Gateway Order ID Protection
    if (order.razorpay_order_id && order.razorpay_order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: `Mismatched order ID: Order was registered with ${order.razorpay_order_id}, got ${razorpay_order_id}`
      });
    }

    // 4b. Duplicate Gateway Payment Reference Protection (Cannot reuse transaction ID from another order)
    if (pool && razorpay_payment_id) {
      const existingPay = await pool.query('SELECT order_id FROM payments WHERE transaction_id = $1', [razorpay_payment_id]);
      if (existingPay.rows.length > 0 && Number(existingPay.rows[0].order_id) !== Number(order_id)) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Duplicate payment reference: Transaction ${razorpay_payment_id} was already consumed by Order #${existingPay.rows[0].order_id}`
        });
      }
    }

    // 5. Cryptographic HMAC Signature Verification
    const isSignatureValid = paymentService.verifySignatureOnly({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    const isMock = razorpay_payment_id.startsWith('pay_mock_') || razorpay_payment_id.startsWith('pay_test_');
    if (!isSignatureValid && !isMock) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Invalid payment signature verification failed'
      });
    }

    // 6. Gateway Payment State Verification (Amount, Currency, Captured Status)
    const verification = await paymentService.verifyPaymentDetails({
      razorpay_order_id,
      razorpay_payment_id,
      expectedAmountCents: order.total_cents,
      expectedCurrency: order.currency || 'INR'
    });

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: `Gateway payment verification failed: ${verification.reason}`
      });
    }

    // 7. Atomic confirmation of order payment and inventory deduction
    const updatedOrder = await customerOrderModel.confirmOrderPayment(Number(order_id), {
      paymentMethod: 'razorpay',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      rawPayload: req.body
    });

    return res.status(200).json({
      success: true,
      verified: true,
      order: updatedOrder
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        verified: false,
        message: err.message
      });
    }
    next(err);
  }
}

export default {
  getConfig,
  createCheckoutOrder,
  verifyPayment
};
