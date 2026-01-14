-- Add template column to store which template image to use (e.g., 'tshirt' or 'hoodie')
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'tshirt';

-- If you need to backfill existing rows or change a specific record, example:
-- UPDATE designs SET template = 'tshirt' WHERE id = 1;
