-- 0005_add_user_password.sql

-- Add password column (nullable) so existing installs are unaffected. Passwords are stored as bcrypt hashes.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password TEXT;

-- Note: to set a password for existing users, either:
-- 1) Use the API (POST /api/users) to create users with passwords
-- 2) Manually update a user's password column with a bcrypt hash.
-- Example: (using psql) UPDATE users SET password = '<bcrypt-hash>' WHERE username = 'admin';

-- For convenience, you can create an initial admin using the API or insert with a precomputed bcrypt hash.
