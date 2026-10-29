import { pool } from '../server/src/config/database.js';

async function main() {
  const p = await pool.query("SELECT * FROM products_full WHERE id = 30");
  console.log('Product 30:', JSON.stringify(p.rows[0], null, 2));
  process.exit(0);
}
main().catch(console.error);

