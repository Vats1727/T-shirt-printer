-- 0004_create_catalog.sql
-- Creates users, colors, sizes, size_chart, cloth_inventory, orders, order_items.
-- Written for Postgres; should work with minor edits for SQLite (see notes).

BEGIN;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','supplier')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Colors (seeded with 10 default colors)
CREATE TABLE IF NOT EXISTS colors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  hex TEXT NOT NULL
);

-- Sizes
CREATE TABLE IF NOT EXISTS sizes (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL
);

-- Size chart per size
CREATE TABLE IF NOT EXISTS size_chart (
  id BIGSERIAL PRIMARY KEY,
  size_id BIGINT NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
  chest REAL NOT NULL,
  length REAL NOT NULL,
  shoulder REAL NOT NULL
);

-- Cloth inventory (per color + size)
CREATE TABLE IF NOT EXISTS cloth_inventory (
  id BIGSERIAL PRIMARY KEY,
  color_id BIGINT NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
  size_id BIGINT NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS cloth_inventory_unique_color_size ON cloth_inventory(color_id, size_id);

-- Orders and items
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  color_id BIGINT NOT NULL REFERENCES colors(id) ON DELETE SET NULL,
  size_id BIGINT NOT NULL REFERENCES sizes(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

-- Seed default sizes
INSERT INTO sizes (label) VALUES
  ('S'), ('M'), ('L'), ('XL'), ('XXL'), ('XXXL')
ON CONFLICT DO NOTHING;

-- Seed default colors (10 fixed values) — these can be managed through admin UI
INSERT INTO colors (name, hex) VALUES
  ('White', '#FFFFFF'),
  ('Black', '#000000'),
  ('Red', '#FF0000'),
  ('Blue', '#0000FF'),
  ('Green', '#00FF00'),
  ('Yellow', '#FFFF00'),
  ('Orange', '#FFA500'),
  ('Purple', '#800080'),
  ('Gray', '#808080'),
  ('Pink', '#FFC0CB')
ON CONFLICT DO NOTHING;

COMMIT;

-- Notes for SQLite:
-- - Replace BIGSERIAL with INTEGER PRIMARY KEY AUTOINCREMENT
-- - TIMESTAMP WITH TIME ZONE -> TEXT or DATETIME
-- - NUMERIC/REAL types work with SQLite but are dynamically typed
-- - If using SQLite you may want to add `PRAGMA foreign_keys = ON;` before running the script
