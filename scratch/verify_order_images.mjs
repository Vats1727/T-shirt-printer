import { pool } from "../server/src/config/database.js";
import { listOrdersForProvider, listOrdersForDesigner, getB2BOrderById } from "../server/src/models/b2bOrder.model.js";

async function verify() {
  try {
    console.log("=== Verifying B2B Order Mockup Images ===");
    
    // Check order 12
    const order12 = await getB2BOrderById(12);
    console.log(`Order 12 Items Count: ${order12.items.length}`);
    order12.items.forEach((it, idx) => {
      console.log(` Item #${idx + 1}: [ID: ${it.id}] ${it.product_name} - Size: ${it.garment_size} - Mockup: ${it.custom_mockup_url}`);
    });

    // Check listOrdersForProvider
    const providerOrders = await listOrdersForProvider(order12.provider_id);
    const pOrder = providerOrders.find(o => o.id === 12);
    console.log("\nProvider View Order 12 Items:");
    pOrder.items.forEach((it, idx) => {
      console.log(` Item #${idx + 1}: [ID: ${it.id}] ${it.product_name} - Size: ${it.garment_size} - Mockup: ${it.custom_mockup_url}`);
    });

    // Check listOrdersForDesigner
    const designerOrders = await listOrdersForDesigner(order12.designer_id);
    const dOrder = designerOrders.find(o => o.id === 12);
    console.log("\nDesigner View Order 12 Items:");
    dOrder.items.forEach((it, idx) => {
      console.log(` Item #${idx + 1}: [ID: ${it.id}] ${it.product_name} - Size: ${it.garment_size} - Mockup: ${it.custom_mockup_url}`);
    });

    console.log("\nALL VERIFICATIONS PASSED!");
  } catch (e) {
    console.error("Verification failed:", e);
  } finally {
    await pool.end();
  }
}

verify();

