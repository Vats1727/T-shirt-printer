import crypto from 'crypto';
import paymentService from '../services/payment.service.js';
import customerOrderModel from '../models/customerOrder.model.js';
import { ProviderGatewayService } from '../services/providerGateway.service.js';
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

/**
 * Phase 1 Legacy Order Creation (Maintained for Platform in-house / direct calls)
 */
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

/**
 * Phase 2 Provider-Specific Payment Attempt Creation
 * Enforces:
 * - Single-provider order isolation
 * - Merchant of Record gateway resolution
 * - DB row lock released BEFORE external Razorpay API call
 * - Attempt idempotency and retry handling
 */
export async function createPaymentAttempt(req, res, next) {
  try {
    const { orderId, idempotencyKey } = req.body;
    const finalIdempotencyKey = idempotencyKey || 
      req.headers['idempotency-key'] || 
      req.headers['x-idempotency-key'] || 
      `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const numOrderId = Number(orderId);
    if (!Number.isInteger(numOrderId) || numOrderId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    const client = await pool.connect();
    let order;
    let existingAttempt;
    let providerAccount;
    let cred;
    let nextAttemptNumber = 1;
    let receipt;
    let amountPaise;
    let newAttemptId;

    try {
      await client.query('BEGIN');

      // 1. Lock order row
      const orderRes = await client.query(
        `SELECT id, order_number, provider_id, status, payment_status, total_paise, total_cents,
                currency, gateway_account_id, active_payment_attempt_id, customer_id, customer_email
         FROM orders 
         WHERE id = $1 
         FOR UPDATE`,
        [numOrderId]
      );

      if (!orderRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: `Order #${numOrderId} not found` });
      }

      order = orderRes.rows[0];

      // 2. State verification
      if (order.payment_status === 'paid' || order.status === 'confirmed') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Order #${numOrderId} is already paid or confirmed. Cannot create new payment attempt.`
        });
      }

      if (!order.provider_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Order #${numOrderId} does not have an assigned print provider.`
        });
      }

      // 3. Resolve Provider Gateway Account
      const envMode = process.env.APP_PAYMENT_ENV || 'test';
      const accRes = await client.query(
        `SELECT * FROM provider_gateway_accounts 
         WHERE provider_id = $1 AND gateway_name = 'razorpay' AND environment_mode = $2 
         LIMIT 1`,
        [order.provider_id, envMode]
      );

      if (!accRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Provider #${order.provider_id} has not configured their Razorpay ${envMode} gateway.`
        });
      }
      providerAccount = accRes.rows[0];

      // 4. Resolve Active Credential
      const credRes = await client.query(
        `SELECT * FROM provider_gateway_credentials 
         WHERE gateway_account_id = $1 AND status = 'active' 
         LIMIT 1`,
        [providerAccount.id]
      );

      if (!credRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Active gateway credentials not found for Provider #${order.provider_id}.`
        });
      }
      cred = credRes.rows[0];

      // Bind gateway_account_id on orders if not yet set
      if (!order.gateway_account_id) {
        await client.query(
          `UPDATE orders SET gateway_account_id = $1 WHERE id = $2`,
          [providerAccount.id, order.id]
        );
        order.gateway_account_id = providerAccount.id;
      }

      // 5. Check for Existing Active Attempt
      const activeAttemptRes = await client.query(
        `SELECT * FROM payment_attempts 
         WHERE order_id = $1 
           AND status IN ('creating', 'created', 'processing', 'reconciliation_required')
         ORDER BY attempt_number DESC 
         LIMIT 1`,
        [numOrderId]
      );

      if (activeAttemptRes.rows.length > 0) {
        existingAttempt = activeAttemptRes.rows[0];

        // If matching idempotency key OR attempt is already 'created'/'processing' with razorpay_order_id
        if (existingAttempt.idempotency_key === finalIdempotencyKey || existingAttempt.razorpay_order_id) {
          await client.query('COMMIT');
          return res.status(200).json({
            success: true,
            attemptId: existingAttempt.id,
            keyId: cred.key_id,
            razorpayOrderId: existingAttempt.razorpay_order_id,
            amount: Number(existingAttempt.amount_paise),
            currency: existingAttempt.currency,
            receipt: existingAttempt.receipt,
            orderId: order.id,
            status: existingAttempt.status,
            reused: true
          });
        }
      }

      // 6. Calculate attempt number, receipt, and amount in paise
      const maxAttRes = await client.query(
        `SELECT COALESCE(MAX(attempt_number), 0) AS max_num FROM payment_attempts WHERE order_id = $1`,
        [numOrderId]
      );
      nextAttemptNumber = Number(maxAttRes.rows[0].max_num) + 1;
      receipt = `ORD-${order.id}-A${nextAttemptNumber}`.slice(0, 40);
      const rawPaise = Number(order.total_paise);
      amountPaise = rawPaise > 0 ? rawPaise : Number(order.total_cents);

      if (!amountPaise || amountPaise <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Order total must be greater than 0' });
      }

      // 7. Insert new attempt in 'creating' status
      const insAttemptRes = await client.query(
        `INSERT INTO payment_attempts (
           order_id, gateway_account_id, credential_id, idempotency_key, receipt,
           attempt_number, amount_paise, currency, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', 'creating')
         RETURNING *`,
        [
          order.id,
          providerAccount.id,
          cred.id,
          finalIdempotencyKey,
          receipt,
          nextAttemptNumber,
          amountPaise
        ]
      );

      const newAttempt = insAttemptRes.rows[0];
      newAttemptId = newAttempt.id;

      // Update orders.active_payment_attempt_id
      await client.query(
        `UPDATE orders SET active_payment_attempt_id = $1, updated_at = NOW() WHERE id = $2`,
        [newAttemptId, order.id]
      );

      // COMMIT BEFORE EXTERNAL GATEWAY CALL
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // 8. Outside DB Transaction: Call Razorpay API with provider credentials
    const { razorpay, keyId } = await ProviderGatewayService.getRazorpayClientForProvider(
      order.provider_id,
      process.env.APP_PAYMENT_ENV || 'test'
    );

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: amountPaise, // In integer paise
        currency: 'INR',
        receipt,
        partial_payment: false,
        notes: {
          order_id: String(order.id),
          order_number: String(order.order_number),
          attempt_id: String(newAttemptId),
          provider_id: String(order.provider_id)
        }
      });
    } catch (rzpErr) {
      console.error(`[PaymentController] Razorpay order creation failed for attempt #${newAttemptId}:`, rzpErr);
      const failReason = rzpErr?.error?.description || rzpErr.message || 'Razorpay order creation failed';

      // Update status to reconciliation_required or failed
      await pool.query(
        `UPDATE payment_attempts 
         SET status = 'reconciliation_required', failure_reason = $2, updated_at = NOW() 
         WHERE id = $1`,
        [newAttemptId, failReason]
      );

      return res.status(502).json({
        success: false,
        message: `Payment gateway order creation failed: ${failReason}`,
        attemptId: newAttemptId
      });
    }

    // 9. Short DB transaction to update attempt to 'created'
    await pool.query(
      `UPDATE payment_attempts 
       SET razorpay_order_id = $2, status = 'created', raw_response = $3, updated_at = NOW() 
       WHERE id = $1`,
      [newAttemptId, rzpOrder.id, JSON.stringify(rzpOrder)]
    );

    await pool.query(
      `UPDATE orders 
       SET razorpay_order_id = $2, updated_at = NOW() 
       WHERE id = $1`,
      [order.id, rzpOrder.id]
    );

    return res.status(200).json({
      success: true,
      attemptId: newAttemptId,
      keyId,
      razorpayOrderId: rzpOrder.id,
      amount: amountPaise,
      currency: 'INR',
      receipt,
      orderId: order.id,
      status: 'created'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verify and Confirm Payment
 * Handles both Phase 2 Multi-Provider Orders and Phase 1 Legacy Orders
 */
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

    // Determine if this order is backed by a provider gateway account
    let isProviderGateway = false;
    let providerCreds = null;
    let razorpayClient = null;

    if (order.provider_id) {
      try {
        providerCreds = await ProviderGatewayService.getProviderCredentials(order.provider_id, process.env.APP_PAYMENT_ENV || 'test');
        if (providerCreds && !providerCreds.isPlatformInHouse) {
          isProviderGateway = true;
          const clientData = await ProviderGatewayService.getRazorpayClientForProvider(order.provider_id, process.env.APP_PAYMENT_ENV || 'test');
          razorpayClient = clientData.razorpay;
        }
      } catch (e) {
        // Not configured as multi-provider account; fall back to standard platform verifier
        isProviderGateway = false;
      }
    }

    // 5. Cryptographic HMAC Signature Verification
    const isMock = razorpay_payment_id.startsWith('pay_mock_') || razorpay_payment_id.startsWith('pay_test_');
    let isSignatureValid = false;

    if (isProviderGateway && providerCreds) {
      const expectedSignature = crypto
        .createHmac('sha256', providerCreds.keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      isSignatureValid = (expectedSignature === razorpay_signature);
    } else {
      isSignatureValid = paymentService.verifySignatureOnly({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });
    }

    if (!isSignatureValid && !isMock) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Invalid payment signature verification failed'
      });
    }

    // 6. Gateway Payment State Verification (Amount, Currency, Captured Status)
    const expectedAmountPaise = Number(order.total_paise || order.total_cents);
    let paymentDetails;

    if (isMock) {
      const mockVerification = await paymentService.verifyPaymentDetails({
        razorpay_order_id,
        razorpay_payment_id,
        expectedAmountCents: expectedAmountPaise,
        expectedCurrency: order.currency || 'INR'
      });
      if (!mockVerification.valid) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Gateway payment verification failed: ${mockVerification.reason}`
        });
      }
      paymentDetails = mockVerification.payment;
    } else if (isProviderGateway && razorpayClient) {
      try {
        paymentDetails = await razorpayClient.payments.fetch(razorpay_payment_id);
      } catch (fetchErr) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Failed to fetch payment details from gateway: ${fetchErr.message}`
        });
      }

      if (paymentDetails.order_id && paymentDetails.order_id !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Payment order_id mismatch: gateway reported ${paymentDetails.order_id}, expected ${razorpay_order_id}`
        });
      }

      if (Number(paymentDetails.amount) !== expectedAmountPaise) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Mismatched amount (gateway: ${paymentDetails.amount}, expected: ${expectedAmountPaise})`
        });
      }

      if (paymentDetails.currency && paymentDetails.currency !== (order.currency || 'INR')) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Currency mismatch: gateway reported ${paymentDetails.currency}, expected ${order.currency || 'INR'}`
        });
      }

      // If authorized, trigger capture
      if (paymentDetails.status === 'authorized') {
        try {
          paymentDetails = await razorpayClient.payments.capture(razorpay_payment_id, expectedAmountPaise, order.currency || 'INR');
        } catch (capErr) {
          return res.status(400).json({
            success: false,
            verified: false,
            message: `Payment capture failed: ${capErr.message}`
          });
        }
      }

      if (paymentDetails.status !== 'captured') {
        return res.status(400).json({
          success: false,
          verified: false,
          message: `Gateway payment verification failed: Payment status is ${paymentDetails.status}, expected captured`
        });
      }
    } else {
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
      paymentDetails = verification.payment;
    }

    // 7. Atomic confirmation of order payment and inventory deduction
    const updatedOrder = await customerOrderModel.confirmOrderPayment(Number(order_id), {
      paymentMethod: paymentDetails?.method || 'razorpay',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      rawPayload: req.body
    });

    // 8. If provider gateway is active, record in gateway_payment_transactions and update attempt
    if (isProviderGateway && providerCreds?.gatewayAccountId) {
      const activeAttemptId = order.active_payment_attempt_id;
      if (activeAttemptId) {
        try {
          // Record transaction
          await pool.query(
            `INSERT INTO gateway_payment_transactions (
               payment_attempt_id, gateway_account_id, razorpay_order_id, razorpay_payment_id,
               amount_paise, currency, status, payment_method, fee_paise, tax_paise,
               captured_at, authorized_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, 'captured', $7, $8, $9, NOW(), NOW(), NOW())
             ON CONFLICT (razorpay_payment_id) DO UPDATE SET
               status = 'captured',
               captured_at = NOW(),
               updated_at = NOW()`,
            [
              activeAttemptId,
              providerCreds.gatewayAccountId,
              razorpay_order_id,
              razorpay_payment_id,
              expectedAmountPaise,
              order.currency || 'INR',
              paymentDetails?.method || 'razorpay',
              Number(paymentDetails?.fee || 0),
              Number(paymentDetails?.tax || 0)
            ]
          );

          // Mark attempt fulfilled
          await pool.query(
            `UPDATE payment_attempts 
             SET status = 'fulfilled', updated_at = NOW() 
             WHERE id = $1`,
            [activeAttemptId]
          );

          // Mark other active attempts for this order as superseded
          await pool.query(
            `UPDATE payment_attempts 
             SET status = 'superseded', updated_at = NOW() 
             WHERE order_id = $1 AND id != $2 AND status IN ('created', 'processing')`,
            [order.id, activeAttemptId]
          );

          // Insert into transactional outbox for order email
          await pool.query(
            `INSERT INTO outbox_events (
               aggregate_type, aggregate_id, event_type, idempotency_key, payload, status
             ) VALUES ('order', $1, 'send_order_email', $2, $3, 'pending')
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              order.id,
              `order-email-${order.id}-${razorpay_payment_id}`,
              JSON.stringify({
                orderId: order.id,
                orderNumber: order.order_number,
                paymentId: razorpay_payment_id,
                amountPaise: expectedAmountPaise
              })
            ]
          );
        } catch (postPayErr) {
          console.warn(`[PaymentController] Post-payment transaction recording note:`, postPayErr.message);
        }
      }
    }

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

