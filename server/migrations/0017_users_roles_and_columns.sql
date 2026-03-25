-- Migration to update users table with new roles and required columns
-- Adds missing columns and updates the role check constraint

-- 1. Add missing columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS associated_provider_id INTEGER;

-- 2. Update the role check constraint
-- First drop the old one (naming convention is usually table_column_check or explicitly named in 0004)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'supplier', 'portal_admin', 'print_provider', 'designer'));
