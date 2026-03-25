-- Migration to add owner_id to products_full table
ALTER TABLE products_full ADD COLUMN IF NOT EXISTS owner_id INTEGER;
