import { pool } from '../config/database.js';

let cachedSettings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10000; // 10-second cache

const DEFAULT_B2B_SETTINGS = {
  single_platform_fee_percent: 10.00,
  single_provider_margin_percent: 90.00,
  bulk_platform_fee_percent: 8.00,
  bulk_provider_margin_percent: 92.00,
  bulk_min_qty: 2, // More than 1 product = 2 or more
  platform_fee_percent: 10.00,
  provider_margin_percent: 90.00,
  standard_shipping_charge: 120.00,
  free_shipping_threshold: 2500.00,
  shipping_enabled: true,
  tax_percent: 5.00,
  gst_enabled: true,
  notes: 'Global B2B wholesale rules configured by Portal Superadmin'
};

function formatRow(r) {
  if (!r) return { ...DEFAULT_B2B_SETTINGS };

  const singlePlatform = Number(r.single_platform_fee_percent ?? r.platform_fee_percent ?? 10.00);
  const singleProvider = Number(r.single_provider_margin_percent ?? r.provider_margin_percent ?? 90.00);
  const bulkPlatform = Number(r.bulk_platform_fee_percent ?? 8.00);
  const bulkProvider = Number(r.bulk_provider_margin_percent ?? 92.00);

  return {
    id: 1,
    // Single Product Commission (1 unit)
    single_platform_fee_percent: singlePlatform,
    single_provider_margin_percent: singleProvider,
    // Bulk Order Commission (> 1 unit / 2+ units)
    bulk_platform_fee_percent: bulkPlatform,
    bulk_provider_margin_percent: bulkProvider,
    bulk_min_qty: Number(r.bulk_min_qty ?? 2),
    // Aliases for backwards compatibility
    platform_fee_percent: singlePlatform,
    provider_margin_percent: singleProvider,
    // Logistics & Tax
    standard_shipping_charge: Number(r.standard_shipping_charge ?? 120.00),
    free_shipping_threshold: Number(r.free_shipping_threshold ?? 2500.00),
    shipping_enabled: Boolean(r.shipping_enabled ?? true),
    tax_percent: Number(r.tax_percent ?? 5.00),
    gst_enabled: Boolean(r.gst_enabled ?? true),
    notes: r.notes || '',
    updated_by: r.updated_by || null,
    updated_at: r.updated_at || new Date().toISOString()
  };
}

export async function getB2BFinancialSettings(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cachedSettings && (now - cacheTime < CACHE_TTL_MS)) {
    return cachedSettings;
  }

  if (!pool) return { ...DEFAULT_B2B_SETTINGS };

  try {
    const res = await pool.query('SELECT * FROM platform_b2b_financial_settings WHERE id = 1');
    if (res.rows.length > 0) {
      cachedSettings = formatRow(res.rows[0]);
    } else {
      const ins = await pool.query(`
        INSERT INTO platform_b2b_financial_settings (
          id, single_platform_fee_percent, single_provider_margin_percent,
          bulk_platform_fee_percent, bulk_provider_margin_percent, bulk_min_qty,
          platform_fee_percent, provider_margin_percent,
          standard_shipping_charge, free_shipping_threshold, shipping_enabled,
          tax_percent, gst_enabled,
          notes
        ) VALUES (
          1, 10.00, 90.00,
          8.00, 92.00, 2,
          10.00, 90.00,
          120.00, 2500.00, true,
          5.00, true,
          'Global B2B wholesale rules configured by Portal Superadmin'
        ) RETURNING *
      `);
      cachedSettings = formatRow(ins.rows[0]);
    }
    cacheTime = now;
    return cachedSettings;
  } catch (err) {
    console.error('getB2BFinancialSettings query error:', err.message);
    return cachedSettings || { ...DEFAULT_B2B_SETTINGS };
  }
}

