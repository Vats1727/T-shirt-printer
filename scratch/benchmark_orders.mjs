import { pool } from '../server/src/config/database.js';
import * as customerOrderModel from '../server/src/models/customerOrder.model.js';
import * as orderModel from '../server/src/models/order.model.js';

async function main() {
  console.time('listOrdersByProvider');
  const custOrders = await customerOrderModel.listOrdersByProvider(15);
  console.timeEnd('listOrdersByProvider');
  console.log('Customer orders count:', custOrders.length);

  console.time('listOrdersForAdmin');
  const legOrders = await orderModel.listOrdersForAdmin(15);
  console.timeEnd('listOrdersForAdmin');
  console.log('Legacy orders count:', legOrders.length);

  process.exit(0);
}
main().catch(console.error);

