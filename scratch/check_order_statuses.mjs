import { pool } from '../server/src/config/database.js';
import * as customerOrderModel from '../server/src/models/customerOrder.model.js';
import * as orderModel from '../server/src/models/order.model.js';

async function main() {
  const custOrders = await customerOrderModel.listOrdersByProvider(15);
  console.log('Customer orders:');
  for (const o of custOrders) {
    console.log(`- ID: ${o.id}, Order#: ${o.order_number}, Status: "${o.status}", Items: ${o.items?.length}`);
  }

  const legOrders = await orderModel.listOrdersForAdmin(15);
  console.log('Legacy orders:');
  for (const o of legOrders) {
    console.log(`- ID: ${o.id}, Status: "${o.status}", Items: ${o.items?.length}`);
  }

  process.exit(0);
}
main().catch(console.error);

