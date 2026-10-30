-- Migration 0029: Add Industrial Print Techpack & Production Asset Columns
-- Enables industrial print operators to receive exact physical dimensions, collar offsets, print methods, and isolated print files.

ALTER TABLE b2b_designer_order_items
  ADD COLUMN IF NOT EXISTS print_file_url TEXT,
  ADD COLUMN IF NOT EXISTS print_dimensions JSONB,
  ADD COLUMN IF NOT EXISTS print_method VARCHAR(50) DEFAULT 'DTF';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS print_file_url TEXT,
  ADD COLUMN IF NOT EXISTS print_dimensions JSONB,
  ADD COLUMN IF NOT EXISTS print_method VARCHAR(50) DEFAULT 'DTF';

