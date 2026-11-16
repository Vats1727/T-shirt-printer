import { pool } from '../src/config/database.js';
import * as productsStore from '../src/services/productsStore.js';
import * as listingModel from '../src/models/listing.model.js';
import * as customerOrderModel from '../src/models/customerOrder.model.js';
import * as reservationSvc from '../src/services/inventoryReservation.service.js';
import { validateApparelOnly } from '../src/middleware/apparelGuard.js';
import * as supplierController from '../src/controllers/supplier.controller.js';
import * as portalController from '../src/controllers/portal.controller.js';
import * as orderController from '../src/controllers/order.controller.js';
import * as paymentController from '../src/controllers/payment.controller.js';
import { requirePermission } from '../src/middleware/auth.middleware.js';
import paymentService from '../src/services/payment.service.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const results = [];

function logTest(testName, passed, details = '') {
  const status = passed ? 'PASSED' : 'FAILED';
  console.log(`[${status}] ${testName} ${details ? '- ' + details : ''}`);
  results.push({ testName, passed, details });
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('       PRINT-ON-DEMAND APPAREL MARKETPLACE REGRESSION SUITE      ');
  console.log('                 PHASE 1 FINAL VERIFICATION                     ');
  console.log('================================================================\n');

  // Test 1: V-neck master garment mapping verification
  console.log('--- Test 1: V-Neck Master Garment Mapping & Approval Default ---');
  try {
    const p6Res = await pool.query(
      `SELECT pf.id, pf.name, pf.slug, pf.garment_id, pf.is_approved, amg.name as garment_name, amg.knit_type, amg.gsm
       FROM products_full pf
       LEFT JOIN apparel_master_garments amg ON amg.id = pf.garment_id
       WHERE pf.id = 6`
    );
    const p6 = p6Res.rows[0];
    const isVneck = Number(p6.garment_id) === 6 && p6.garment_name.includes('V-Neck');
    if (!isVneck) {
      throw new Error(`Product #6 is mapped to garment #${p6.garment_id} (${p6.garment_name}), expected Classic V-Neck (ID #6)`);
    }

    const defaultCheck = await pool.query(
      "SELECT column_default FROM information_schema.columns WHERE table_name = 'products_full' AND column_name = 'is_approved'"
    );
    const isDefaultFalse = defaultCheck.rows[0]?.column_default?.toLowerCase().includes('false');
    if (!isDefaultFalse) {
      throw new Error(`Column is_approved default is "${defaultCheck.rows[0]?.column_default}", expected false`);
    }

    logTest('Test 1: V-Neck Garment Mapping', true, `Product #6 mapped to "${p6.garment_name}" (${p6.gsm} GSM), is_approved default = false`);
  } catch (err) {
    logTest('Test 1: V-Neck Garment Mapping', false, err.message);
  }

  // Test 2: Invalid Master Garment ID rejected with HTTP 422
  console.log('\n--- Test 2: Invalid Master Garment ID (HTTP 422) ---');
  try {
    let mockStatus = null;
    let mockJson = null;
    const req = {
      body: { name: 'Invalid Garment Hoodie', garment_id: 999999 },
      method: 'POST'
    };
    const res = {
      status: (code) => { mockStatus = code; return res; },
      json: (data) => { mockJson = data; }
    };
    let nextCalled = false;
    await validateApparelOnly(req, res, () => { nextCalled = true; });

    const passed = mockStatus === 422 && !nextCalled;
    logTest('Test 2: Invalid Garment ID', passed, `Status: ${mockStatus}, Message: ${mockJson?.message}`);
  } catch (err) {
    logTest('Test 2: Invalid Garment ID', false, err.message);
  }

  // Test 3: Inactive Master Garment rejected with HTTP 422
  console.log('\n--- Test 3: Inactive Master Garment Protection ---');
  let testGarmentId = null;
  try {
    const gRes = await pool.query(
      `INSERT INTO apparel_master_garments (
         category_id, name, slug, fabric_composition, knit_type, gsm, is_active
       ) VALUES (
         1, 'Discontinued Bamboo Tee', 'discontinued-bamboo-tee-${Date.now()}', '100% Bamboo', 'Jersey', 160, FALSE
       ) RETURNING id`
    );
    testGarmentId = gRes.rows[0].id;

    let mockStatus = null;
    let mockJson = null;
    const req = {
      body: { name: 'Bamboo Tee Custom', garment_id: testGarmentId },
      method: 'POST'
    };
    const res = {
      status: (code) => { mockStatus = code; return res; },
      json: (data) => { mockJson = data; }
    };
    let nextCalled = false;
    await validateApparelOnly(req, res, () => { nextCalled = true; });

    const passed = mockStatus === 422 && !nextCalled;
    logTest('Test 3: Inactive Master Garment', passed, `Status: ${mockStatus}, Message: ${mockJson?.message}`);
  } catch (err) {
    logTest('Test 3: Inactive Master Garment', false, err.message);
  } finally {
    if (testGarmentId) {
      await pool.query('DELETE FROM apparel_master_garments WHERE id = $1', [testGarmentId]);
    }
  }

  // Test 4: Unapproved Product Listing Creation Blocked (HTTP 422)
  console.log('\n--- Test 4: Unapproved Product Publication Protection ---');
  let unapprovedProdId = null;
  let unapprovedDesignId = null;
  try {
    const pRes = await pool.query(
      `INSERT INTO products_full (
         name, slug, garment_id, is_approved, owner_id, status
       ) VALUES (
         'Unapproved Draft Hoodie', 'unapproved-draft-hoodie-${Date.now()}', 3, FALSE, 3, 'draft'
       ) RETURNING id`
    );
    unapprovedProdId = pRes.rows[0].id;

    const dRes = await pool.query(
      `INSERT INTO designs (
         slogan, color, product, product_id, owner_id, provider_id
       ) VALUES (
         'Unapproved Print', '#000', 'hoodie', $1, 4, 3
       ) RETURNING id`,
      [unapprovedProdId]
    );
    unapprovedDesignId = dRes.rows[0].id;

    let mockStatus = null;
    let mockJson = null;
    const req = {
      user: { id: 4, role: 'designer' },
      body: {
        title: 'Listing for Unapproved Hoodie',
        slug: 'listing-unapproved-' + Date.now(),
        design_key: 'design-' + unapprovedDesignId,
        visibility: 'public',
        price: 999
      }
    };
    const res = {
      status: (code) => { mockStatus = code; return res; },
      json: (data) => { mockJson = data; }
    };

    await supplierController.createListing(req, res, () => {});

    const passed = mockStatus === 422 && mockJson?.error === 'UnapprovedProduct';
    logTest('Test 4: Unapproved Product Listing Creation Blocked', passed, `Status: ${mockStatus}, Error: ${mockJson?.error}`);
  } catch (err) {
    logTest('Test 4: Unapproved Product Listing Creation Blocked', false, err.message);
  }

  // Test 5: Unapproved Product Direct Checkout Blocked (HTTP 422)
  console.log('\n--- Test 5: Unapproved Product Direct Checkout Protection ---');
  try {
    let orderError = null;
    try {
      await customerOrderModel.createOrder({
        customerId: null,
        customerName: 'Test Buyer',
        customerEmail: 'testbuyer@gmail.com',
        designerId: 4,
        providerId: 3,
        items: [{
          product_id: unapprovedProdId,
          title: 'Unapproved Draft Hoodie',
          price: 999,
          quantity: 1,
          size_label: 'M',
          color_id: '1'
        }],
        paymentStatus: 'paid'
      });
    } catch (e) {
      orderError = e;
    }

    const passed = orderError && (orderError.statusCode === 422 || orderError.message.includes('pending administrative approval'));
    logTest('Test 5: Unapproved Product Direct Checkout Blocked', passed, `Caught error: "${orderError?.message}"`);
  } catch (err) {
    logTest('Test 5: Unapproved Product Direct Checkout Blocked', false, err.message);
  } finally {
    if (unapprovedDesignId) await pool.query('DELETE FROM designs WHERE id = $1', [unapprovedDesignId]);
    if (unapprovedProdId) await pool.query('DELETE FROM products_full WHERE id = $1', [unapprovedProdId]);
  }

  // Test 6: Concurrency Protection (2 Simultaneous Orders for 1 Unit)
  console.log('\n--- Test 6: Concurrency Protection (2 Simultaneous Orders for 1 Unit) ---');
  let singleUnitInvId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 1, 0, 50.00, 'limited-drop-tee', 3
       ) RETURNING id`
    );
    singleUnitInvId = invRes.rows[0].id;

    const [attempt1, attempt2] = await Promise.allSettled([
      reservationSvc.createReservation({
        inventoryId: singleUnitInvId,
        quantity: 1,
        paymentAttemptId: 'concurrent_attempt_A_' + Date.now()
      }),
      reservationSvc.createReservation({
        inventoryId: singleUnitInvId,
        quantity: 1,
        paymentAttemptId: 'concurrent_attempt_B_' + Date.now()
      })
    ]);

    const oneSucceeded = (attempt1.status === 'fulfilled' && attempt2.status === 'rejected') ||
                         (attempt2.status === 'fulfilled' && attempt1.status === 'rejected');
    const rejectedReason = attempt1.status === 'rejected' ? attempt1.reason?.message : attempt2.reason?.message;

    const finalStock = await reservationSvc.getAvailableStock(singleUnitInvId);
    const passed = oneSucceeded && finalStock.total === 1 && finalStock.reserved === 1 && finalStock.available === 0;

    logTest('Test 6: Race Condition (2 checkouts for 1 unit)', passed,
      `1 Succeeded, 1 Rejected ("${rejectedReason}"). Available stock: ${finalStock.available}`);
  } catch (err) {
    logTest('Test 6: Race Condition Protection', false, err.message);
  } finally {
    if (singleUnitInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [singleUnitInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [singleUnitInvId]);
    }
  }

  // Test 7: Exact Database State Audit: Before, During, and After Payment Confirmation
  console.log('\n--- Test 7: Exact Database State Audit (Before, During, After Confirmation) ---');
  let auditInvId = null;
  let auditOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 150, 0, 99.00, 'audit-hoodie-test', 3
       ) RETURNING id`
    );
    auditInvId = invRes.rows[0].id;

    const dbBefore = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [auditInvId]);
    const beforeQty = Number(dbBefore.rows[0].quantity);
    const beforeReserved = Number(dbBefore.rows[0].reserved_quantity);
    const beforeAvailable = beforeQty - beforeReserved;

    const reservation = await reservationSvc.createReservation({
      inventoryId: auditInvId,
      quantity: 1,
      paymentAttemptId: 'audit_pay_' + Date.now()
    });

    const dbDuring = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [auditInvId]);
    const duringQty = Number(dbDuring.rows[0].quantity);
    const duringReserved = Number(dbDuring.rows[0].reserved_quantity);
    const duringAvailable = duringQty - duringReserved;

    const order = await customerOrderModel.createOrder({
      customerId: null,
      customerName: 'Audit Customer',
      customerEmail: 'audit@example.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'Audit Hoodie',
        price: 99,
        quantity: 1,
        color_id: '1',
        size_label: 'S',
        sizeId: 1,
        reservation_token: reservation.reservation_token
      }],
      paymentStatus: 'paid'
    });
    auditOrderId = order.id;

    const dbAfter = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [auditInvId]);
    const afterQty = Number(dbAfter.rows[0].quantity);
    const afterReserved = Number(dbAfter.rows[0].reserved_quantity);
    const afterAvailable = afterQty - afterReserved;

    const mathValid = (beforeQty === 150 && beforeReserved === 0 && beforeAvailable === 150) &&
                      (duringQty === 150 && duringReserved === 1 && duringAvailable === 149) &&
                      (afterQty === 149 && afterReserved === 0 && afterAvailable === 149);

    logTest('Test 7: Exact Database Values Audit', mathValid,
      `Before (150/0/150) -> During (150/1/149) -> After (149/0/149): ${mathValid ? '100% MATCH' : 'MISMATCH'}`);
  } catch (err) {
    logTest('Test 7: Exact Database Values Audit', false, err.message);
  } finally {
    if (auditOrderId) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [auditOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [auditOrderId]);
    }
    if (auditInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [auditInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [auditInvId]);
    }
  }

  // Test 8: Unpaid / Pending Order Does NOT Deduct Physical Stock
  console.log('\n--- Test 8: Pending Payment Does NOT Deduct Physical Stock ---');
  let pendingInvId = null;
  let pendingOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 50, 0, 50.00, 'pending-hoodie', 3
       ) RETURNING id`
    );
    pendingInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: pendingInvId,
      quantity: 1,
      paymentAttemptId: 'pending_pay_' + Date.now()
    });

    const pendingOrder = await customerOrderModel.createOrder({
      customerId: null,
      customerName: 'Pending Buyer',
      customerEmail: 'pendingbuyer@gmail.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'Pending Hoodie',
        price: 50,
        quantity: 1,
        color_id: '1',
        size_label: 'S',
        sizeId: 1,
        reservation_token: resHold.reservation_token
      }],
      paymentStatus: 'pending'
    });
    pendingOrderId = pendingOrder.id;

    const dbPendingCheck = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [pendingInvId]);
    const pQty = Number(dbPendingCheck.rows[0].quantity);
    const pReserved = Number(dbPendingCheck.rows[0].reserved_quantity);

    const passed = pQty === 50 && pReserved === 1;
    logTest('Test 8: Pending Payment Stock Safety', passed, `Physical quantity = ${pQty} (untouched), Reserved = ${pReserved}`);
  } catch (err) {
    logTest('Test 8: Pending Payment Stock Safety', false, err.message);
  } finally {
    if (pendingOrderId) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [pendingOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [pendingOrderId]);
    }
    if (pendingInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [pendingInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [pendingInvId]);
    }
  }

  // Test 9: Duplicate Reservation Confirmation (Idempotency)
  console.log('\n--- Test 9: Duplicate Reservation Confirmation Idempotency ---');
  let idempInvId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 10, 0, 50.00, 'idemp-tee', 3
       ) RETURNING id`
    );
    idempInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: idempInvId,
      quantity: 1,
      paymentAttemptId: 'idemp_pay_' + Date.now()
    });

    await reservationSvc.confirmReservation({ token: resHold.reservation_token, orderId: null });
    const stock1 = await reservationSvc.getAvailableStock(idempInvId);

    await reservationSvc.confirmReservation({ token: resHold.reservation_token, orderId: null });
    const stock2 = await reservationSvc.getAvailableStock(idempInvId);

    const passed = stock1.total === 9 && stock2.total === 9 && stock2.reserved === 0;
    logTest('Test 9: Duplicate Confirmation Idempotency', passed,
      `Physical stock after first confirm: ${stock1.total}, after duplicate: ${stock2.total} (deducted only once)`);
  } catch (err) {
    logTest('Test 9: Duplicate Confirmation Idempotency', false, err.message);
  } finally {
    if (idempInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [idempInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [idempInvId]);
    }
  }

  // Test 10: Duplicate Reservation Release (Idempotency)
  console.log('\n--- Test 10: Duplicate Reservation Release Idempotency ---');
  let relInvId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 10, 0, 50.00, 'release-tee', 3
       ) RETURNING id`
    );
    relInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: relInvId,
      quantity: 2,
      paymentAttemptId: 'rel_pay_' + Date.now()
    });

    await reservationSvc.releaseReservation({ token: resHold.reservation_token });
    const stock1 = await reservationSvc.getAvailableStock(relInvId);

    await reservationSvc.releaseReservation({ token: resHold.reservation_token });
    const stock2 = await reservationSvc.getAvailableStock(relInvId);

    const passed = stock1.reserved === 0 && stock2.reserved === 0 && stock2.available === 10;
    logTest('Test 10: Duplicate Release Idempotency', passed,
      `Reserved stock after first release: ${stock1.reserved}, after duplicate: ${stock2.reserved} (restored only once)`);
  } catch (err) {
    logTest('Test 10: Duplicate Release Idempotency', false, err.message);
  } finally {
    if (relInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [relInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [relInvId]);
    }
  }

  // Test 11: Provider Isolation Check
  console.log('\n--- Test 11: Provider Inventory Cross-Access Isolation (403 Forbidden) ---');
  let isoInvId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 20, 0, 50.00, 'provider3-exclusive-blank', 3
       ) RETURNING id`
    );
    isoInvId = invRes.rows[0].id;

    let accessError = null;
    try {
      await reservationSvc.createReservation({
        inventoryId: isoInvId,
        quantity: 1,
        callerProviderId: 12
      });
    } catch (e) {
      accessError = e;
    }

    const passed = accessError && (accessError.statusCode === 403 || accessError.message.includes('Access denied'));
    logTest('Test 11: Provider Cross-Access Isolation', passed, `Caught 403 error: "${accessError?.message}"`);
  } catch (err) {
    logTest('Test 11: Provider Cross-Access Isolation', false, err.message);
  } finally {
    if (isoInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [isoInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [isoInvId]);
    }
  }

  // Test 12: Customer-Side Payment Status Forgery Sanitization Check
  console.log('\n--- Test 12: Untrusted Client Payment Status Forgery Sanitization ---');
  let forgeryInvId = null;
  let forgeryOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 30, 0, 40.00, 'forgery-check-tee', 3
       ) RETURNING id`
    );
    forgeryInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: forgeryInvId,
      quantity: 1,
      paymentAttemptId: 'forgery_pay_' + Date.now()
    });

    // Untrusted customer sends { paymentStatus: "paid" } without staff credentials or valid Razorpay signature
    const userRes = await pool.query("SELECT id FROM users ORDER BY id ASC LIMIT 1");
    const testCustomerId = userRes.rows[0]?.id || null;

    let responseStatus = null;
    let responseData = null;
    const mockReq = {
      user: { id: testCustomerId, role: 'customer' },
      body: {
        customerName: 'Shady Customer',
        customerEmail: 'shady@example.com',
        paymentStatus: 'paid', // ATTEMPTED FORGERY
        items: [{
          product_id: 1,
          title: 'Protected Apparel',
          price: 40,
          quantity: 1,
          size_label: 'S',
          sizeId: 1,
          color_id: '1',
          reservation_token: resHold.reservation_token
        }]
      }
    };
    const mockRes = {
      status: (code) => { responseStatus = code; return mockRes; },
      json: (data) => { responseData = data; }
    };

    await orderController.createCustomerOrder(mockReq, mockRes, (e) => { if (e) throw e; });
    forgeryOrderId = responseData?.order?.id;

    // Check saved order in database
    const savedOrder = await pool.query('SELECT payment_status, status FROM orders WHERE id = $1', [forgeryOrderId]);
    const savedPaymentStatus = savedOrder.rows[0]?.payment_status;

    // Check inventory stock in database: quantity must NOT have been decremented
    const stockCheck = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [forgeryInvId]);
    const stockQty = Number(stockCheck.rows[0]?.quantity);
    const stockReserved = Number(stockCheck.rows[0]?.reserved_quantity);

    const passed = savedPaymentStatus === 'pending' && stockQty === 30 && stockReserved === 1;
    logTest('Test 12: Customer-Side Payment Status Forgery Sanitization', passed,
      `Attempted 'paid' forced to '${savedPaymentStatus}'. Stock physical = ${stockQty} (retained), Reserved = ${stockReserved}`);
  } catch (err) {
    logTest('Test 12: Customer-Side Payment Status Forgery Sanitization', false, err.message);
  } finally {
    if (forgeryOrderId) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [forgeryOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [forgeryOrderId]);
    }
    if (forgeryInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [forgeryInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [forgeryInvId]);
    }
  }

  // Test 13: Portal Admin Product Approval Workflow
  console.log('\n--- Test 13: Portal Admin Product Approval & Revocation Workflow ---');
  let portalProdId = null;
  try {
    // 13a. Create new provider blank (starts with is_approved = false)
    const pRes = await pool.query(
      `INSERT INTO products_full (
         name, slug, garment_id, is_approved, owner_id, status
       ) VALUES (
         'Portal Test Garment', 'portal-test-garment-${Date.now()}', 1, FALSE, 3, 'draft'
       ) RETURNING id`
    );
    portalProdId = pRes.rows[0].id;

    // 13b. Portal Admin approves blank
    let approveStatus = null;
    let approveData = null;
    const approveReq = {
      params: { id: portalProdId },
      body: { is_approved: true },
      user: { id: 1, role: 'portal_admin' }
    };
    const approveRes = {
      status: (code) => { approveStatus = code; return approveRes; },
      json: (data) => { approveData = data; }
    };
    await portalController.updateProductApproval(approveReq, approveRes, (e) => { if (e) throw e; });

    const pAfterApprove = await pool.query('SELECT is_approved FROM products_full WHERE id = $1', [portalProdId]);
    const isApprovedNow = pAfterApprove.rows[0]?.is_approved === true;

    // 13c. Portal Admin revokes approval / rejects
    let rejectStatus = null;
    let rejectData = null;
    const rejectReq = {
      params: { id: portalProdId },
      body: { is_approved: false },
      user: { id: 1, role: 'portal_admin' }
    };
    const rejectRes = {
      status: (code) => { rejectStatus = code; return rejectRes; },
      json: (data) => { rejectData = data; }
    };
    await portalController.updateProductApproval(rejectReq, rejectRes, (e) => { if (e) throw e; });

    const pAfterReject = await pool.query('SELECT is_approved, status FROM products_full WHERE id = $1', [portalProdId]);
    const isRejectedNow = pAfterReject.rows[0]?.is_approved === false && pAfterReject.rows[0]?.status === 'draft';

    const passed = isApprovedNow && isRejectedNow;
    logTest('Test 13: Portal Admin Product Approval Workflow', passed,
      `Created as pending -> Approved (is_approved: true) -> Revoked (is_approved: false, status: draft)`);
  } catch (err) {
    logTest('Test 13: Portal Admin Product Approval Workflow', false, err.message);
  } finally {
    if (portalProdId) {
      await pool.query('DELETE FROM products_full WHERE id = $1', [portalProdId]);
    }
  }

  // Test 14: Privileged Admin Payment Bypass Removal
  console.log('\n--- Test 14: Admin Generic paymentStatus: "paid" Override Blocked ---');
  let adminBypassInvId = null;
  let adminBypassOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 25, 0, 45.00, 'admin-bypass-tee', 3
       ) RETURNING id`
    );
    adminBypassInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: adminBypassInvId,
      quantity: 1,
      paymentAttemptId: 'admin_bypass_pay_' + Date.now()
    });

    let respStatus = null;
    let respData = null;
    const adminReq = {
      user: { id: 1, role: 'admin', name: 'Super Admin' },
      body: {
        customerName: 'Phone Order Buyer',
        customerEmail: 'phonebuyer@example.com',
        paymentStatus: 'paid', // Admin attempting generic 'paid' without explicit manual flow
        items: [{
          product_id: 1,
          title: 'Protected Blank',
          price: 45,
          quantity: 1,
          size_label: 'S',
          sizeId: 1,
          color_id: '1',
          reservation_token: resHold.reservation_token
        }]
      }
    };
    const adminRes = {
      status: (code) => { respStatus = code; return adminRes; },
      json: (data) => { respData = data; }
    };

    await orderController.createCustomerOrder(adminReq, adminRes, (e) => { if (e) throw e; });
    adminBypassOrderId = respData?.order?.id;

    const savedOrder = await pool.query('SELECT payment_status, status FROM orders WHERE id = $1', [adminBypassOrderId]);
    const savedPayStatus = savedOrder.rows[0]?.payment_status;

    const stockCheck = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [adminBypassInvId]);
    const stockQty = Number(stockCheck.rows[0]?.quantity);
    const stockReserved = Number(stockCheck.rows[0]?.reserved_quantity);

    // Generic 'paid' is ignored and forced to 'pending'; stock is NOT committed
    const passed = savedPayStatus === 'pending' && stockQty === 25 && stockReserved === 1;
    logTest('Test 14: Admin Generic "paid" Bypass Blocked', passed,
      `Admin-submitted "paid" forced to "${savedPayStatus}". Physical stock = ${stockQty} (untouched), Reserved = ${stockReserved}`);
  } catch (err) {
    logTest('Test 14: Admin Generic "paid" Bypass Blocked', false, err.message);
  } finally {
    if (adminBypassOrderId) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [adminBypassOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [adminBypassOrderId]);
    }
    if (adminBypassInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [adminBypassInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [adminBypassInvId]);
    }
  }

  // Test 15: Audited Manual / Offline Payment Confirmation Flow
  console.log('\n--- Test 15: Audited Manual / Offline Payment Confirmation Flow ---');
  let manualInvId = null;
  let manualOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 40, 0, 60.00, 'manual-pay-tee', 3
       ) RETURNING id`
    );
    manualInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: manualInvId,
      quantity: 1,
      paymentAttemptId: 'manual_hold_' + Date.now()
    });

    const pendingOrder = await customerOrderModel.createOrder({
      customerId: 4,
      customerName: 'Offline Customer',
      customerEmail: 'offline@example.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'Manual Tee',
        price: 60,
        quantity: 1,
        size_label: 'S',
        sizeId: 1,
        color_id: '1',
        reservation_token: resHold.reservation_token
      }],
      paymentStatus: 'pending'
    });
    manualOrderId = pendingOrder.id;

    // 15a: Missing parameters rejected
    let badParamStatus = null;
    let badParamJson = null;
    const badReq = {
      params: { id: manualOrderId },
      body: { paymentMethod: 'invalid_method' },
      user: { id: 1, role: 'admin', name: 'Admin Staff' }
    };
    const badRes = {
      status: (code) => { badParamStatus = code; return badRes; },
      json: (data) => { badParamJson = data; }
    };
    await orderController.confirmManualPayment(badReq, badRes, (e) => {});
    const badParamPassed = badParamStatus === 400;

    // 15b: Valid manual payment confirmation by admin
    let confirmStatus = null;
    let confirmJson = null;
    const goodReq = {
      params: { id: manualOrderId },
      body: {
        paymentMethod: 'manual_bank_transfer',
        transactionReference: 'HDFC-NEFT-897261',
        confirmationReason: 'Verified funds credited to company current account'
      },
      user: { id: 1, role: 'admin', name: 'Portal Admin Lead', email: 'admin@tshirt.com' }
    };
    const goodRes = {
      status: (code) => { confirmStatus = code; return goodRes; },
      json: (data) => { confirmJson = data; }
    };
    await orderController.confirmManualPayment(goodReq, goodRes, (e) => { if (e) throw e; });

    // Verify order in database
    const oCheck = await pool.query('SELECT payment_status, status, payment_method, tracking_info FROM orders WHERE id = $1', [manualOrderId]);
    const isPaid = oCheck.rows[0]?.payment_status === 'paid' && oCheck.rows[0]?.status === 'confirmed';
    const hasTimeline = JSON.stringify(oCheck.rows[0]?.tracking_info).includes('HDFC-NEFT-897261');

    // Verify payment record in database
    const pCheck = await pool.query('SELECT * FROM payments WHERE order_id = $1', [manualOrderId]);
    const hasPaymentRow = pCheck.rows.length === 1 && pCheck.rows[0].gateway === 'manual' && pCheck.rows[0].payment_method === 'manual_bank_transfer';
    const auditPayload = pCheck.rows[0]?.raw_payload || {};
    const auditValid = auditPayload.confirmed_by_admin_name === 'Portal Admin Lead' && auditPayload.transaction_reference === 'HDFC-NEFT-897261';

    // Verify inventory commit: quantity = 39, reserved = 0
    const invCheck = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [manualInvId]);
    const stockCommitted = Number(invCheck.rows[0]?.quantity) === 39 && Number(invCheck.rows[0]?.reserved_quantity) === 0;

    // 15c: Duplicate confirmation rejected with 400
    let dupStatus = null;
    let dupJson = null;
    const dupRes = {
      status: (code) => { dupStatus = code; return dupRes; },
      json: (data) => { dupJson = data; }
    };
    await orderController.confirmManualPayment(goodReq, dupRes, (e) => {});
    const dupRejected = dupStatus === 409 || dupStatus === 400;

    const test15Passed = badParamPassed && confirmStatus === 200 && isPaid && hasTimeline && hasPaymentRow && auditValid && stockCommitted && dupRejected;
    logTest('Test 15: Audited Manual Payment Confirmation', test15Passed,
      `Bad params: ${badParamStatus}, Confirmed: ${confirmStatus}, Paid/Confirmed: ${isPaid}, Audit: ${auditValid}, Stock (39/0): ${stockCommitted}, Duplicate Blocked: ${dupRejected}`);
  } catch (err) {
    logTest('Test 15: Audited Manual Payment Confirmation', false, err.message);
  } finally {
    if (manualOrderId) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [manualOrderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [manualOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [manualOrderId]);
    }
    if (manualInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [manualInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [manualInvId]);
    }
  }

  // Test 16: Razorpay Payment Verification Security Checks
  console.log('\n--- Test 16: Razorpay Gateway Verification Security Checks ---');
  let rzpInvId = null;
  let rzpOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 60, 0, 75.00, 'rzp-sec-tee', 3
       ) RETURNING id`
    );
    rzpInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: rzpInvId,
      quantity: 1,
      paymentAttemptId: 'rzp_sec_hold_' + Date.now()
    });

    const expectedRzpOrderId = `order_test_${Date.now()}`;
    const rzpOrder = await customerOrderModel.createOrder({
      customerId: 4, // Designer/Customer #4 owns this order
      customerName: 'Verified Customer',
      customerEmail: 'verified@example.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'RZP Security Tee',
        price: 75,
        quantity: 1,
        size_label: 'S',
        sizeId: 1,
        color_id: '1',
        reservation_token: resHold.reservation_token
      }],
      paymentStatus: 'pending',
      razorpayOrderId: expectedRzpOrderId
    });
    rzpOrderId = rzpOrder.id;

    // 16a: Invalid HMAC cryptographic signature rejected
    let sigStatus = null;
    let sigJson = null;
    const badSigReq = {
      body: {
        order_id: rzpOrderId,
        razorpay_order_id: expectedRzpOrderId,
        razorpay_payment_id: 'pay_live_fake_123',
        razorpay_signature: 'invalid_forged_signature_000000000000000000000000000000000000'
      },
      user: { id: 4, role: 'customer' }
    };
    const badSigRes = {
      status: (code) => { sigStatus = code; return badSigRes; },
      json: (data) => { sigJson = data; }
    };
    await paymentController.verifyPayment(badSigReq, badSigRes, (e) => {});
    const sigCheckPassed = sigStatus === 400;

    // 16b: Mismatched Razorpay Order ID rejected
    let mismatchStatus = null;
    let mismatchJson = null;
    const mismatchReq = {
      body: {
        order_id: rzpOrderId,
        razorpay_order_id: 'order_completely_different_id_999',
        razorpay_payment_id: 'pay_mock_test_123',
        razorpay_signature: 'test_sig'
      },
      user: { id: 4, role: 'customer' }
    };
    const mismatchRes = {
      status: (code) => { mismatchStatus = code; return mismatchRes; },
      json: (data) => { mismatchJson = data; }
    };
    await paymentController.verifyPayment(mismatchReq, mismatchRes, (e) => {});
    const mismatchPassed = mismatchStatus === 400 && mismatchJson?.message?.includes('Mismatched order ID');

    // 16c: Unauthorized user check (Customer #99 tries to verify Customer #4's order)
    let unauthStatus = null;
    let unauthJson = null;
    const unauthReq = {
      body: {
        order_id: rzpOrderId,
        razorpay_order_id: expectedRzpOrderId,
        razorpay_payment_id: 'pay_mock_test_123',
        razorpay_signature: 'test_sig'
      },
      user: { id: 99, role: 'customer' } // Imposter user
    };
    const unauthRes = {
      status: (code) => { unauthStatus = code; return unauthRes; },
      json: (data) => { unauthJson = data; }
    };
    await paymentController.verifyPayment(unauthReq, unauthRes, (e) => {});
    const unauthPassed = unauthStatus === 403;

    // 16d: Legitimate verification succeeds and commits inventory
    let legitStatus = null;
    let legitJson = null;
    const legitReq = {
      body: {
        order_id: rzpOrderId,
        razorpay_order_id: expectedRzpOrderId,
        razorpay_payment_id: 'pay_mock_legit_' + Date.now(),
        razorpay_signature: 'test_valid_sig'
      },
      user: { id: 4, role: 'customer' }
    };
    const legitRes = {
      status: (code) => { legitStatus = code; return legitRes; },
      json: (data) => { legitJson = data; }
    };
    await paymentController.verifyPayment(legitReq, legitRes, (e) => { if (e) throw e; });
    const legitPassed = legitStatus === 200 && legitJson?.order?.payment_status === 'paid';

    // Verify stock is now committed
    const rzpStock = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [rzpInvId]);
    const rzpStockCommitted = Number(rzpStock.rows[0]?.quantity) === 59 && Number(rzpStock.rows[0]?.reserved_quantity) === 0;

    // 16e: Replay protection (attempting to verify again with different payment ID rejected)
    let replayStatus = null;
    let replayJson = null;
    const replayReq = {
      body: {
        order_id: rzpOrderId,
        razorpay_order_id: expectedRzpOrderId,
        razorpay_payment_id: 'pay_mock_another_id_99999',
        razorpay_signature: 'test_sig'
      },
      user: { id: 4, role: 'customer' }
    };
    const replayRes = {
      status: (code) => { replayStatus = code; return replayRes; },
      json: (data) => { replayJson = data; }
    };
    await paymentController.verifyPayment(replayReq, replayRes, (e) => {});
    const replayPassed = replayStatus === 400 && replayJson?.message?.includes('Replay rejected');

    const test16Passed = sigCheckPassed && mismatchPassed && unauthPassed && legitPassed && rzpStockCommitted && replayPassed;
    logTest('Test 16: Razorpay Payment Verification Security', test16Passed,
      `Invalid Sig: ${sigStatus}, Mismatch: ${mismatchStatus}, Imposter: ${unauthStatus}, Legit: ${legitStatus}, Stock: ${rzpStockCommitted}, Replay: ${replayStatus}`);
  } catch (err) {
    logTest('Test 16: Razorpay Payment Verification Security', false, err.message);
  } finally {
    if (rzpOrderId) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [rzpOrderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [rzpOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [rzpOrderId]);
    }
    if (rzpInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [rzpInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [rzpInvId]);
    }
  }

  // Test 17: Partner Onboarding Approval Workflow
  console.log('\n--- Test 17: Partner Onboarding Approval Workflow ---');
  let testPartnerId = null;
  try {
    const pInsert = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('New Partner Applicant', 'partner-test-${Date.now()}@example.com', 'hash', 'print_provider', 'pending')
       RETURNING id, status`
    );
    testPartnerId = pInsert.rows[0].id;
    const initialPending = pInsert.rows[0].status === 'pending';

    // 17a: Portal Admin approves partner
    let actStatus = null;
    let actJson = null;
    const actReq = {
      params: { id: testPartnerId },
      body: { status: 'active' },
      user: { id: 1, role: 'portal_admin' }
    };
    const actRes = {
      status: (code) => { actStatus = code; return actRes; },
      json: (data) => { actJson = data; }
    };
    await portalController.updateProviderStatus(actReq, actRes, (e) => { if (e) throw e; });
    const dbActive = await pool.query('SELECT status FROM users WHERE id = $1', [testPartnerId]);
    const isNowActive = (actJson?.status === 'active' || actJson?.ok === true) && dbActive.rows[0]?.status === 'active';

    // 17b: Portal Admin rejects partner
    let rejStatus = null;
    let rejJson = null;
    const rejReq = {
      params: { id: testPartnerId },
      body: { status: 'rejected' },
      user: { id: 1, role: 'portal_admin' }
    };
    const rejRes = {
      status: (code) => { rejStatus = code; return rejRes; },
      json: (data) => { rejJson = data; }
    };
    await portalController.updateProviderStatus(rejReq, rejRes, (e) => { if (e) throw e; });
    const dbRejected = await pool.query('SELECT status FROM users WHERE id = $1', [testPartnerId]);
    const isNowRejected = (rejJson?.status === 'rejected' || rejJson?.ok === true) && dbRejected.rows[0]?.status === 'rejected';

    const test17Passed = initialPending && isNowActive && isNowRejected;
    logTest('Test 17: Partner Onboarding Approval Workflow', test17Passed,
      `Pending -> Active: ${isNowActive} -> Rejected: ${isNowRejected}`);
  } catch (err) {
    logTest('Test 17: Partner Onboarding Approval Workflow', false, err.message);
  } finally {
    if (testPartnerId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testPartnerId]);
    }
  }

  // Test 18: Manual Payment Role Permission Guard (requirePermission)
  console.log('\n--- Test 18: Manual Payment Permission & Role Guard ---');
  try {
    let customerBlocked = false;
    let designerBlocked = false;
    let providerBlocked = false;
    let adminAllowed = false;
    let portalAdminAllowed = false;

    const mockRes = (onBlocked) => ({
      status: (code) => {
        if (code === 403) onBlocked();
        return { json: () => {} };
      }
    });

    // Customer calling
    requirePermission('payments.confirm_manual')(
      { user: { id: 101, role: 'customer' } },
      mockRes(() => { customerBlocked = true; }),
      () => {}
    );

    // Designer calling
    requirePermission('payments.confirm_manual')(
      { user: { id: 102, role: 'designer' } },
      mockRes(() => { designerBlocked = true; }),
      () => {}
    );

    // Print Provider calling
    requirePermission('payments.confirm_manual')(
      { user: { id: 103, role: 'print_provider' } },
      mockRes(() => { providerBlocked = true; }),
      () => {}
    );

    // Admin calling
    requirePermission('payments.confirm_manual')(
      { user: { id: 1, role: 'admin' } },
      mockRes(() => {}),
      () => { adminAllowed = true; }
    );

    // Portal Admin calling
    requirePermission('payments.confirm_manual')(
      { user: { id: 2, role: 'portal_admin' } },
      mockRes(() => {}),
      () => { portalAdminAllowed = true; }
    );

    const test18Passed = customerBlocked && designerBlocked && providerBlocked && adminAllowed && portalAdminAllowed;
    logTest('Test 18: Manual Payment Role Permissions', test18Passed,
      `Customer Blocked: ${customerBlocked}, Designer Blocked: ${designerBlocked}, Provider Blocked: ${providerBlocked}, Admin Allowed: ${adminAllowed}, Portal Admin Allowed: ${portalAdminAllowed}`);
  } catch (err) {
    logTest('Test 18: Manual Payment Role Permissions', false, err.message);
  }

  // Test 19: Razorpay Subunit (Paise) Precision & Tax/Shipping Validation for ₹799 Order
  console.log('\n--- Test 19: Razorpay Subunit (Paise) Precision for ₹799 Order ---');
  let paiseInvId = null;
  let paiseOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 20, 0, 799.00, 'hoodie-paise-test', 3
       ) RETURNING id`
    );
    paiseInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: paiseInvId,
      quantity: 1,
      paymentAttemptId: 'paise_hold_' + Date.now()
    });

    const expectedRzpId = `order_paise_${Date.now()}`;
    const testOrder = await customerOrderModel.createOrder({
      customerId: 4,
      customerName: 'Paise Test Customer',
      customerEmail: 'paise@example.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'Premium Hoodie',
        price: 799.00,
        quantity: 1,
        size_label: 'L',
        sizeId: 1,
        color_id: '1',
        reservation_token: resHold.reservation_token
      }],
      paymentStatus: 'pending',
      razorpayOrderId: expectedRzpId,
      shippingCostCents: 5000,
      taxCents: 3995
    });
    paiseOrderId = testOrder.id;

    const oRow = await pool.query('SELECT subtotal_cents, shipping_cost_cents, tax_cents, total_cents FROM orders WHERE id = $1', [paiseOrderId]);
    const storedSubtotal = Number(oRow.rows[0].subtotal_cents);
    const storedShipping = Number(oRow.rows[0].shipping_cost_cents);
    const storedTax = Number(oRow.rows[0].tax_cents);
    const storedTotal = Number(oRow.rows[0].total_cents);

    const mathCorrect = storedSubtotal === 79900 && storedTax === 3995 && storedTotal === (storedSubtotal + storedShipping + storedTax);

    // 19a: Mismatched amount rejected by gateway verification
    let badAmountStatus = null;
    let badAmountJson = null;
    const badAmtReq = {
      body: {
        order_id: paiseOrderId,
        razorpay_order_id: expectedRzpId,
        razorpay_payment_id: 'pay_mock_bad_amt',
        razorpay_signature: 'test_sig'
      },
      user: { id: 4, role: 'customer' }
    };
    const originalVerifyDetails = paymentService.verifyPaymentDetails;
    paymentService.verifyPaymentDetails = async () => ({ valid: false, reason: `Mismatched amount (gateway: 79900, expected: ${storedTotal})` });
    await paymentController.verifyPayment(badAmtReq, {
      status: (c) => { badAmountStatus = c; return { json: (j) => { badAmountJson = j; } }; },
      json: () => {}
    }, () => {});
    paymentService.verifyPaymentDetails = originalVerifyDetails;

    const badAmtRejected = badAmountStatus === 400 && badAmountJson?.message?.includes('Mismatched amount');

    // 19b: Exact match with full 88,895 paise verifies successfully
    let goodStatus = null;
    let goodJson = null;
    const goodAmtReq = {
      body: {
        order_id: paiseOrderId,
        razorpay_order_id: expectedRzpId,
        razorpay_payment_id: 'pay_mock_paise_exact_' + Date.now(),
        razorpay_signature: 'test_sig'
      },
      user: { id: 4, role: 'customer' }
    };
    await paymentController.verifyPayment(goodAmtReq, {
      status: (c) => { goodStatus = c; return { json: (j) => { goodJson = j; } }; },
      json: (j) => { goodStatus = 200; goodJson = j; }
    }, (e) => { if (e) throw e; });

    const goodVerified = goodStatus === 200 && goodJson?.order?.payment_status === 'paid';

    const test19Passed = mathCorrect && badAmtRejected && goodVerified;
    logTest('Test 19: Razorpay Subunit (Paise) Precision', test19Passed,
      `Stored: Subtotal=${storedSubtotal}, Ship=${storedShipping}, Tax=${storedTax}, Total=${storedTotal} paise. Mismatch Rejected: ${badAmtRejected}, Exact Paise Verified: ${goodVerified}`);
  } catch (err) {
    logTest('Test 19: Razorpay Subunit (Paise) Precision', false, err.message);
  } finally {
    if (paiseOrderId) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [paiseOrderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [paiseOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [paiseOrderId]);
    }
    if (paiseInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [paiseInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [paiseInvId]);
    }
  }

  // Test 20: Concurrent Payment Confirmation Race (Row-Level Locking)
  console.log('\n--- Test 20: Concurrent Payment Race (Gateway vs Manual Confirmation) ---');
  let raceInvId = null;
  let raceOrderId = null;
  try {
    const invRes = await pool.query(
      `INSERT INTO cloth_inventory (
         color_id, size_id, quantity, reserved_quantity, price, product, owner_id
       ) VALUES (
         1, 1, 50, 0, 100.00, 'race-payment-tee', 3
       ) RETURNING id`
    );
    raceInvId = invRes.rows[0].id;

    const resHold = await reservationSvc.createReservation({
      inventoryId: raceInvId,
      quantity: 1,
      paymentAttemptId: 'race_hold_' + Date.now()
    });

    const raceOrder = await customerOrderModel.createOrder({
      customerId: 4,
      customerName: 'Race Customer',
      customerEmail: 'race@example.com',
      designerId: 4,
      providerId: 3,
      items: [{
        product_id: 1,
        title: 'Race Tee',
        price: 100,
        quantity: 1,
        size_label: 'M',
        sizeId: 1,
        color_id: '1',
        reservation_token: resHold.reservation_token
      }],
      paymentStatus: 'pending'
    });
    raceOrderId = raceOrder.id;

    // Concurrently trigger both confirmation paths for the exact same order
    const [rzpResult, manualResult] = await Promise.allSettled([
      customerOrderModel.confirmOrderPayment(raceOrderId, {
        paymentMethod: 'razorpay',
        razorpayPaymentId: 'pay_race_concurrent_' + Date.now(),
        razorpaySignature: 'race_sig'
      }),
      customerOrderModel.confirmManualPayment(raceOrderId, {
        paymentMethod: 'manual_bank_transfer',
        transactionReference: 'RACE-UTR-' + Date.now(),
        confirmationReason: 'Simultaneous manual admin confirmation',
        adminId: 1,
        adminName: 'Admin Race',
        adminRole: 'admin'
      })
    ]);

    const oneFulfilled = (rzpResult.status === 'fulfilled' && manualResult.status === 'rejected') ||
                         (manualResult.status === 'fulfilled' && rzpResult.status === 'rejected');
    const rejectedReason = rzpResult.status === 'rejected' ? rzpResult.reason?.message : manualResult.reason?.message;

    const pRows = await pool.query('SELECT id, gateway, payment_method FROM payments WHERE order_id = $1', [raceOrderId]);
    const singlePayment = pRows.rows.length === 1;

    const invRows = await pool.query('SELECT quantity, reserved_quantity FROM cloth_inventory WHERE id = $1', [raceInvId]);
    const stockDeductedOnce = Number(invRows.rows[0].quantity) === 49 && Number(invRows.rows[0].reserved_quantity) === 0;

    const test20Passed = oneFulfilled && singlePayment && stockDeductedOnce;
    logTest('Test 20: Concurrent Payment Race Protection', test20Passed,
      `1 Succeeded, 1 Rejected ("${rejectedReason}"). Payments recorded: ${pRows.rows.length}, Physical stock: ${invRows.rows[0].quantity} (deducted once)`);
  } catch (err) {
    logTest('Test 20: Concurrent Payment Race Protection', false, err.message);
  } finally {
    if (raceOrderId) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [raceOrderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [raceOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [raceOrderId]);
    }
    if (raceInvId) {
      await pool.query('DELETE FROM inventory_reservations WHERE inventory_id = $1', [raceInvId]);
      await pool.query('DELETE FROM cloth_inventory WHERE id = $1', [raceInvId]);
    }
  }

  // Test 21: Duplicate Gateway Transaction Reference Guard
  console.log('\n--- Test 21: Duplicate Gateway Payment Reference Guard ---');
  let dupRefOrderId1 = null;
  let dupRefOrderId2 = null;
  try {
    const sharedTxId = 'pay_shared_unique_ref_' + Date.now();

    const order1 = await customerOrderModel.createOrder({
      customerId: 4,
      customerName: 'Customer One',
      customerEmail: 'c1@example.com',
      designerId: 4,
      providerId: 3,
      items: [{ product_id: 1, title: 'Item 1', price: 10, quantity: 1, size_label: 'M', color_id: '1' }],
      paymentStatus: 'pending'
    });
    dupRefOrderId1 = order1.id;

    await customerOrderModel.confirmOrderPayment(dupRefOrderId1, {
      paymentMethod: 'razorpay',
      razorpayPaymentId: sharedTxId
    });

    const order2 = await customerOrderModel.createOrder({
      customerId: 4,
      customerName: 'Customer Two',
      customerEmail: 'c2@example.com',
      designerId: 4,
      providerId: 3,
      items: [{ product_id: 1, title: 'Item 2', price: 10, quantity: 1, size_label: 'M', color_id: '1' }],
      paymentStatus: 'pending'
    });
    dupRefOrderId2 = order2.id;

    let dupError = null;
    try {
      await customerOrderModel.confirmOrderPayment(dupRefOrderId2, {
        paymentMethod: 'razorpay',
        razorpayPaymentId: sharedTxId
      });
    } catch (e) {
      dupError = e;
    }

    const test21Passed = dupError && dupError.message.includes('already been credited to Order');
    logTest('Test 21: Duplicate Payment Reference Guard', test21Passed,
      `Rejected reuse of ${sharedTxId}: "${dupError?.message}"`);
  } catch (err) {
    logTest('Test 21: Duplicate Payment Reference Guard', false, err.message);
  } finally {
    if (dupRefOrderId1) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [dupRefOrderId1]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [dupRefOrderId1]);
      await pool.query('DELETE FROM orders WHERE id = $1', [dupRefOrderId1]);
    }
    if (dupRefOrderId2) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [dupRefOrderId2]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [dupRefOrderId2]);
      await pool.query('DELETE FROM orders WHERE id = $1', [dupRefOrderId2]);
    }
  }

  // Summary
  console.log('\n================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`OVERALL STATUS: ${allPassed ? '✓ 100% ALL REGRESSION TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  // Save report to scratch/regression_report.json
  const currentDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const rootDir = path.resolve(currentDir, '../..');
  const scratchDir = path.join(rootDir, 'scratch');
  await fs.mkdir(scratchDir, { recursive: true });
  const reportPath = path.join(scratchDir, 'phase1_regression_report.json');
  await fs.writeFile(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), allPassed, results }, null, 2));
  console.log(`Saved regression report to ${reportPath}`);

  process.exit(allPassed ? 0 : 1);
}

runRegressionSuite().catch(e => {
  console.error('Test harness error:', e);
  process.exit(1);
});
