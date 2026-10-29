import financialSettingsModel from '../server/src/models/financialSettings.model.js';

async function main() {
  const current = await financialSettingsModel.getFinancialSettings(true);
  console.log('Current settings:', current);

  // Test updating
  const updated = await financialSettingsModel.updateFinancialSettings({
    standard_shipping_charge: 60,
    free_shipping_threshold: 499,
    platform_fee_percent: 6.0,
    designer_margin_percent: 34.0,
    provider_margin_percent: 60.0
  }, 1);
  console.log('Updated settings:', updated);

  // Revert back to 50 / 500 / 5% / 35% / 60%
  const reverted = await financialSettingsModel.updateFinancialSettings({
    standard_shipping_charge: 50.0,
    free_shipping_threshold: 500.0,
    platform_fee_percent: 5.0,
    designer_margin_percent: 35.0,
    provider_margin_percent: 60.0
  }, 1);
  console.log('Reverted settings:', reverted);

  process.exit(0);
}
main().catch(console.error);

