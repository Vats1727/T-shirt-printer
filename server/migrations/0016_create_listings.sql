-- Migration: create listings for supplier-published products
-- Creates a minimal listings table and a listing_versions table to store design/version metadata

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  design_key TEXT,
  visibility TEXT DEFAULT 'public',
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_versions (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  version_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_supplier ON listings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_listing_versions_listing ON listing_versions(listing_id);
