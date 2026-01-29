-- 0007_add_product_to_inventory.sql
BEGIN;

-- Add product column to cloth_inventory so inventory is per product (tshirt/hoodie/women_tshirt)
ALTER TABLE cloth_inventory ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'tshirt';

-- Add product column to order_items so we record product ordered
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'tshirt';

-- Replace unique index to include product, color_id, size_id
DROP INDEX IF EXISTS cloth_inventory_unique_color_size;
CREATE UNIQUE INDEX IF NOT EXISTS cloth_inventory_unique_product_color_size ON cloth_inventory(product, color_id, size_id);

COMMIT;