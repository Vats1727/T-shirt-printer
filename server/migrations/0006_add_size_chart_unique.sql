-- 0006_create_or_update_size_chart.sql
BEGIN;

-- Ensure size_chart table exists (create if missing)
CREATE TABLE IF NOT EXISTS size_chart (
  id BIGSERIAL PRIMARY KEY,
  size_id BIGINT NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
  chest REAL NOT NULL DEFAULT 0,
  length REAL NOT NULL DEFAULT 0,
  shoulder REAL NOT NULL DEFAULT 0
);

-- Ensure there is a uniqueness enforcement on size_chart.size_id (use index for broad compatibility)
-- Older Postgres versions do not support `ADD CONSTRAINT IF NOT EXISTS`, so create a unique index instead.
CREATE UNIQUE INDEX IF NOT EXISTS unique_size_chart_size_id ON size_chart(size_id);

COMMIT;