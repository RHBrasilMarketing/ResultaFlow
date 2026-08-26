CREATE TABLE IF NOT EXISTS public.synced_campaign_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'meta',
  synced_at timestamptz NOT NULL DEFAULT now(),
  totals jsonb,
  campaign_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.synced_campaign_cache TO authenticated;
GRANT ALL ON public.synced_campaign_cache TO service_role;

ALTER TABLE public.synced_campaign_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own cached campaigns"
  ON public.synced_campaign_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own cached campaigns"
  ON public.synced_campaign_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own cached campaigns"
  ON public.synced_campaign_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own cached campaigns"
  ON public.synced_campaign_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_synced_campaign_cache_updated_at
  BEFORE UPDATE ON public.synced_campaign_cache
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
