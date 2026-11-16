import crypto from 'crypto';
import { pool } from '../config/database.js';

/**
 * inventoryReservation.service.js
 * 
 * Production Concurrency-Safe Inventory Reservation Service.
 * Implements atomic stock reservation, TTL-based hold, idempotent confirmation on payment,
 * and automatic rollback/release mechanisms.
 */

/**
 * Atomically creates a stock reservation lock for a customer checkout session.
 */
export async function createReservation({
  inventoryId,
  quantity,
  paymentAttemptId = null,
  customerSessionId = null,
  ttlMinutes = 15,
  callerProviderId = null
}) {
  if (!pool) throw new Error('Database connection pool not available');
  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw new Error('Reservation quantity must be a positive integer');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Idempotency Check: If paymentAttemptId is provided, return existing active reservation
    if (paymentAttemptId) {
      const existingRes = await client.query(
        `SELECT * FROM inventory_reservations 
         WHERE payment_attempt_id = $1 AND inventory_id = $2 AND status = 'reserved' AND expires_at > NOW() 
         LIMIT 1`,
        [paymentAttemptId, inventoryId]
      );
      if (existingRes.rows.length > 0) {
        await client.query('COMMIT');
        return existingRes.rows[0];
      }
    }

    // 2. Lock the target inventory row with row-level lock (FOR UPDATE)
    const invRes = await client.query(
      `SELECT id, product, color_id, size_id, quantity, reserved_quantity, owner_id 
       FROM cloth_inventory 
       WHERE id = $1 FOR UPDATE`,
      [inventoryId]
    );

    if (invRes.rows.length === 0) {
      throw new Error(`Inventory item with ID ${inventoryId} not found`);
    }

    let invRow = invRes.rows[0];

    // Provider Isolation Check: Ensure provider cannot reserve or access another provider's stock
    if (callerProviderId !== null && invRow.owner_id !== null && Number(invRow.owner_id) !== Number(callerProviderId)) {
      const err = new Error(`Access denied: Provider #${callerProviderId} cannot access or reserve inventory belonging to Provider #${invRow.owner_id}`);
      err.statusCode = 403;
      throw err;
    }

    // 3. Eagerly release any expired reservations for this inventory item before stock checking
    const expiredRes = await client.query(
      `UPDATE inventory_reservations
       SET status = 'expired', updated_at = NOW()
       WHERE inventory_id = $1 AND status = 'reserved' AND expires_at < NOW() AND payment_attempt_id IS NULL
       RETURNING quantity`,
      [inventoryId]
    );

    if (expiredRes.rows.length > 0) {
      const totalExpiredQty = expiredRes.rows.reduce((sum, r) => sum + Number(r.quantity), 0);
      const updateInvRes = await client.query(
        `UPDATE cloth_inventory 
         SET reserved_quantity = GREATEST(0, reserved_quantity - $1) 
         WHERE id = $2 
         RETURNING quantity, reserved_quantity`,
        [totalExpiredQty, inventoryId]
      );
      invRow = { ...invRow, ...updateInvRes.rows[0] };
    }

    // 4. Check available stock invariant
    const available = Number(invRow.quantity) - Number(invRow.reserved_quantity);
    if (available < qty) {
      throw new Error(`Insufficient inventory available. Requested: ${qty}, Available: ${Math.max(0, available)}`);
    }

    // 5. Reserve quantity in cloth_inventory
    await client.query(
      `UPDATE cloth_inventory 
       SET reserved_quantity = reserved_quantity + $1 
       WHERE id = $2`,
      [qty, inventoryId]
    );

    // 6. Generate secure reservation token and persist reservation
    const token = crypto.randomUUID();
    const insertRes = await client.query(
      `INSERT INTO inventory_reservations (
         inventory_id, reservation_token, quantity, status, customer_session_id, payment_attempt_id, expires_at
       ) VALUES (
         $1, $2, $3, 'reserved', $4, $5, NOW() + ($6 || ' minutes')::INTERVAL
       ) RETURNING *`,
      [inventoryId, token, qty, customerSessionId, paymentAttemptId, String(ttlMinutes)]
    );

    await client.query('COMMIT');
    return insertRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Idempotently confirms a stock reservation when order payment succeeds.
 * Commits the reserved quantity by permanently reducing physical stock.
 */
export async function confirmReservation({ token, orderId }) {
  if (!pool) throw new Error('Database connection pool not available');
  if (!token) throw new Error('Reservation token is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock reservation row
    const resRes = await client.query(
      `SELECT * FROM inventory_reservations WHERE reservation_token = $1 FOR UPDATE`,
      [token]
    );

    if (resRes.rows.length === 0) {
      throw new Error(`Reservation with token ${token} not found`);
    }

    const reservation = resRes.rows[0];

    // Idempotent: already confirmed
    if (reservation.status === 'confirmed') {
      await client.query('COMMIT');
      return reservation;
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Cannot confirm reservation: current status is "${reservation.status}"`);
    }

    const qty = Number(reservation.quantity);
    const invId = reservation.inventory_id;

    // 2. Lock inventory row and atomically decrement both physical quantity and reserved_quantity
    await client.query(
      `SELECT id FROM cloth_inventory WHERE id = $1 FOR UPDATE`,
      [invId]
    );

    await client.query(
      `UPDATE cloth_inventory 
       SET quantity = GREATEST(0, quantity - $1),
           reserved_quantity = GREATEST(0, reserved_quantity - $1)
       WHERE id = $2`,
      [qty, invId]
    );

    // 3. Mark reservation confirmed
    const updatedRes = await client.query(
      `UPDATE inventory_reservations 
       SET status = 'confirmed', order_id = $1, updated_at = NOW() 
       WHERE reservation_token = $2 
       RETURNING *`,
      [orderId ? Number(orderId) : null, token]
    );

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Releases a reservation hold and restores available stock.
 */
export async function releaseReservation({ token }) {
  if (!pool) throw new Error('Database connection pool not available');
  if (!token) throw new Error('Reservation token is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resRes = await client.query(
      `SELECT * FROM inventory_reservations WHERE reservation_token = $1 FOR UPDATE`,
      [token]
    );

    if (resRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const reservation = resRes.rows[0];

    // Already released or expired
    if (reservation.status === 'released' || reservation.status === 'expired') {
      await client.query('COMMIT');
      return reservation;
    }

    if (reservation.status === 'confirmed') {
      throw new Error('Cannot release a reservation that has already been confirmed as an order');
    }

    const qty = Number(reservation.quantity);
    const invId = reservation.inventory_id;

    // Lock and reduce reserved_quantity
    await client.query(
      `SELECT id FROM cloth_inventory WHERE id = $1 FOR UPDATE`,
      [invId]
    );

    await client.query(
      `UPDATE cloth_inventory 
       SET reserved_quantity = GREATEST(0, reserved_quantity - $1) 
       WHERE id = $2`,
      [qty, invId]
    );

    const updatedRes = await client.query(
      `UPDATE inventory_reservations 
       SET status = 'released', updated_at = NOW() 
       WHERE reservation_token = $1 
       RETURNING *`,
      [token]
    );

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Real-time available stock inquiry for an inventory ID.
 */
export async function getAvailableStock(inventoryId, callerProviderId = null) {
  if (!pool) return { available: 0, total: 0, reserved: 0 };
  const res = await pool.query(
    `SELECT id, quantity, reserved_quantity, owner_id, GREATEST(0, quantity - reserved_quantity) as available_quantity 
     FROM cloth_inventory 
     WHERE id = $1`,
    [inventoryId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (callerProviderId !== null && row.owner_id !== null && Number(row.owner_id) !== Number(callerProviderId)) {
    const err = new Error(`Access denied: Provider #${callerProviderId} cannot inspect inventory belonging to Provider #${row.owner_id}`);
    err.statusCode = 403;
    throw err;
  }
  return {
    inventory_id: row.id,
    total: Number(row.quantity),
    reserved: Number(row.reserved_quantity),
    available: Number(row.available_quantity),
    owner_id: row.owner_id
  };
}

/**
 * Real-time available stock inquiry by garment variant specs.
 */
export async function getAvailableStockForVariant({ ownerId, product, colorId, sizeId }) {
  if (!pool) return { available: 0, total: 0, reserved: 0 };
  const res = await pool.query(
    `SELECT id, quantity, reserved_quantity, GREATEST(0, quantity - reserved_quantity) as available_quantity 
     FROM cloth_inventory 
     WHERE (owner_id = $1 OR owner_id IS NULL) 
       AND product ILIKE $2 
       AND color_id = $3 
       AND size_id = $4
     ORDER BY owner_id DESC NULLS LAST
     LIMIT 1`,
    [ownerId || null, product || '%', colorId, sizeId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    inventory_id: row.id,
    total: Number(row.quantity),
    reserved: Number(row.reserved_quantity),
    available: Number(row.available_quantity)
  };
}

/**
 * Periodically cleans up expired reservations and restores reserved quantities.
 * Adheres to invariant: Never release stock if payment attempt is in-flight.
 */
export async function cleanupExpiredReservations() {
  if (!pool) return { expiredCount: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `WITH expired_rows AS (
         UPDATE inventory_reservations
         SET status = 'expired', updated_at = NOW()
         WHERE status = 'reserved' AND expires_at < NOW() AND payment_attempt_id IS NULL
         RETURNING inventory_id, quantity
       ),
       summed AS (
         SELECT inventory_id, SUM(quantity) as released_qty
         FROM expired_rows
         GROUP BY inventory_id
       )
       UPDATE cloth_inventory ci
       SET reserved_quantity = GREATEST(0, ci.reserved_quantity - s.released_qty)
       FROM summed s
       WHERE ci.id = s.inventory_id
       RETURNING ci.id;`
    );

    await client.query('COMMIT');
    return { expiredCount: result.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default {
  createReservation,
  confirmReservation,
  releaseReservation,
  getAvailableStock,
  getAvailableStockForVariant,
  cleanupExpiredReservations
};

