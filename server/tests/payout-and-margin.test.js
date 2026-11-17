import { pool } from '../src/config/database.js';
import { PayoutController } from '../src/controllers/payout.controller.js';
import * as customerOrderModel from '../src/models/customerOrder.model.js';
import financialSettingsModel from '../src/models/financialSettings.model.js';
import * as userStore from '../src/services/userStore.js';

let testPassCount = 0;
let testFailCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    testFailCount++;
  } else {
    console.log(`  PASS: ${message}`);
    testPassCount++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('--- TEST SUITE: PROVIDER MARGINS & DESIGNER PAYOUTS ---');
  console.log('======================================================\n');

  try {
    // Setup test users if needed
    const provRes = await pool.query("SELECT id FROM users WHERE role = 'print_provider' LIMIT 1;");
    let providerId = provRes.rows[0]?.id;

    if (!providerId) {
      const insP = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status) VALUES ('Test Hub', 'testhub@example.com', 'hash', 'print_provider', 'active') RETURNING id;"
      );
      providerId = insP.rows[0].id;
    }

    const desRes = await pool.query("SELECT id FROM users WHERE role = 'designer' LIMIT 1;");
    let designerId = desRes.rows[0]?.id;

    if (!designerId) {
      const insD = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status, associated_provider_id) VALUES ('Test Artist', 'testartist@example.com', 'hash', 'designer', 'active', $1) RETURNING id;",
        [providerId]
      );
      designerId = insD.rows[0].id;
    } else {
      await pool.query("UPDATE users SET associated_provider_id = $1 WHERE id = $2;", [providerId, designerId]);
    }

    // ------------------------------------------------------------------
    // TEST 1: Provider Custom Designer Margin Setting & Retrieval
    // ------------------------------------------------------------------
    console.log('--- Test 1: Provider Margin Configuration ---');
    const mockReqProv = { user: { id: providerId, role: 'print_provider' }, body: { designerMarginPercent: 42.5 } };
    let savedMarginRes = null;
    const mockResProv = {
      json: (d) => { savedMarginRes = d; return d; },
      status: () => mockResProv
    };

    await PayoutController.updateProviderMargins(mockReqProv, mockResProv, (err) => { throw err; });
    assert(savedMarginRes && savedMarginRes.success === true, 'Provider can update designer royalty margin percentage');
    assert(savedMarginRes.margins.designerMarginPercent === 42.5, 'Margin updated accurately to 42.5%');

    let getMarginRes = null;
    await PayoutController.getProviderMargins(mockReqProv, {
      json: (d) => { getMarginRes = d; return d; },
      status: () => mockResProv
    }, (err) => { throw err; });
    assert(getMarginRes.margins.designerMarginPercent === 42.5, 'Provider margin persists in store_settings');
    assert(getMarginRes.margins.providerMarginPercent === 57.5, 'Provider retained margin calculated correctly without platform fee (100% - 42.5% = 57.5%)');

    // ------------------------------------------------------------------
    // TEST 2: Designer Payout Destination Profile (UPI / Bank)
    // ------------------------------------------------------------------
    console.log('\n--- Test 2: Designer Payout Profile Management ---');
    const mockReqDes = {
      user: { id: designerId, role: 'designer' },
      body: {
        method: 'upi',
        upi_id: 'testcreator@okaxis'
      }
    };
    let savedProfileRes = null;
    await PayoutController.updateDesignerPayoutProfile(mockReqDes, {
      json: (d) => { savedProfileRes = d; return d; },
      status: () => mockResProv
    }, (err) => { throw err; });
    assert(savedProfileRes && savedProfileRes.success === true, 'Designer can save UPI payout details');
    assert(savedProfileRes.payoutSettings.upi_id === 'testcreator@okaxis', 'UPI VPA stored cleanly');

    // ------------------------------------------------------------------
    // TEST 3: Dynamic Margin Split in Customer Order Engine
    // ------------------------------------------------------------------
    console.log('\n--- Test 3: Customer Order Dynamic Margin Calculation ---');
    // Create an order for ₹1,000 retail
    const testOrder = await customerOrderModel.createOrder({
      customerName: 'Test Buyer',
      customerEmail: 'buyer@test.com',
      designerId: designerId,
      providerId: providerId,
      paymentStatus: 'paid',
      status: 'confirmed',
      items: [
        {
          title: 'Graphic Tee',
          price: 1000.00,
          quantity: 1
        }
      ]
    });

    assert(testOrder && testOrder.id, 'Customer order created successfully');
    // Total subtotal = 100000 cents (₹1,000)
    // 42.5% designer margin = 42500 cents (₹425)
    // Platform fee = 0 (No platform fee deducted on retail sales)
    // Provider keeps remaining 57.5% = 57500 cents (₹575)
    assert(Number(testOrder.designer_earnings_cents) === 42500, `Designer received exact 42.5% royalty: ₹425 (got ₹${testOrder.designer_earnings_cents / 100})`);
    assert(Number(testOrder.provider_earnings_cents) === 57500, `Provider retained exact 57.5%: ₹575 (got ₹${testOrder.provider_earnings_cents / 100})`);
    assert(Number(testOrder.platform_fee_cents) === 0, `Platform fee is zero on retail garment sales (got ₹${testOrder.platform_fee_cents / 100})`);

    // ------------------------------------------------------------------
    // TEST 4: Designer Royalty Summary & Payout Request
    // ------------------------------------------------------------------
    console.log('\n--- Test 4: Designer Summary & Payout Request ---');
    let summaryRes = null;
    await PayoutController.getDesignerPayoutSummary({ user: { id: designerId } }, {
      json: (d) => { summaryRes = d; return d; }
    }, (err) => { throw err; });

    assert(summaryRes.summary.availableRupees >= 425, `Designer available balance reflects earned ₹425 (has ₹${summaryRes.summary.availableRupees})`);

    // Request Payout of ₹300
    let reqPayoutRes = null;
    await PayoutController.requestPayout(
      { user: { id: designerId }, body: { amountRupees: 300, notes: 'First batch withdrawal' } },
      { json: (d) => { reqPayoutRes = d; return d; }, status: () => mockResProv },
      (err) => { throw err; }
    );

    assert(reqPayoutRes && reqPayoutRes.success === true, 'Designer payout request created successfully');
    assert(reqPayoutRes.payoutRequest.status === 'pending', 'Payout request is in pending status');
    const payoutRequestId = reqPayoutRes.payoutRequest.id;

    // Verify Available balance dropped by ₹300
    let postReqSummary = null;
    await PayoutController.getDesignerPayoutSummary({ user: { id: designerId } }, {
      json: (d) => { postReqSummary = d; return d; }
    }, (err) => { throw err; });
    assert(postReqSummary.summary.pendingRupees >= 300, 'Pending balance reflects the ₹300 request');
    assert(postReqSummary.summary.availableRupees <= (summaryRes.summary.availableRupees - 300), 'Available balance reduced by requested amount');

    // ------------------------------------------------------------------
    // TEST 5: Provider Settlement with Bank UTR Reference
    // ------------------------------------------------------------------
    console.log('\n--- Test 5: Provider Settlement Workflow ---');
    let settleRes = null;
    await PayoutController.settlePayoutRequest(
      {
        user: { id: providerId, role: 'print_provider' },
        params: { id: payoutRequestId },
        body: { settlementReferenceUtr: 'UTR987654321012', notes: 'Paid via Corporate UPI' }
      },
      { json: (d) => { settleRes = d; return d; }, status: () => mockResProv },
      (err) => { throw err; }
    );

    assert(settleRes && settleRes.success === true, 'Provider successfully marked payout as settled');
    assert(settleRes.payoutRequest.status === 'settled', 'Request status transitioned to settled');
    assert(settleRes.payoutRequest.settlement_reference_utr === 'UTR987654321012', 'UTR reference number audit trail recorded');
    assert(settleRes.payoutRequest.settled_at !== null, 'Settlement timestamp recorded');

    // Clean up test order & payout
    await pool.query('DELETE FROM designer_payout_requests WHERE id = $1', [payoutRequestId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [testOrder.id]);

    console.log('\n======================================================');
    console.log(`RESULTS: ${testPassCount} PASSED, ${testFailCount} FAILED`);
    console.log('======================================================\n');

    process.exit(testFailCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
