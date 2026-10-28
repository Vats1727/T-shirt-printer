-- Migration 0020: Add status column to products_full table
ALTER TABLE products_full ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
