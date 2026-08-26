CREATE TABLE public.user_meta_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  ad_account_ids text[] NOT NULL DEFAULT '{}',
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_meta_credentials TO authenticated;
GRANT ALL ON public.user_meta_credentials TO service_role;

ALTER TABLE public.user_meta_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all meta credentials"
ON public.user_meta_credentials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_meta_credentials_updated_at
BEFORE UPDATE ON public.user_meta_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();