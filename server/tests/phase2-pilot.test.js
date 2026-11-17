import 'dotenv/config';
import crypto from 'crypto';
import { pool } from '../src/config/database.js';
import { ProviderGatewayModel } from '../src/models/providerGateway.model.js';
import { ProviderGatewayService } from '../src/services/providerGateway.service.js';
import { WebhookWorkerService } from '../src/services/webhookWorker.service.js';
import * as paymentController from '../src/controllers/payment.controller.js';
import * as webhookController from '../src/controllers/webhook.controller.js';
import customerOrderModel from '../src/models/customerOrder.model.js';
import reservationSvc from '../src/services/inventoryReservation.service.js';
import { encryptSecret, decryptSecret } from '../src/utils/crypto.js';

const results = [];

function logTest(name, passed, detail) {
  results.push({ name, passed, detail });
  const icon = passed ? '✓ [PASSED]' : '✗ [FAILED]';
  console.log(`${icon} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function runPhase2PilotTests() {
  console.log('================================================================');
  console.log('       PHASE 2 MULTI-PROVIDER PAYMENT INTEGRATION TEST SUITE     ');
  console.log('                 PILOT PROVIDER VERIFICATION                    ');
  console.log('================================================================\n');

  const providerId = 3;
  let testOrderId = null;
  let testInvId = null;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Provider Gateway Account & AES-256-GCM Credential Decryption
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Provider Gateway Account & AES-256-GCM Credential Decryption ---');
    try {
      const creds = await ProviderGatewayService.getProviderCredentials(providerId, 'test');
      const passed = creds.gatewayAccountId && 
                     Boolean(creds.keyId && creds.keyId.startsWith('rzp_')) && 
                     Boolean(creds.keySecret && creds.keySecret.length > 8) &&
                     Boolean(creds.webhookUrlSlug);
      logTest('Test 1: Credential Decryption', passed, `Account #${creds.gatewayAccountId}, keyId: ${creds.keyId}`);
    } catch (err) {
      logTest('Test 1: Credential Decryption', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 2: Unconfigured Provider Rejection (Zero Fallback Policy)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Unconfigured Provider Rejection (Zero Fallback Policy) ---');
    try {
      const unconfiguredProviderId = 99999;
      let caughtError = null;
      try {
        await ProviderGatewayService.getProviderCredentials(unconfiguredProviderId, 'test');
      } catch (e) {
        caughtError = e;
      }
      const passed = caughtError && 
                     caughtError.message.includes('PAYMENT_GATEWAY_UNCONFIGURED') &&
                     caughtError.message.includes('Orders cannot be processed without provider gateway setup');
      logTest('Test 2: Zero Fallback Policy', passed, `Rejected unconfigured provider: "${caughtError?.message}"`);
    } catch (err) {
      logTest('Test 2: Zero Fallback Policy', false, err.message);
    }

    // Setup inventory & order for subsequent tests
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (1, 1, 20, 0, 799.00, 'phase2-pilot-tee-' || $1, 3)
       RETURNING id`,
      [Date.now()]
    );
    testInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: testInvId,
      quantity: 1,
      paymentAttemptId: 'p2_hold_' + Date.now()
    });

    const order = await customerOrderModel.createOrder({
      customerId: 4,
      customerName: 'Phase 2 Pilot Buyer',
      customerEmail: 'pilot.buyer@example.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'Phase 2 Pilot Hoodie',
        price: 799,
        quantity: 1,
        size_label: 'M',
        sizeId: 1,
        color_id: '1',
        reservation_token: resHold.reservation_token
      }],
      paymentStatus: 'pending'
    });
    testOrderId = order.id;

    // -------------------------------------------------------------------------
    // Test 3: Attempt Creation with Provider Credentials & Subunit Precision
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Attempt Creation with Provider Credentials & Subunit (Paise) Precision ---');
    let attempt1Data = null;
    try {
      let status1 = 200;
      let json1 = null;
      const req1 = {
        body: { orderId: testOrderId, idempotencyKey: 'idemp-p2-test-1' },
        headers: {}
      };
      const res1 = {
        status: (c) => { status1 = c; return res1; },
        json: (d) => { json1 = d; }
      };

      await paymentController.createPaymentAttempt(req1, res1, (e) => { if (e) throw e; });
      attempt1Data = json1;

      const passed = status1 === 200 &&
                     json1?.success === true &&
                     Boolean(json1?.keyId?.startsWith('rzp_')) &&
                     json1?.amount === 79900 &&
                     json1?.currency === 'INR' &&
                     json1?.receipt === `ORD-${testOrderId}-A1` &&
                     json1?.razorpayOrderId?.startsWith('order_');

      logTest('Test 3: Attempt Creation Precision', passed, `Receipt: ${json1?.receipt}, Amount: ${json1?.amount} paise, RZP Order: ${json1?.razorpayOrderId}`);
    } catch (err) {
      logTest('Test 3: Attempt Creation Precision', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 4: Active Attempt Reuse with Identical Idempotency Key
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Active Attempt Reuse with Identical Idempotency Key ---');
    try {
      let status2 = 200;
      let json2 = null;
      const req2 = {
        body: { orderId: testOrderId, idempotencyKey: 'idemp-p2-test-1' },
        headers: {}
      };
      const res2 = {
        status: (c) => { status2 = c; return res2; },
        json: (d) => { json2 = d; }
      };

      await paymentController.createPaymentAttempt(req2, res2, (e) => { if (e) throw e; });

      const passed = status2 === 200 &&
                     json2?.reused === true &&
                     json2?.razorpayOrderId === attempt1Data?.razorpayOrderId &&
                     json2?.attemptId === attempt1Data?.attemptId;

      logTest('Test 4: Same-Key Idempotency', passed, `Reused RZP Order: ${json2?.razorpayOrderId}`);
    } catch (err) {
      logTest('Test 4: Same-Key Idempotency', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 5: Active Attempt Reuse with Conflicting Idempotency Key
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Active Attempt Reuse with Conflicting Idempotency Key ---');
    try {
      let status3 = 200;
      let json3 = null;
      const req3 = {
        body: { orderId: testOrderId, idempotencyKey: 'idemp-different-key-999' },
        headers: {}
      };
      const res3 = {
        status: (c) => { status3 = c; return res3; },
        json: (d) => { json3 = d; }
      };

      await paymentController.createPaymentAttempt(req3, res3, (e) => { if (e) throw e; });

      const passed = status3 === 200 &&
                     json3?.reused === true &&
                     json3?.razorpayOrderId === attempt1Data?.razorpayOrderId;

      logTest('Test 5: Conflicting-Key In-Flight Protection', passed, `Returned existing active attempt: ${json3?.razorpayOrderId}`);
    } catch (err) {
      logTest('Test 5: Conflicting-Key In-Flight Protection', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 6: HMAC Signature Verification with Provider Key Secret
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: HMAC Signature Verification with Provider Key Secret ---');
    const mockPaymentId = 'pay_mock_p2_' + Date.now();
    const providerSecret = (await ProviderGatewayService.getProviderCredentials(providerId, 'test')).keySecret;
    const validSignature = crypto
      .createHmac('sha256', providerSecret)
      .update(`${attempt1Data.razorpayOrderId}|${mockPaymentId}`)
      .digest('hex');

    const invalidSignature = 'invalid_hmac_hex_12345';

    // 6a: Invalid signature rejected
    let badSigStatus = null;
    let badSigJson = null;
    await paymentController.verifyPayment({
      body: {
        order_id: testOrderId,
        razorpay_order_id: attempt1Data.razorpayOrderId,
        razorpay_payment_id: 'pay_nonmock_badsig',
        razorpay_signature: invalidSignature
      },
      user: { id: 4, role: 'customer' }
    }, {
      status: (c) => { badSigStatus = c; return { json: (j) => { badSigJson = j; } }; },
      json: () => {}
    }, () => {});

    const badSigRejected = badSigStatus === 400 && badSigJson?.message?.includes('signature verification failed');
    logTest('Test 6: HMAC Signature Verification', badSigRejected, `Tampered signature correctly rejected (HTTP 400)`);

    // -------------------------------------------------------------------------
    // Test 7: Successful Payment Verification & Safe Fulfilment
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Successful Payment Verification & Safe Fulfilment ---');
    let verifyStatus = null;
    let verifyJson = null;
    await paymentController.verifyPayment({
      body: {
        order_id: testOrderId,
        razorpay_order_id: attempt1Data.razorpayOrderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: validSignature
      },
      user: { id: 4, role: 'customer' }
    }, {
      status: (c) => { verifyStatus = c; return { json: (j) => { verifyJson = j; } }; },
      json: (j) => { verifyStatus = 200; verifyJson = j; }
    }, (e) => { if (e) throw e; });

    const orderConfirmed = verifyStatus === 200 && verifyJson?.order?.payment_status === 'paid';

    // Verify DB states: attempt fulfilled, transaction captured, stock deducted
    const attDb = await pool.query('SELECT status FROM payment_attempts WHERE id = $1', [attempt1Data.attemptId]);
    const attemptFulfilled = attDb.rows[0]?.status === 'fulfilled';

    const txDb = await pool.query('SELECT status, amount_paise FROM gateway_payment_transactions WHERE razorpay_payment_id = $1', [mockPaymentId]);
    const txCaptured = txDb.rows[0]?.status === 'captured' && Number(txDb.rows[0]?.amount_paise) === 79900;

    const outboxDb = await pool.query('SELECT status, event_type FROM outbox_events WHERE aggregate_id = $1', [testOrderId]);
    const outboxEnqueued = outboxDb.rows.length > 0 && outboxDb.rows[0]?.event_type === 'send_order_email';

    const passed7 = orderConfirmed && attemptFulfilled && txCaptured && outboxEnqueued;
    logTest('Test 7: Verification & Fulfillment', passed7, `Order Paid: ${orderConfirmed}, Attempt Fulfilled: ${attemptFulfilled}, Tx Captured: ${txCaptured}, Outbox: ${outboxEnqueued}`);

    // -------------------------------------------------------------------------
    // Test 8: Replay Protection on Already Paid Order
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Replay Protection on Already Paid Order ---');
    let replayStatus = null;
    let replayJson = null;
    await paymentController.verifyPayment({
      body: {
        order_id: testOrderId,
        razorpay_order_id: attempt1Data.razorpayOrderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: validSignature
      },
      user: { id: 4, role: 'customer' }
    }, {
      status: (c) => { replayStatus = c; return { json: (j) => { replayJson = j; } }; },
      json: (j) => { replayStatus = 200; replayJson = j; }
    }, () => {});

    const replayIdempotent = replayStatus === 200 && replayJson?.duplicate === true;
    logTest('Test 8: Replay Protection', replayIdempotent, `Identical transaction returned duplicate: true (HTTP 200)`);

    // -------------------------------------------------------------------------
    // Test 9: Webhook Ingest with Valid HMAC Signature & Durable Queueing
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Webhook Ingest with Valid HMAC Signature & Durable Queueing ---');
    const webhookSecret = 'pilot_whsec_test_vatsal_2026';
    const mockWebhookEventId = 'evt_p2_test_' + Date.now();
    const webhookPayload = {
      entity: 'event',
      account_id: 'acc_pilot_test',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_captured_' + Date.now(),
            order_id: attempt1Data.razorpayOrderId,
            amount: 79900,
            currency: 'INR',
            status: 'captured',
            method: 'upi'
          }
        }
      },
      created_at: Math.floor(Date.now() / 1000)
    };
    const rawWhBody = Buffer.from(JSON.stringify(webhookPayload), 'utf8');
    const validWhSig = crypto.createHmac('sha256', webhookSecret).update(rawWhBody).digest('hex');

    let whResStatus = 200;
    let whResJson = null;
    const whReq = {
      params: { providerSlug: 'pilot-provider-vatsal' },
      headers: {
        'x-razorpay-signature': validWhSig,
        'x-razorpay-event-id': mockWebhookEventId
      },
      body: webhookPayload,
      rawBody: rawWhBody
    };
    const whRes = {
      status: (c) => { whResStatus = c; return whRes; },
      json: (d) => { whResJson = d; }
    };

    await webhookController.handleRazorpayWebhook(whReq, whRes);

    const whIngested = whResStatus === 200 && whResJson?.received === true;
    const whRow = await pool.query('SELECT processing_status FROM webhook_events WHERE event_id = $1', [mockWebhookEventId]);
    const whPersisted = whRow.rows.length > 0;

    logTest('Test 9: Webhook Ingest & Persistence', whIngested && whPersisted, `HTTP 200 ACK received, persisted in webhook_events: ${whPersisted}`);

    // -------------------------------------------------------------------------
    // Test 10: Webhook Signature Rejection with Tampered Secret
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Webhook Signature Rejection with Tampered Secret ---');
    let badWhStatus = 200;
    let badWhJson = null;
    const badWhRes = {
      status: (c) => { badWhStatus = c; return badWhRes; },
      json: (d) => { badWhJson = d; }
    };
    const badWhReq = {
      params: { providerSlug: 'pilot-provider-vatsal' },
      headers: {
        'x-razorpay-signature': 'bad_tampered_signature_123',
        'x-razorpay-event-id': 'evt_bad_' + Date.now()
      },
      body: webhookPayload,
      rawBody: rawWhBody
    };

    await webhookController.handleRazorpayWebhook(badWhReq, badWhRes);
    const badWhRejected = badWhStatus === 401 && badWhJson?.error?.includes('signature');
    logTest('Test 10: Webhook Signature Rejection', badWhRejected, `Tampered signature rejected with HTTP 401`);

    // -------------------------------------------------------------------------
    // Test 11: Fenced Webhook Worker Claim & Monotonic Status Transition
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Fenced Webhook Worker Claim & Processing ---');
    // Allow background setImmediate to settle or claim
    await new Promise((r) => setTimeout(r, 300));
    const processedCount = await WebhookWorkerService.processPendingBatch(10);
    const postWorkerRow = await pool.query('SELECT processing_status, lease_token FROM webhook_events WHERE event_id = $1', [mockWebhookEventId]);
    const workerPassed = postWorkerRow.rows[0]?.processing_status === 'processed' && postWorkerRow.rows[0]?.lease_token === null;
    logTest('Test 11: Fenced Webhook Worker', workerPassed, `Batch processed: ${processedCount}, event status: ${postWorkerRow.rows[0]?.processing_status}`);

    // -------------------------------------------------------------------------
    // Test 12: Transactional Refund Cap Enforcement (409 Conflict)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Transactional Refund Cap Enforcement ---');
    let refCapStatus = null;
    let refCapJson = null;
    const refCapReq = {
      body: {
        paymentId: mockPaymentId,
        amountPaise: 90000, // 90000 > captured 79900
        reason: 'over_limit_test'
      },
      headers: { 'x-refund-idempotency': 'ref-cap-test-' + Date.now() }
    };
    const refCapRes = {
      status: (c) => { refCapStatus = c; return refCapRes; },
      json: (d) => { refCapJson = d; }
    };

    await paymentController.createRefund(refCapReq, refCapRes, () => {});
    const refCapPassed = refCapStatus === 409 && refCapJson?.message?.includes('Refund cap exceeded');
    logTest('Test 12: Refund Cap Enforcement', refCapPassed, `Excessive refund amount rejected with HTTP 409 Conflict`);

  } finally {
    // Clean up test data
    if (testOrderId) {
      await pool.query('UPDATE orders SET active_payment_attempt_id = NULL WHERE id = $1', [testOrderId]);
      await pool.query('DELETE FROM outbox_events WHERE aggregate_id = $1', [testOrderId]);
      await pool.query('DELETE FROM payment_exceptions WHERE order_id = $1 OR payment_attempt_id IN (SELECT id FROM payment_attempts WHERE order_id = $1)', [testOrderId]);
      await pool.query('DELETE FROM refunds WHERE order_id = $1', [testOrderId]);
      await pool.query('DELETE FROM gateway_payment_transactions WHERE payment_attempt_id IN (SELECT id FROM payment_attempts WHERE order_id = $1) OR razorpay_payment_id LIKE \'pay_%\'', [testOrderId]);
      await pool.query('DELETE FROM payment_attempts WHERE order_id = $1', [testOrderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [testOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    }
    if (testInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [testInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [testInvId]);
    }
    await pool.query('DELETE FROM webhook_events WHERE event_id LIKE \'evt_p2_%\'');
  }

  // Summary
  console.log('\n================================================================');
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  console.log(`OVERALL STATUS: ${allPassed ? '✓ 100% ALL PILOT TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log('================================================================');

  if (!allPassed) process.exit(1);
  process.exit(0);
}

runPhase2PilotTests().catch(err => {
  console.error('[Phase2Pilot] Fatal test execution error:', err);
  process.exit(1);
});
