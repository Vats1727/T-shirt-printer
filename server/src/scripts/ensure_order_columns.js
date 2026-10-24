import { pool } from '../config/database.js';

async function main() {
  if (!pool) {
    console.log('No pool, skipping');
    process.exit(0);
  }
  try {
    await pool.query('ALTER TABLE supplier_order_lines ADD COLUMN IF NOT EXISTS product_id integer');
    const res = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'supplier_order_lines'"
    );
    console.log('SUCCESS: supplier_order_lines columns:', res.rows.map((r) => r.column_name));
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

main();
