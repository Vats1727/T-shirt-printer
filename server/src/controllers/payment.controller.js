import paymentService from '../services/payment.service.js';
import customerOrderModel from '../models/customerOrder.model.js';

export async function getConfig(req, res) {
  const keyId = paymentService.getKeyId();
  return res.json({
    key_id: keyId,
    keyId: keyId,
    currency: 'INR'
  });
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

    if (!razorpay_payment_id) {
      return res.status(400).json({ message: 'Missing payment transaction ID', verified: false });
    }

    const isValid = await paymentService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Invalid payment signature verification failed'
      });
    }

    let updatedOrder = null;
    if (order_id) {
      updatedOrder = await customerOrderModel.updatePaymentStatus(Number(order_id), {
        paymentStatus: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        rawPayload: req.body
      });
    }

    return res.json({
      success: true,
      verified: true,
      order: updatedOrder
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getConfig,
  createCheckoutOrder,
  verifyPayment
};
