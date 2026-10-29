-- Migration 0027: Make color_name optional in b2b_designer_order_items
-- Supports size-only multi-size B2B purchasing where color selection is not required.

BEGIN;

ALTER TABLE b2b_designer_order_items 
  ALTER COLUMN color_name DROP NOT NULL,
  ALTER COLUMN color_name SET DEFAULT 'Standard';

COMMIT;

