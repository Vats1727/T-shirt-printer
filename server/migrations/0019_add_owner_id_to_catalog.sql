-- 0019_add_owner_id_to_catalog.sql
-- Adds owner_id column to colors, sizes, cloth_inventory, and size_chart
-- and updates unique constraints to include owner_id.

BEGIN;

-- 1. Add owner_id colors
ALTER TABLE colors ADD COLUMN IF NOT EXISTS owner_id INTEGER;

-- 2. Add owner_id to sizes
ALTER TABLE sizes ADD COLUMN IF NOT EXISTS owner_id INTEGER;

-- 3. Add owner_id to cloth_inventory
ALTER TABLE cloth_inventory ADD COLUMN IF NOT EXISTS owner_id INTEGER;

-- 4. Add owner_id to size_chart
ALTER TABLE size_chart ADD COLUMN IF NOT EXISTS owner_id INTEGER;

-- 5. Update unique index for cloth_inventory
-- Note: index name from 0007 was cloth_inventory_unique_product_color_size
DROP INDEX IF EXISTS cloth_inventory_unique_product_color_size;
CREATE UNIQUE INDEX IF NOT EXISTS cloth_inventory_unique_product_color_size_owner ON cloth_inventory(product, color_id, size_id, owner_id);

-- 6. Update unique index for size_chart
-- Note: index name from 0008 was unique_size_chart_product_size
DROP INDEX IF EXISTS unique_size_chart_product_size;
CREATE UNIQUE INDEX IF NOT EXISTS unique_size_chart_product_size_owner ON size_chart(product, size_id, owner_id);

COMMIT;
