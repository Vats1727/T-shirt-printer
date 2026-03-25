-- Add updated_at to users for consistency with other tables
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill updated_at from created_at for existing rows where it's NULL
UPDATE public.users SET updated_at = created_at WHERE updated_at IS NULL;

-- Keep updated_at maintained via trigger function if present (function defined in earlier migration)
-- Create trigger if the helper function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- drop any existing trigger and recreate
    PERFORM ('DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users');
    PERFORM ('CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
  END IF;
END$$;
