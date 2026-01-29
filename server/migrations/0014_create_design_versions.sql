-- Migration: 0014_create_design_versions.sql
-- Adds design_versions and assets tables for richer design persistence.

BEGIN;

-- table to store original uploaded assets (images, fonts, etc.)
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  filename TEXT,
  mime TEXT,
  size INTEGER,
  storage_key TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- immutable design versions referencing a design row
CREATE TABLE IF NOT EXISTS design_versions (
  id SERIAL PRIMARY KEY,
  design_id INTEGER REFERENCES designs(id) ON DELETE CASCADE,
  version_name TEXT,
  payload JSONB NOT NULL,
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  processing_state TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMIT;

-- Notes:
-- 1) Keep this migration non-destructive: it only adds new tables.
-- 2) A follow-up migration can backfill existing `designs` rows into
--    `design_versions` if a migration path is desired.