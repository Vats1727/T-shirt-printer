import { pool } from '../config/database.js';
import customerOrderModel from '../models/customerOrder.model.js';

/**
 * webhookWorker.service.js
 * 
 * Fenced background processor for persistent webhook events.
 * Implements:
 * - Lease tokens for crashed worker recovery
 * - Monotonic status rank transitions
 * - Late-capture multi-line inventory re-reservation safety
 * - Deduplicated payment exception reporting
 */
export const WebhookWorkerService = {
  /**
   * Claims and processes a batch of up to 10 pending webhook events.
   */
  async processPendingBatch(limit = 10) {
    if (!pool) return 0;
    const client = await pool.connect();
    let claimedEvents = [];

    try {
      await client.query('BEGIN');

      // Atomic claim query with lease token and SKIP LOCKED
      const claimQuery = `
        WITH claimable AS (
          SELECT id
          FROM webhook_events
          WHERE attempts < max_attempts
            AND (
              (processing_status IN ('received', 'retry_wait') 
               AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
              OR 
              (processing_status = 'processing' 
               AND locked_until IS NOT NULL 
               AND locked_until <= NOW())
            )
          ORDER BY id ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE webhook_events
        SET processing_status = 'processing',
            lease_token = gen_random_uuid(),
            locked_at = NOW(),
            locked_until = NOW() + INTERVAL '2 minutes',
            attempts = attempts + 1
        FROM claimable
        WHERE webhook_events.id = claimable.id
        RETURNING webhook_events.*;
      `;

      const claimRes = await client.query(claimQuery, [limit]);
      claimedEvents = claimRes.rows;
      await client.query('COMMIT');
    } catch (claimErr) {
      await client.query('ROLLBACK');
      console.error('[WebhookWorker] Claim error:', claimErr.message);
      return 0;
    } finally {
      client.release();
    }

    if (!claimedEvents.length) return 0;

    for (const event of claimedEvents) {
      await this.processSingleEvent(event);
    }

    return claimedEvents.length;
  },

  /**
   * Processes an individual claimed webhook event safely under fencing.
   */
  async processSingleEvent(event) {
    const eventId = event.id;
    const leaseToken = event.lease_token;
    const eventName = event.event_name;
    const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;

    try {
      if (eventName === 'payment.captured') {
        await this.handlePaymentCaptured(event, payload);
      } else if (eventName === 'payment.failed') {
        await this.handlePaymentFailed(event, payload);
      } else if (eventName === 'refund.processed' || eventName === 'refund.failed') {
        await this.handleRefundEvent(event, payload);
      }

      // Mark event completed under fencing lease
      await pool.query(
        `UPDATE webhook_events 
         SET processing_status = 'processed',
             processed_at = NOW(),
             lease_token = NULL,
             last_error = NULL 
         WHERE id = $1 AND lease_token = $2`,
        [eventId, leaseToken]
      );
    } catch (err) {
      console.error(`[WebhookWorker] Error processing event #${eventId} (${eventName}):`, err.message);

      const isMaxAttempts = event.attempts >= event.max_attempts;
      const nextStatus = isMaxAttempts ? 'dead_letter' : 'retry_wait';

      await pool.query(
        `UPDATE webhook_events 
         SET processing_status = $2,
             last_error = $3,
             next_retry_at = NOW() + (POWER(2, attempts) * INTERVAL '30 seconds'),
             lease_token = NULL 
         WHERE id = $1`,
        [eventId, nextStatus, err.message]
      );
    }
  },

  /**
   * Handles payment.captured event
   */
  async handlePaymentCaptured(event, payload) {
    const payment = payload?.payload?.payment?.entity;
    if (!payment) return;

    const rzpPaymentId = payment.id;
    const rzpOrderId = payment.order_id;
    const amountPaise = Number(payment.amount);

    // 1. Find payment attempt
    const attRes = await pool.query(
      `SELECT * FROM payment_attempts WHERE razorpay_order_id = $1 LIMIT 1`,
      [rzpOrderId]
    );

    if (!attRes.rows.length) {
      console.warn(`[WebhookWorker] No local payment attempt found for Razorpay Order ${rzpOrderId}`);
      return;
    }
    const attempt = attRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Lock order row
      const orderRes = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [attempt.order_id]
      );
      if (!orderRes.rows.length) {
        await client.query('COMMIT');
        return;
      }
      const order = orderRes.rows[0];

      // 3. Idempotency & Replay Check
      if (order.payment_status === 'paid') {
        if (order.razorpay_payment_id === rzpPaymentId) {
          // Already fulfilled with same payment ID
          await client.query('COMMIT');
          return;
        }

        // Duplicate Capture Anomaly
        const dedupeKey = `dup-cap-${order.id}-${rzpPaymentId}`;
        await client.query(
          `INSERT INTO payment_exceptions (
             dedupe_key, order_id, payment_attempt_id, provider_id, gateway_account_id,
             razorpay_payment_id, exception_type, severity, resolution_status, details
           ) VALUES ($1, $2, $3, $4, $5, $6, 'duplicate_capture', 'critical', 'open', $7)
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [
            dedupeKey,
            order.id,
            attempt.id,
            order.provider_id,
            attempt.gateway_account_id,
            rzpPaymentId,
            JSON.stringify({ payment, originalPaymentId: order.razorpay_payment_id })
          ]
        );
        await client.query('COMMIT');
        return;
      }

      // 4. Record transaction in gateway_payment_transactions
      await client.query(
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
          attempt.id,
          attempt.gateway_account_id,
          rzpOrderId,
          rzpPaymentId,
          amountPaise,
          payment.currency || 'INR',
          payment.method || 'razorpay',
          Number(payment.fee || 0),
          Number(payment.tax || 0)
        ]
      );

      // 5. Update payment_attempts
      await client.query(
        `UPDATE payment_attempts 
         SET status = 'fulfilled', updated_at = NOW() 
         WHERE id = $1`,
        [attempt.id]
      );

      // 6. Confirm order payment and inventory reservations
      await client.query(
        `UPDATE orders 
         SET payment_status = 'paid',
             status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
             razorpay_payment_id = $2,
             updated_at = NOW() 
         WHERE id = $1`,
        [order.id, rzpPaymentId]
      );

      // Confirm reservations
      const resUpdate = await client.query(
        `UPDATE inventory_reservations 
         SET status = 'confirmed', updated_at = NOW() 
         WHERE order_id = $1 AND status = 'reserved'
         RETURNING inventory_id, quantity`,
        [order.id]
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

      // 7. Enqueue transactional outbox event
      await client.query(
        `INSERT INTO outbox_events (
           aggregate_type, aggregate_id, event_type, idempotency_key, payload, status
         ) VALUES ('order', $1, 'send_order_email', $2, $3, 'pending')
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          order.id,
          `order-email-${order.id}-${rzpPaymentId}`,
          JSON.stringify({
            orderId: order.id,
            orderNumber: order.order_number,
            paymentId: rzpPaymentId,
            amountPaise
          })
        ]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  },

  /**
   * Handles payment.failed event
   */
  async handlePaymentFailed(event, payload) {
    const payment = payload?.payload?.payment?.entity;
    if (!payment) return;

    const rzpPaymentId = payment.id;
    const rzpOrderId = payment.order_id;
    const failReason = payment.error_description || payment.error_reason || 'Payment failed';

    const attRes = await pool.query(
      `SELECT * FROM payment_attempts WHERE razorpay_order_id = $1 LIMIT 1`,
      [rzpOrderId]
    );

    if (!attRes.rows.length) return;
    const attempt = attRes.rows[0];

    // Monotonic guard: do not overwrite captured transactions
    await pool.query(
      `INSERT INTO gateway_payment_transactions (
         payment_attempt_id, gateway_account_id, razorpay_order_id, razorpay_payment_id,
         amount_paise, currency, status, payment_method, failure_reason, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7, $8, NOW())
       ON CONFLICT (razorpay_payment_id) DO UPDATE SET
         status = CASE WHEN gateway_payment_transactions.status = 'captured' THEN 'captured' ELSE 'failed' END,
         failure_reason = EXCLUDED.failure_reason,
         updated_at = NOW()`,
      [
        attempt.id,
        attempt.gateway_account_id,
        rzpOrderId,
        rzpPaymentId,
        Number(payment.amount || 0),
        payment.currency || 'INR',
        payment.method || 'unknown',
        failReason
      ]
    );

    await pool.query(
      `UPDATE payment_attempts 
       SET status = 'partially_failed', failure_reason = $2, updated_at = NOW() 
       WHERE id = $1 AND status != 'fulfilled'`,
      [attempt.id, failReason]
    );
  },

  /**
   * Handles refund.processed and refund.failed events
   */
  async handleRefundEvent(event, payload) {
    const refund = payload?.payload?.refund?.entity;
    if (!refund) return;

    const rzpRefundId = refund.id;
    const rzpPaymentId = refund.payment_id;
    const status = event.event_name === 'refund.processed' ? 'processed' : 'failed';

    await pool.query(
      `UPDATE refunds 
       SET status = $2, razorpay_refund_id = COALESCE($1, razorpay_refund_id), updated_at = NOW() 
       WHERE razorpay_refund_id = $1 OR (razorpay_payment_id = $3 AND status = 'processing')`,
      [rzpRefundId, status, rzpPaymentId]
    );
  }
};

