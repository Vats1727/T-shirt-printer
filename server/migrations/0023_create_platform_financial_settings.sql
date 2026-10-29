-- Migration 0023: Create global platform financial settings table
BEGIN;

CREATE TABLE IF NOT EXISTS platform_financial_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  standard_shipping_charge NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  free_shipping_threshold NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  shipping_enabled BOOLEAN NOT NULL DEFAULT true,
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  platform_fixed_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  designer_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 35.00,
  min_designer_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  provider_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 60.00,
  min_provider_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  notes TEXT DEFAULT 'Global financial governance rules set by Portal Superadmin',
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

INSERT INTO platform_financial_settings (
  id, standard_shipping_charge, free_shipping_threshold, shipping_enabled,
  platform_fee_percent, platform_fixed_fee, designer_margin_percent,
  min_designer_margin_percent, provider_margin_percent, min_provider_margin_percent,
  tax_percent, notes
) VALUES (
  1, 50.00, 500.00, true,
  5.00, 0.00, 35.00,
  10.00, 60.00, 50.00,
  0.00, 'Global financial rules configured by Portal Superadmin'
) ON CONFLICT (id) DO NOTHING;

COMMIT;

