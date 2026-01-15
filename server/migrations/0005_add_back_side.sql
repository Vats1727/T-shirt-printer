-- 0005_add_back_side.sql
-- Adds back side columns to designs table
BEGIN;

ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS back_slogan text,
  ADD COLUMN IF NOT EXISTS back_image text,
  ADD COLUMN IF NOT EXISTS back_image_scale integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS back_image_rotation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS back_image_position jsonb NOT NULL DEFAULT '{"x":150,"y":150}',
  ADD COLUMN IF NOT EXISTS back_text_size integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS back_text_rotation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS back_text_position jsonb NOT NULL DEFAULT '{"x":150,"y":135}';

COMMIT;

-- Note: For SQLite, adapt types (use JSON stored as TEXT) and alter table by creating a new table if needed.
