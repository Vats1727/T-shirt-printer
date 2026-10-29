import financialSettingsModel from '../server/src/models/financialSettings.model.js';
import * as customerOrderModel from '../server/src/models/customerOrder.model.js';
import { pool } from '../server/src/config/database.js';

async function main() {
  console.log('--- 1. Testing Financial Settings Model ---');
  // Set settings to: Shipping 75, Free threshold 600, Platform fee 10%, Designer margin 30%, Provider margin 60%
  const updated = await financialSettingsModel.updateFinancialSettings({
    standard_shipping_charge: 75.0,
    free_shipping_threshold: 600.0,
    shipping_enabled: true,
    platform_fee_percent: 10.0,
    platform_fixed_fee: 5.0,
    designer_margin_percent: 30.0,
    min_designer_margin_percent: 10.0,
    provider_margin_percent: 60.0,
    min_provider_margin_percent: 50.0,
    tax_percent: 0.0,
    notes: 'E2E Test Configuration'
  }, 6);

  console.log('Updated Settings:', {
    shipping: updated.standard_shipping_charge,
    free_threshold: updated.free_shipping_threshold,
    platform_fee: updated.platform_fee_percent,
    platform_fixed: updated.platform_fixed_fee,
    designer_margin: updated.designer_margin_percent,
    provider_margin: updated.provider_margin_percent
  });

  console.log('--- 2. Testing Order Creation With Order Under Threshold (₹400) ---');
  // Order subtotal = ₹400 (< ₹600 threshold) => shipping should be ₹75
  // Platform fee = 10% of 400 + ₹5 fixed = ₹40 + ₹5 = ₹45
  // Provider = 60% of 400 = ₹240
  // Designer = 400 - 240 - 45 = ₹115
  // Total = 400 + 75 = ₹475
  const order1 = await customerOrderModel.createOrder({
    customerId: 16,
    customerName: 'Test Customer',
    customerEmail: 'customerone@gmail.com',
    customerPhone: '9999999999',
    designerId: 14,
    providerId: 15,
    items: [
      {
        listing_id: 10,
        title: "Men's Shirt",
        price: 400.00,
        quantity: 1,
        color_hex: '#ad259a',
        size_label: 'L'
      }
    ],
    shippingAddress: { city: 'Rajkot', state: 'Gujarat' },
    paymentMethod: 'razorpay'
  });

  console.log('Order 1 (< Threshold) Results:');
  console.log('Order Number:', order1.order_number);
  console.log('Subtotal:', order1.subtotal);
  console.log('Shipping Cost:', order1.shipping_cost, 'Expected: 75');
  console.log('Total:', order1.total, 'Expected: 475');
  console.log('Platform Fee:', order1.platform_fee, 'Expected: 45');
  console.log('Provider Earnings:', order1.provider_earnings, 'Expected: 240');
  console.log('Designer Earnings:', order1.designer_earnings, 'Expected: 115');

  if (order1.shipping_cost === 75 && order1.total === 475 && order1.platform_fee === 45 && order1.provider_earnings === 240 && order1.designer_earnings === 115) {
    console.log('>>> ORDER 1 FINANCIAL RULES VERIFIED! <<<');
  } else {
    throw new Error('Order 1 financial calculation mismatch!');
  }

  console.log('--- 3. Testing Order Creation Over Threshold (₹1000) ---');
  // Order subtotal = ₹1000 (> ₹600 threshold) => shipping should be ₹0 (FREE)
  // Platform fee = 10% of 1000 + ₹5 fixed = ₹100 + ₹5 = ₹105
  // Provider = 60% of 1000 = ₹600
  // Designer = 1000 - 600 - 105 = ₹295
  // Total = 1000 + 0 = ₹1000
  const order2 = await customerOrderModel.createOrder({
    customerId: 16,
    customerName: 'Test Customer',
    customerEmail: 'customerone@gmail.com',
    customerPhone: '9999999999',
    designerId: 14,
    providerId: 15,
    items: [
      {
        listing_id: 10,
        title: "Men's Shirt",
        price: 1000.00,
        quantity: 1,
        color_hex: '#ad259a',
        size_label: 'XL'
      }
    ],
    shippingAddress: { city: 'Rajkot', state: 'Gujarat' },
    paymentMethod: 'razorpay'
  });

  console.log('Order 2 (> Threshold) Results:');
  console.log('Order Number:', order2.order_number);
  console.log('Subtotal:', order2.subtotal);
  console.log('Shipping Cost:', order2.shipping_cost, 'Expected: 0');
  console.log('Total:', order2.total, 'Expected: 1000');
  console.log('Platform Fee:', order2.platform_fee, 'Expected: 105');
  console.log('Provider Earnings:', order2.provider_earnings, 'Expected: 600');
  console.log('Designer Earnings:', order2.designer_earnings, 'Expected: 295');

  if (order2.shipping_cost === 0 && order2.total === 1000 && order2.platform_fee === 105 && order2.provider_earnings === 600 && order2.designer_earnings === 295) {
    console.log('>>> ORDER 2 FINANCIAL RULES VERIFIED! <<<');
  } else {
    throw new Error('Order 2 financial calculation mismatch!');
  }

  // Restore clean default settings: 50 Shipping, 500 Threshold, 5% Platform, 35% Designer, 60% Provider
  await financialSettingsModel.updateFinancialSettings({
    standard_shipping_charge: 50.0,
    free_shipping_threshold: 500.0,
    shipping_enabled: true,
    platform_fee_percent: 5.0,
    platform_fixed_fee: 0.0,
    designer_margin_percent: 35.0,
    min_designer_margin_percent: 10.0,
    provider_margin_percent: 60.0,
    min_provider_margin_percent: 50.0,
    tax_percent: 0.0,
    notes: 'Default Platform Financial Governance Rules'
  }, 6);
  console.log('Clean defaults restored.');

  // Clean test orders from database
  await pool.query('DELETE FROM order_items WHERE order_id IN ($1, $2)', [order1.id, order2.id]);
  await pool.query('DELETE FROM orders WHERE id IN ($1, $2)', [order1.id, order2.id]);
  console.log('Test orders cleaned.');

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});

