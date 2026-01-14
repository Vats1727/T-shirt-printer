-- Add template_color to designs so we can persist chosen T-shirt template color
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS template_color text NOT NULL DEFAULT '#ffffff';
