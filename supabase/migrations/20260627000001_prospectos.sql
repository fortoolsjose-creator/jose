-- Pipeline de inquilinos: prospectos con etapas, evaluación de riesgo y papeleo.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'prospect_stage') then
    create type public.prospect_stage as enum
      ('prospecto', 'evaluacion', 'aprobado', 'rechazado', 'papeleo', 'cliente');
  end if;
end $$;

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_company boolean not null default false,
  contact_phone text,
  contact_email text,
  property_id uuid references public.properties(id),
  unit_id uuid references public.units(id),
  giro text,                 -- actividad que hará en el inmueble
  impacto text,              -- en qué impacta esa actividad
  monthly_income numeric,    -- ingreso declarado
  rent_target numeric,       -- renta propuesta
  guarantee_type public.guarantee_type,
  stage public.prospect_stage not null default 'prospecto',
  contrato_ok boolean not null default false,
  pagare_ok boolean not null default false,
  garantia_ok boolean not null default false,
  acta_ok boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists prospects_org_stage_idx on public.prospects(org_id, stage) where deleted_at is null;
alter table public.prospects enable row level security;
create policy "staff manage org prospects" on public.prospects for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
create trigger prospects_updated_at before update on public.prospects
  for each row execute function public.set_updated_at();
