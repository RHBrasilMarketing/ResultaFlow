ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS monthly_budget numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_budget numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_settings TO authenticated;
GRANT ALL ON public.account_settings TO service_role;
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can view account settings" ON public.account_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage account settings" ON public.account_settings FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT INSERT, UPDATE, DELETE ON public.account_settings TO authenticated;
INSERT INTO public.account_settings (total_budget)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM public.account_settings);