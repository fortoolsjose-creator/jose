-- Llave — Operación + Análisis: gastos con factura, mantenimiento preventivo,
-- cuotas de mantenimiento (apartado separado) y plusvalía (historial de valor).
-- Idempotente: seguro de re-pegar.

-- Gastos: marcar si tienen factura (deducible)
alter table public.expenses
  add column if not exists has_invoice boolean not null default false;

-- Mantenimiento: preventivo además del correctivo
do $$ begin
  create type public.maintenance_type as enum ('correctivo','preventivo');
exception when duplicate_object then null; end $$;
alter table public.maintenance_requests
  add column if not exists mtype public.maintenance_type not null default 'correctivo',
  add column if not exists scheduled_for date,
  add column if not exists plan_id uuid;

create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  title text not null,
  category public.maintenance_category not null default 'otro',
  frequency_months int not null default 1,
  next_due date not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.maintenance_plans enable row level security;
drop policy if exists "staff manage org plans" on public.maintenance_plans;
create policy "staff manage org plans" on public.maintenance_plans for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
grant select, insert, update, delete on public.maintenance_plans to authenticated;

-- Cuotas de mantenimiento (2º cargo mensual, aparte de la renta)
alter table public.leases
  add column if not exists maintenance_fee numeric(12,2) not null default 0;

create table if not exists public.maintenance_fees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_month date not null,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  paid_date date,
  method public.payment_method,
  status public.payment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (lease_id, period_month)
);
alter table public.maintenance_fees enable row level security;
drop policy if exists "staff manage org mfees" on public.maintenance_fees;
create policy "staff manage org mfees" on public.maintenance_fees for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
drop policy if exists "tenant reads own mfees" on public.maintenance_fees;
create policy "tenant reads own mfees" on public.maintenance_fees for select to authenticated
  using (lease_id in (select public.tenant_lease_ids()));
grant select, insert, update, delete on public.maintenance_fees to authenticated;

-- Plusvalía: historial de valor de cada propiedad
create table if not exists public.property_valuations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  valued_on date not null default current_date,
  market_value numeric(14,2) not null,
  source text,
  created_at timestamptz not null default now()
);
alter table public.property_valuations enable row level security;
drop policy if exists "staff manage org valuations" on public.property_valuations;
create policy "staff manage org valuations" on public.property_valuations for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
grant select, insert, update, delete on public.property_valuations to authenticated;
