import { pool } from '../config/database.js';

let cachedSettings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10000; // 10-second cache

const DEFAULT_SETTINGS = {
  standard_shipping_charge: 50.00,
  free_shipping_threshold: 500.00,
  shipping_enabled: true,
  platform_fee_percent: 10.00,
  platform_fixed_fee: 0.00,
  designer_margin_percent: 35.00,
  min_designer_margin_percent: 10.00,
  provider_margin_percent: 55.00,
  min_provider_margin_percent: 50.00,
  tax_percent: 5.00,
  gst_enabled: true,
  notes: 'Global financial rules configured by Portal Superadmin'
};

function formatRow(r) {
  if (!r) return { ...DEFAULT_SETTINGS };
  return {
    id: 1,
    standard_shipping_charge: Number(r.standard_shipping_charge ?? 50.00),
    free_shipping_threshold: Number(r.free_shipping_threshold ?? 500.00),
    shipping_enabled: Boolean(r.shipping_enabled ?? true),
    platform_fee_percent: Number(r.platform_fee_percent ?? 10.00),
    platform_fixed_fee: Number(r.platform_fixed_fee ?? 0.00),
    designer_margin_percent: Number(r.designer_margin_percent ?? 35.00),
    min_designer_margin_percent: Number(r.min_designer_margin_percent ?? 10.00),
    provider_margin_percent: Number(r.provider_margin_percent ?? 55.00),
    min_provider_margin_percent: Number(r.min_provider_margin_percent ?? 50.00),
    tax_percent: Number(r.tax_percent ?? 5.00),
    gst_enabled: Boolean(r.gst_enabled ?? true),
    notes: r.notes || '',
    updated_by: r.updated_by || null,
    updated_at: r.updated_at || new Date().toISOString()
  };
}

export async function getFinancialSettings(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cachedSettings && (now - cacheTime < CACHE_TTL_MS)) {
    return cachedSettings;
  }

  if (!pool) return { ...DEFAULT_SETTINGS };

  try {
    const res = await pool.query('SELECT * FROM platform_financial_settings WHERE id = 1');
    if (res.rows.length > 0) {
      cachedSettings = formatRow(res.rows[0]);
    } else {
      // Seed row if missing
      const ins = await pool.query(`
        INSERT INTO platform_financial_settings (
          id, standard_shipping_charge, free_shipping_threshold, shipping_enabled,
          platform_fee_percent, platform_fixed_fee, designer_margin_percent,
          min_designer_margin_percent, provider_margin_percent, min_provider_margin_percent,
          tax_percent, notes
        ) VALUES (
          1, 50.00, 500.00, true,
          10.00, 0.00, 35.00,
          10.00, 55.00, 50.00,
          0.00, 'Global financial rules configured by Portal Superadmin'
        ) RETURNING *
      `);
      cachedSettings = formatRow(ins.rows[0]);
    }
    cacheTime = now;
    return cachedSettings;
  } catch (err) {
    console.error('getFinancialSettings query error:', err.message);
    return cachedSettings || { ...DEFAULT_SETTINGS };
  }
}

export async function updateFinancialSettings(data, updatedBy = null) {
  if (!pool) throw new Error('Database pool not available');

  // Sanitize and validate inputs
  const shippingCharge = Math.max(0, Number(data.standard_shipping_charge ?? 50.00));
  const shippingThreshold = Math.max(0, Number(data.free_shipping_threshold ?? 500.00));
  const shippingEnabled = Boolean(data.shipping_enabled ?? true);
  const platformFeePercent = Math.min(100, Math.max(0, Number(data.platform_fee_percent ?? 10.00)));
  const platformFixedFee = Math.max(0, Number(data.platform_fixed_fee ?? 0.00));
  const designerMarginPercent = Math.min(100, Math.max(0, Number(data.designer_margin_percent ?? 35.00)));
  const minDesignerMarginPercent = Math.min(100, Math.max(0, Number(data.min_designer_margin_percent ?? 10.00)));
  const providerMarginPercent = Math.min(100, Math.max(0, Number(data.provider_margin_percent ?? 55.00)));
  const minProviderMarginPercent = Math.min(100, Math.max(0, Number(data.min_provider_margin_percent ?? 50.00)));
  const taxPercent = Math.min(100, Math.max(0, Number(data.tax_percent ?? 5.00)));
  const gstEnabled = Boolean(data.gst_enabled ?? true);
  const notes = String(data.notes || 'Updated by Portal Superadmin');

  // Verify total margin split equals exactly 100%
  const totalSplit = Number((platformFeePercent + designerMarginPercent + providerMarginPercent).toFixed(2));
  if (Math.abs(totalSplit - 100) > 0.01) {
    const err = new Error(
      `Total percentage allocation must equal exactly 100%. Current sum: ${totalSplit}% (Platform Commission: ${platformFeePercent}%, Designer Royalty: ${designerMarginPercent}%, Print Provider: ${providerMarginPercent}%). Please adjust values to equal 100.00%.`
    );
    err.status = 400;
    throw err;
  }

  // Safely check if updatedBy exists in users
  let validUpdatedBy = null;
  if (updatedBy) {
    try {
      const uRes = await pool.query('SELECT id FROM users WHERE id = $1', [Number(updatedBy)]);
      if (uRes.rows.length > 0) validUpdatedBy = Number(updatedBy);
    } catch (e) {
      // ignore
    }
  }

  const query = `
    INSERT INTO platform_financial_settings (
      id, standard_shipping_charge, free_shipping_threshold, shipping_enabled,
      platform_fee_percent, platform_fixed_fee, designer_margin_percent,
      min_designer_margin_percent, provider_margin_percent, min_provider_margin_percent,
      tax_percent, gst_enabled, notes, updated_by, updated_at
    ) VALUES (
      1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      standard_shipping_charge = EXCLUDED.standard_shipping_charge,
      free_shipping_threshold = EXCLUDED.free_shipping_threshold,
      shipping_enabled = EXCLUDED.shipping_enabled,
      platform_fee_percent = EXCLUDED.platform_fee_percent,
      platform_fixed_fee = EXCLUDED.platform_fixed_fee,
      designer_margin_percent = EXCLUDED.designer_margin_percent,
      min_designer_margin_percent = EXCLUDED.min_designer_margin_percent,
      provider_margin_percent = EXCLUDED.provider_margin_percent,
      min_provider_margin_percent = EXCLUDED.min_provider_margin_percent,
      tax_percent = EXCLUDED.tax_percent,
      gst_enabled = EXCLUDED.gst_enabled,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    shippingCharge,
    shippingThreshold,
    shippingEnabled,
    platformFeePercent,
    platformFixedFee,
    designerMarginPercent,
    minDesignerMarginPercent,
    providerMarginPercent,
    minProviderMarginPercent,
    taxPercent,
    gstEnabled,
    notes,
    validUpdatedBy
  ];

  const res = await pool.query(query, values);
  cachedSettings = formatRow(res.rows[0]);
  cacheTime = Date.now();
  return cachedSettings;
}

export default {
  getFinancialSettings,
  updateFinancialSettings
};
