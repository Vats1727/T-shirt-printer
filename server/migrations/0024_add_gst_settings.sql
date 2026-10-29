-- Migration 0024: Add GST fields to platform financial settings
ALTER TABLE platform_financial_settings ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN DEFAULT true;

