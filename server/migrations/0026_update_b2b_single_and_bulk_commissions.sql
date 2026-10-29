-- Migration: 0026_update_b2b_single_and_bulk_commissions.sql
-- Replaces multi-tier volume discount structure with Single vs Bulk Commission structure
-- Rule:
-- When Designer buys 1 product: Single (Sample) Commission applies (single_platform_fee_percent + single_provider_margin_percent = 100%)
-- When Designer buys > 1 product (2+ units): Bulk Commission applies (bulk_platform_fee_percent + bulk_provider_margin_percent = 100%)

ALTER TABLE platform_b2b_financial_settings
ADD COLUMN IF NOT EXISTS single_platform_fee_percent NUMERIC(5,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS single_provider_margin_percent NUMERIC(5,2) DEFAULT 90.00,
ADD COLUMN IF NOT EXISTS bulk_platform_fee_percent NUMERIC(5,2) DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS bulk_provider_margin_percent NUMERIC(5,2) DEFAULT 92.00,
ADD COLUMN IF NOT EXISTS bulk_min_qty INTEGER DEFAULT 2;

UPDATE platform_b2b_financial_settings
SET
  single_platform_fee_percent = COALESCE(platform_fee_percent, 10.00),
  single_provider_margin_percent = COALESCE(provider_margin_percent, 90.00),
  bulk_platform_fee_percent = 8.00,
  bulk_provider_margin_percent = 92.00,
  bulk_min_qty = 2
WHERE id = 1;

