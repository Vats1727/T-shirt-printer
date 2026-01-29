-- 0010_create_products.sql
-- Create products table and related product_sizes/product_colors tables
-- Also add product_id column to designs for easier joins

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  single_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  bulk_min INTEGER NOT NULL DEFAULT 100,
  bulk_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- enforce unique slug (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS unique_products_slug ON products(LOWER(slug));

-- product -> sizes relation
CREATE TABLE IF NOT EXISTS product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_product_size ON product_sizes(product_id, size_id);

-- product -> colors relation
CREATE TABLE IF NOT EXISTS product_colors (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  color_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_product_color ON product_colors(product_id, color_id);

-- Link designs to products (nullable). We add an index but avoid adding a FK constraint to keep migration simple and robust.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS product_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_designs_product_id ON designs(product_id);

-- NOTE: We intentionally do not create foreign-key constraints here to avoid migration order issues when importing existing data.
-- If you want strict foreign keys, you can add them later when all referenced tables are populated.