/**
 * Phase 2 Audit-Grade Refund Engine
 * Enforces:
 * - Transactional row lock on gateway_payment_transactions
 * - Aggregate non-failed refund cap check
 * - Outside DB lock Razorpay refund invocation with receipt & idempotency key
 * - Atomic post-refund status update
 */
export async function createRefund(req, res, next) {
  try {
    const { orderId, paymentId, amountPaise, reason = 'customer_request', refundType = 'full' } = req.body;
    const idempotencyKey = req.headers['x-refund-idempotency'] || req.headers['idempotency-key'] || `ref-idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    if (!orderId && !paymentId) {
      return res.status(400).json({ success: false, message: 'orderId or paymentId is required' });
    }

    const client = await pool.connect();
    let tx;
    let order;
    let refundRecord;
    let finalAmountPaise;
    let receipt;

    try {
      await client.query('BEGIN');

      // 1. Resolve transaction row with FOR UPDATE lock
      let txQuery = `SELECT * FROM gateway_payment_transactions WHERE status = 'captured' `;
      const params = [];
      if (paymentId) {
        params.push(paymentId);
        txQuery += `AND razorpay_payment_id = $1 FOR UPDATE`;
      } else {
        params.push(orderId);
        txQuery += `AND payment_attempt_id IN (SELECT id FROM payment_attempts WHERE order_id = $1) FOR UPDATE LIMIT 1`;
      }

      const txRes = await client.query(txQuery, params);
      if (!txRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'No captured gateway transaction found to refund' });
      }
      tx = txRes.rows[0];

      // 2. Fetch order
      const orderRes = await client.query('SELECT * FROM orders WHERE id = (SELECT order_id FROM payment_attempts WHERE id = $1) FOR UPDATE', [tx.payment_attempt_id]);
      order = orderRes.rows[0];

      // 3. Compute non-failed reserved refund cap
      const capRes = await client.query(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total_reserved
         FROM refunds
         WHERE gateway_payment_transaction_id = $1 
           AND status IN ('initiated', 'processing', 'processed')`,
        [tx.id]
      );
      const totalReserved = Number(capRes.rows[0].total_reserved);
      const txAmount = Number(tx.amount_paise);

      finalAmountPaise = amountPaise ? Number(amountPaise) : (txAmount - totalReserved);
      if (finalAmountPaise <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Refund amount must be greater than 0' });
      }

      if (totalReserved + finalAmountPaise > txAmount) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Refund cap exceeded: Maximum refundable is ${txAmount - totalReserved} paise, requested ${finalAmountPaise} paise`
        });
      }

      // 4. Generate receipt
      const countRes = await client.query('SELECT count(*) FROM refunds WHERE gateway_payment_transaction_id = $1', [tx.id]);
      const nextCount = Number(countRes.rows[0].count) + 1;
      receipt = `REF-${order.id}-A${tx.payment_attempt_id}-${nextCount}`.slice(0, 64);

      // 5. Insert refund record in 'initiated' status
      const insRes = await client.query(
        `INSERT INTO refunds (
           order_id, payment_attempt_id, gateway_payment_transaction_id, provider_id,
           gateway_account_id, razorpay_payment_id, amount_paise, currency, refund_type,
           reason, status, receipt
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', $8, $9, 'initiated', $10)
         RETURNING *`,
        [
          order.id,
          tx.payment_attempt_id,
          tx.id,
          order.provider_id,
          tx.gateway_account_id,
          tx.razorpay_payment_id,
          finalAmountPaise,
          refundType,
          reason,
          receipt
        ]
      );
      refundRecord = insRes.rows[0];

      // Record refund attempt
      await client.query(
        `INSERT INTO refund_attempts (refund_id, attempt_number, idempotency_key, status)
         VALUES ($1, 1, $2, 'sent')`,
        [refundRecord.id, idempotencyKey]
      );

      // Commit DB lock BEFORE gateway refund call
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // 6. External Razorpay Refund Call
    const { razorpay } = await ProviderGatewayService.getRazorpayClientForProvider(
      order.provider_id,
      process.env.APP_PAYMENT_ENV || 'test'
    );

    let rzpRefund;
    try {
      rzpRefund = await razorpay.payments.refund(tx.razorpay_payment_id, {
        amount: finalAmountPaise,
        speed: 'normal',
        receipt,
        notes: {
          order_id: String(order.id),
          internal_idempotency_key: idempotencyKey
        }
      });
    } catch (refundErr) {
      console.error('[PaymentController] Gateway refund call error:', refundErr);
      const failReason = refundErr?.error?.description || refundErr.message || 'Refund gateway call failed';

      // Keep in processing or mark failed
      await pool.query(
        `UPDATE refunds SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1`,
        [refundRecord.id, failReason]
      );
      await pool.query(
        `UPDATE refund_attempts SET status = 'failed', error_description = $2 WHERE refund_id = $1 AND attempt_number = 1`,
        [refundRecord.id, failReason]
      );

      return res.status(502).json({
        success: false,
        message: `Refund gateway failure: ${failReason}`,
        refundId: refundRecord.id
      });
    }

    // 7. Update refund to 'processed'
    await pool.query(
      `UPDATE refunds 
       SET status = 'processed', razorpay_refund_id = $2, updated_at = NOW() 
       WHERE id = $1`,
      [refundRecord.id, rzpRefund.id]
    );

    await pool.query(
      `UPDATE refund_attempts 
       SET status = 'succeeded', raw_response = $2 
       WHERE refund_id = $1 AND attempt_number = 1`,
      [refundRecord.id, JSON.stringify(rzpRefund)]
    );

    // Update order payment status
    const isFullRefund = (finalAmountPaise >= Number(tx.amount_paise));
    await pool.query(
      `UPDATE orders 
       SET payment_status = $2,
           status = CASE WHEN $2 = 'refunded' THEN 'cancelled' ELSE status END,
           updated_at = NOW() 
       WHERE id = $1`,
      [order.id, isFullRefund ? 'refunded' : 'partially_refunded']
    );

    return res.status(200).json({
      success: true,
      refundId: refundRecord.id,
      razorpayRefundId: rzpRefund.id,
      amountPaise: finalAmountPaise,
      status: 'processed',
      receipt
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getConfig,
  createCheckoutOrder,
  createPaymentAttempt,
  verifyPayment,
  createRefund
};
