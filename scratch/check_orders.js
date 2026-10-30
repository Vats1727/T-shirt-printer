import { pool } from '../server/src/config/database.js';
import * as orderController from '../server/src/controllers/order.controller.js';

async function check() {
  const users = await pool.query("SELECT id, email, role FROM users WHERE role = 'print_provider' OR role = 'admin'");
  console.log('Providers:', users.rows);
  const orders = await pool.query("SELECT id, order_number, status, payment_status, provider_id, customer_id FROM orders");
  console.log('Orders:', orders.rows);
  process.exit(0);
}
check();

