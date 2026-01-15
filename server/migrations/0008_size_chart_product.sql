-- 0008_size_chart_product.sql
BEGIN;

-- Add product column to size_chart so size chart can be product-specific
ALTER TABLE size_chart ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'tshirt';

-- Add unique index to enforce (product, size_id) uniqueness for upserts
CREATE UNIQUE INDEX IF NOT EXISTS unique_size_chart_product_size ON size_chart(product, size_id);

COMMIT;