import { pool } from '../server/src/config/database.js';
import fs from 'fs/promises';
import path from 'path';

async function wipeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Beginning database cleanup transaction...');
    await client.query('BEGIN');

    // 1. Clear order and payment tables
    console.log('Clearing orders and payment tables...');
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM b2b_designer_order_items');
    await client.query('DELETE FROM b2b_designer_orders');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM supplier_order_lines');
    await client.query('DELETE FROM supplier_orders');

    // 2. Clear listing, design, and product catalog tables
    console.log('Clearing listings, designs, and products...');
    await client.query('DELETE FROM listing_versions');
    await client.query('DELETE FROM listings');
    await client.query('DELETE FROM design_versions');
    await client.query('DELETE FROM designs');
    await client.query('DELETE FROM product_colors');
    await client.query('DELETE FROM product_sizes');
    await client.query('DELETE FROM size_chart');
    await client.query('DELETE FROM cloth_inventory');
    await client.query('DELETE FROM stock_movements');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM products_full');
    await client.query('DELETE FROM assets');

    // 3. Remove custom colors/sizes created by non-portal users
    console.log('Clearing custom colors/sizes...');
    await client.query('DELETE FROM colors WHERE owner_id IS NOT NULL');
    await client.query('DELETE FROM sizes WHERE owner_id IS NOT NULL');

    // 4. Remove all users except portal_admin
    console.log('Removing non-portal_admin users from users table...');
    await client.query(`UPDATE users SET associated_provider_id = NULL WHERE role = 'portal_admin'`);
    await client.query(`DELETE FROM users WHERE role != 'portal_admin'`);

    // Reset sequences for clean future IDs
    const resetSequences = [
      'orders_id_seq',
      'order_items_id_seq',
      'b2b_designer_orders_id_seq',
      'b2b_designer_order_items_id_seq',
      'listings_id_seq',
      'designs_id_seq',
      'products_full_id_seq',
      'assets_id_seq',
      'payments_id_seq'
    ];

    for (const seq of resetSequences) {
      try {
        await client.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`);
      } catch (seqErr) {
        // sequence may not exist, ignore
      }
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully!\n');

    // Update server/users.json fallback file to retain only portal_admin
    try {
      const usersJsonPath = path.resolve('server/users.json');
      const raw = await fs.readFile(usersJsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      const portalOnly = parsed.filter(u => u.role === 'portal_admin');
      await fs.writeFile(usersJsonPath, JSON.stringify(portalOnly, null, 2), 'utf8');
      console.log('Updated server/users.json: kept only portal_admin user.');
    } catch (e) {
      console.warn('Could not update server/users.json:', e.message);
    }

    // Verify row counts across all tables
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n--- VERIFICATION OF ALL TABLES AFTER CLEANUP ---');
    const report = [];
    for (const row of tablesRes.rows) {
      const tbl = row.table_name;
      const countRes = await pool.query(`SELECT COUNT(*) as count FROM "${tbl}"`);
      report.push({ table: tbl, rows: Number(countRes.rows[0].count) });
    }
    console.table(report);

    const remainingUsers = await pool.query('SELECT id, name, email, role, status FROM users');
    console.log('\nRemaining Users in Database:');
    console.table(remainingUsers.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during wipe, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

wipeDatabase();

