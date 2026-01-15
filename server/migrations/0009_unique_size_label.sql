-- 0009_unique_size_label.sql
BEGIN;

-- Ensure size labels are unique to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_sizes_label ON sizes(LOWER(label));

COMMIT;