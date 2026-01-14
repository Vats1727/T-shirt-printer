-- 0004_add_users.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supplier')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Example seed users (run these manually with psql or your DB client):
INSERT INTO users (username, role) VALUES ('admin', 'admin') ON CONFLICT DO NOTHING;
INSERT INTO users (username, role) VALUES ('supplier1', 'supplier') ON CONFLICT DO NOTHING;

-- Example: query users
-- SELECT id, username, role FROM users;
