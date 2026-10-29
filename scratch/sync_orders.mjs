import pg from '../server/node_modules/pg/lib/index.js';
import dotenv from '../server/node_modules/dotenv/lib/main.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const pool = new pg.Pool({
  connectionString: 'postgres://postgres:' + encodeURIComponent(process.env.DB_PASSWORD) + '@' + process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_NAME
});

async function sync() {
  // 1. Associate designers with Print Provider One (id: 15)
  await pool.query("UPDATE users SET associated_provider_id = 15 WHERE role = 'designer'");
  console.log('Designers associated with Provider 15');

  // 2. Assign products to Print Provider One
  await pool.query("UPDATE products_full SET owner_id = 15 WHERE owner_id = 12");
  console.log('Products reassigned to Provider 15');

  // 3. Assign all orders to Print Provider One
  await pool.query("UPDATE orders SET provider_id = 15 WHERE provider_id = 12");
  console.log('Orders assigned to Provider 15');

  // 4. Update Order 4 (Soham) to confirmed & paid
  await pool.query("UPDATE orders SET status = 'confirmed', payment_status = 'paid', payment_method = 'razorpay' WHERE id = 4");
  console.log('Order 4 updated to confirmed & paid');

  const orders = await pool.query('SELECT id, order_number, customer_name, designer_id, provider_id, status, payment_status, total_cents FROM orders ORDER BY id ASC');
  console.log('Current Orders in DB:', JSON.stringify(orders.rows, null, 2));

  await pool.end();
}

sync().catch(console.error);

