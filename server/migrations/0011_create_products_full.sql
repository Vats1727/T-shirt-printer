-- 0011_create_products_full.sql
-- Create consolidated products_full table and migrate data from legacy product tables
-- Note: We do not drop legacy tables in this migration to avoid breaking other code paths; those can be removed in a follow-up after verification.

BEGIN;

-- Create consolidated products table (keep IDs stable by inserting explicit ids)
CREATE TABLE IF NOT EXISTS products_full (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  single_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  bulk_min INTEGER NOT NULL DEFAULT 100,
  bulk_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  size_chart JSONB NOT NULL DEFAULT '[]'::jsonb,
  designs JSONB NOT NULL DEFAULT '[]'::jsonb,
  inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NULL
);

-- Migrate existing products (if any). We try to preserve ids and important fields.
INSERT INTO products_full (id, name, slug, single_price, bulk_min, bulk_price, sizes, colors, size_chart, designs, inventory, created_at)
SELECT
  p.id,
  p.name,
  p.slug,
  p.single_price,
  p.bulk_min,
  p.bulk_price,
  COALESCE((SELECT jsonb_agg(ps.size_id) FROM product_sizes ps WHERE ps.product_id = p.id), '[]'::jsonb) as sizes,
  COALESCE((SELECT jsonb_agg(pc.color_id) FROM product_colors pc WHERE pc.product_id = p.id), '[]'::jsonb) as colors,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('size_id', sc.size_id, 'chest', sc.chest, 'length', sc.length, 'shoulder', sc.shoulder)) FROM size_chart sc WHERE lower(sc.product) = lower(p.slug)), '[]'::jsonb) as size_chart,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'slogan', d.slogan, 'image', d.image, 'image_scale', d.image_scale, 'image_rotation', d.image_rotation, 'image_position', d.image_position, 'color', d.color, 'template', d.template) ORDER BY d.id) FROM designs d WHERE d.product_id = p.id), '[]'::jsonb) as designs,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('color_id', ci.color_id, 'size_id', ci.size_id, 'quantity', ci.quantity, 'price', ci.price)) FROM cloth_inventory ci WHERE lower(ci.product) = lower(p.slug) OR lower(ci.product) = lower(p.name)), '[]'::jsonb) as inventory,
  p.created_at
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM products_full pf WHERE pf.id = p.id);

-- Ensure the sequence for future ids is set to a value higher than the highest id present
DO $$
DECLARE
  maxid BIGINT;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO maxid FROM products_full;
  IF maxid IS NULL THEN maxid := 0; END IF;
  -- create a sequence if it doesn't exist
  BEGIN
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS products_full_id_seq START WITH ' || (maxid + 1);
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;
  -- attach sequence to table (no SERIAL type alteration necessary) and set value
  PERFORM setval('products_full_id_seq', maxid + 1, false);
END$$;

-- Ensure future inserts get ids from the sequence by default
ALTER TABLE products_full ALTER COLUMN id SET DEFAULT nextval('products_full_id_seq');

COMMIT;