export async function updateB2BFinancialSettings(data, updatedBy = null) {
  if (!pool) throw new Error('Database pool not available');

  // 1. Single Product Commission verification (Strict 100%)
  const singlePlatform = Math.min(100, Math.max(0, Number(data.single_platform_fee_percent ?? data.platform_fee_percent ?? 10.00)));
  const singleProvider = Math.min(100, Math.max(0, Number(data.single_provider_margin_percent ?? data.provider_margin_percent ?? 90.00)));
  const singleTotal = Number((singlePlatform + singleProvider).toFixed(2));

  if (Math.abs(singleTotal - 100) > 0.01) {
    const err = new Error(
      `Single Product (Sample) allocation must equal exactly 100.00%. Current sum: ${singleTotal}% (Admin: ${singlePlatform}%, Provider: ${singleProvider}%). Please adjust values so they sum to 100.00%.`
    );
    err.status = 400;
    throw err;
  }

  // 2. Bulk Wholesale Commission verification (Strict 100%)
  const bulkPlatform = Math.min(100, Math.max(0, Number(data.bulk_platform_fee_percent ?? 8.00)));
  const bulkProvider = Math.min(100, Math.max(0, Number(data.bulk_provider_margin_percent ?? 92.00)));
  const bulkTotal = Number((bulkPlatform + bulkProvider).toFixed(2));

  if (Math.abs(bulkTotal - 100) > 0.01) {
    const err = new Error(
      `Bulk Wholesale (> 1 product) allocation must equal exactly 100.00%. Current sum: ${bulkTotal}% (Admin: ${bulkPlatform}%, Provider: ${bulkProvider}%). Please adjust values so they sum to 100.00%.`
    );
    err.status = 400;
    throw err;
  }

  const shippingCharge = Math.max(0, Number(data.standard_shipping_charge ?? 120.00));
  const shippingThreshold = Math.max(0, Number(data.free_shipping_threshold ?? 2500.00));
  const shippingEnabled = Boolean(data.shipping_enabled ?? true);
  const taxPercent = Math.min(100, Math.max(0, Number(data.tax_percent ?? 5.00)));
  const gstEnabled = Boolean(data.gst_enabled ?? true);
  const notes = String(data.notes || 'Updated by Portal Superadmin');

  const query = `
    UPDATE platform_b2b_financial_settings
    SET
      single_platform_fee_percent = $1,
      single_provider_margin_percent = $2,
      bulk_platform_fee_percent = $3,
      bulk_provider_margin_percent = $4,
      bulk_min_qty = 2,
      platform_fee_percent = $1,
      provider_margin_percent = $2,
      standard_shipping_charge = $5,
      free_shipping_threshold = $6,
      shipping_enabled = $7,
      tax_percent = $8,
      gst_enabled = $9,
      notes = $10,
      updated_by = $11,
      updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;

  const values = [
    singlePlatform,
    singleProvider,
    bulkPlatform,
    bulkProvider,
    shippingCharge,
    shippingThreshold,
    shippingEnabled,
    taxPercent,
    gstEnabled,
    notes,
    updatedBy ? Number(updatedBy) : null
  ];

  const res = await pool.query(query, values);
  cachedSettings = formatRow(res.rows[0]);
  cacheTime = Date.now();
  return cachedSettings;
}

/**
 * Live quotation calculation for B2B Designer orders
 * Rule:
 * - If totalUnits <= 1: Single Product (Sample) order -> Single Commission applied
 * - If totalUnits > 1: Bulk Wholesale order -> Bulk Commission applied
 */
export async function calculateB2BQuote(items = [], settings = null) {
  const cfg = settings || (await getB2BFinancialSettings());
  
  let totalUnits = 0;
  let rawSubtotalCents = 0;

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity || 1));
    const unitPriceCents = Math.round(Number(it.unit_price_cents || 0));
    totalUnits += qty;
    rawSubtotalCents += unitPriceCents * qty;
  }

  // Single vs Bulk Commission
  const isBulk = totalUnits > 1;
  const orderType = isBulk ? 'bulk' : 'sample';
  const tierApplied = isBulk
    ? `Bulk Wholesale (${totalUnits} pcs - Bulk Commission Applied)`
    : 'Single Product / Sample (1 pc - Single Commission Applied)';

  const activePlatformFeePercent = isBulk
    ? Number(cfg.bulk_platform_fee_percent ?? 8.00)
    : Number(cfg.single_platform_fee_percent ?? cfg.platform_fee_percent ?? 10.00);

  const activeProviderMarginPercent = isBulk
    ? Number(cfg.bulk_provider_margin_percent ?? 92.00)
    : Number(cfg.single_provider_margin_percent ?? cfg.provider_margin_percent ?? 90.00);

  const discountCents = 0;
  const netSubtotalCents = rawSubtotalCents;

  // Shipping
  let shippingCostCents = 0;
  if (cfg.shipping_enabled && netSubtotalCents > 0) {
    const freeThresholdCents = Math.round(cfg.free_shipping_threshold * 100);
    if (netSubtotalCents < freeThresholdCents) {
      shippingCostCents = Math.round(cfg.standard_shipping_charge * 100);
    }
  }

  // Tax (GST)
  let taxCents = 0;
  if (cfg.gst_enabled && cfg.tax_percent > 0) {
    taxCents = Math.round((netSubtotalCents * cfg.tax_percent) / 100);
  }

  // 2-Way Revenue Allocation
  const platformCommissionCents = Math.round((netSubtotalCents * activePlatformFeePercent) / 100);
  const providerEarningsCents = Math.max(0, netSubtotalCents - platformCommissionCents);
  const totalCents = netSubtotalCents + shippingCostCents + taxCents;

  return {
    totalUnits,
    orderType,
    isBulk,
    rawSubtotalCents,
    rawSubtotal: rawSubtotalCents / 100,
    tierApplied,
    discountPct: 0,
    discountCents: 0,
    discount: 0,
    netSubtotalCents,
    netSubtotal: netSubtotalCents / 100,
    shippingCostCents,
    shippingCost: shippingCostCents / 100,
    isFreeShipping: shippingCostCents === 0,
    taxCents,
    tax: taxCents / 100,
    taxPercent: cfg.tax_percent,
    gstEnabled: cfg.gst_enabled,
    totalCents,
    total: totalCents / 100,
    b2bPlatformFeePercent: activePlatformFeePercent,
    platformCommissionCents,
    platformCommission: platformCommissionCents / 100,
    providerMarginPercent: activeProviderMarginPercent,
    providerEarningsCents,
    providerEarnings: providerEarningsCents / 100
  };
}

export default {
  getB2BFinancialSettings,
  updateB2BFinancialSettings,
  calculateB2BQuote,
  DEFAULT_B2B_SETTINGS
};
