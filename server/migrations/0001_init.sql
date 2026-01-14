-- Create designs table
CREATE TABLE IF NOT EXISTS designs (
  id serial PRIMARY KEY,
  slogan text,
  color text NOT NULL,
  text_size integer NOT NULL DEFAULT 24,
  text_rotation integer NOT NULL DEFAULT 0,
  text_position jsonb NOT NULL DEFAULT '{"x":150,"y":135}',
  image text,
  image_scale integer NOT NULL DEFAULT 100,
  image_rotation integer NOT NULL DEFAULT 0,
  image_position jsonb NOT NULL DEFAULT '{"x":150,"y":150}',
  product text NOT NULL DEFAULT 'T-shirt',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_designs_created_at ON designs (created_at);
