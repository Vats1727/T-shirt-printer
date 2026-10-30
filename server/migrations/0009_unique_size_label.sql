-- 0009_unique_size_label.sql
BEGIN;

-- Remove duplicate sizes before creating unique index
DELETE FROM sizes a USING sizes b
WHERE a.id > b.id AND LOWER(a.label) = LOWER(b.label);

-- Ensure size labels are unique to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_sizes_label ON sizes(LOWER(label));

COMMIT;
