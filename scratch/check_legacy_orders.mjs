import * as orderModel from '../server/src/models/order.model.js';

async function main() {
  const legOrders = await orderModel.listOrdersForAdmin(15);
  console.log('Legacy orders for provider 15:', JSON.stringify(legOrders, null, 2));
  process.exit(0);
}
main().catch(console.error);

