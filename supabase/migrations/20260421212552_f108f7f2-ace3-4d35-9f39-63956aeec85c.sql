-- Tabela de parâmetros personalizados por empresa
create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique,
  ideal_cpr numeric(10,2) not null default 2.00,
  acceptable_cpr numeric(10,2) not null default 5.00,
  warning_cpr numeric(10,2) not null default 10.00,
  ideal_cpm numeric(10,2) not null default 15.00,
  ideal_frequency numeric(5,2) not null default 2.00,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid
);

alter table public.company_settings enable row level security;

create policy "Authenticated can view company settings"
on public.company_settings for select
to authenticated
using (true);

create policy "Admins can insert company settings"
on public.company_settings for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update company settings"
on public.company_settings for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete company settings"
on public.company_settings for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger company_settings_touch
before update on public.company_settings
for each row execute function public.touch_updated_at();

create index idx_company_settings_name on public.company_settings(company_name);