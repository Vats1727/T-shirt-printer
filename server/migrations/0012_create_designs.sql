-- Migration: 0012_create_designs.sql
-- Purpose: store full persistent representation of user-created designs and their assets (non-conflicting table names)

-- Designs table (extended)
CREATE TABLE IF NOT EXISTS designs_full (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  name text,
  slug text UNIQUE,
  side text NOT NULL CHECK (side IN ('front','back')) DEFAULT 'front',

  -- Core visual fields
  slogan text,
  color text, -- primary color (hex or CSS color)
  template text, -- template key/name
  template_color text, -- color applied to template
  template_image_url text, -- optional admin full-shirt image

  -- Primary user image (if any)
  image_url text,
  image_metadata jsonb, -- { filename, mime, width, height, size }
  image_scale integer DEFAULT 100,
  image_rotation integer DEFAULT 0,
  image_pos_x integer DEFAULT 150,
  image_pos_y integer DEFAULT 150,

  -- Text properties
  text_size integer DEFAULT 24,
  text_rotation integer DEFAULT 0,
  text_pos_x integer DEFAULT 150,
  text_pos_y integer DEFAULT 135,

  -- Tinting / rendering options
  image_tint_color text,
  tint_image boolean NOT NULL DEFAULT false,
  force_template_fill boolean NOT NULL DEFAULT false,

  -- Optional extras
  background_image_url text,
  width integer NOT NULL DEFAULT 400,
  height integer NOT NULL DEFAULT 400,

  -- Structured fields for extensibility
  layers jsonb,        -- array of layer objects { type: 'text'|'image', ... }
  thumbnails jsonb,    -- { small: url, medium: url, large: url }
  rendered_url text,   -- URL of server-rendered PNG/SVG preview
  metadata jsonb,      -- arbitrary extra metadata (product-specific flags, license info)

  -- Business / admin fields
  price_cents integer,
  currency text DEFAULT 'USD',
  is_public boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  revision_of integer REFERENCES designs_full(id) ON DELETE SET NULL,

  -- Integrity / auditing
  hash text, -- optional checksum of canonicalized design JSON
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_designs_full_user_id ON designs_full (user_id);
CREATE INDEX IF NOT EXISTS idx_designs_full_created_at ON designs_full (created_at);
CREATE INDEX IF NOT EXISTS idx_designs_full_hash ON designs_full (hash);
CREATE INDEX IF NOT EXISTS idx_designs_full_revision_of ON designs_full (revision_of);

-- Assets table: store multiple uploaded/derived files per design
CREATE TABLE IF NOT EXISTS design_assets (
  id serial PRIMARY KEY,
  design_id integer NOT NULL REFERENCES designs_full(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('user_image','background','template','thumbnail','rendered','other')),
  url text NOT NULL,
  filename text,
  mime text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_assets_design_id ON design_assets (design_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_designs_full_updated_at ON designs_full;
CREATE TRIGGER trg_designs_full_updated_at
BEFORE UPDATE ON designs_full
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
