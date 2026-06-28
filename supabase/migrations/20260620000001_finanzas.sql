-- Llave — Finanzas: gastos (egresos), tipo de uso (residencial/comercial),
-- valor de mercado (para cap rate), y bandera de inquilino empresa (para retención).
-- Idempotente: seguro de re-pegar.

-- Enums ---------------------------------------------------------------------
do $$ begin
  create type public.unit_use as enum ('residential', 'commercial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_category as enum (
    'mantenimiento', 'servicios', 'predial', 'nomina',
    'impuestos', 'seguro', 'administracion', 'otro'
  );
exception when duplicate_object then null; end $$;

-- New columns ---------------------------------------------------------------
alter table public.units      add column if not exists use_type public.unit_use not null default 'residential';
alter table public.properties add column if not exists market_value numeric(14,2);
alter table public.leases     add column if not exists tenant_is_company boolean not null default false;

-- Expenses (egresos) --------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  category     public.expense_category not null default 'otro',
  vendor       text,
  description  text,
  amount       numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  period_month date,
  method       public.payment_method,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists expenses_org_id_idx on public.expenses (org_id);
create index if not exists expenses_property_id_idx on public.expenses (property_id);
create index if not exists expenses_period_idx on public.expenses (period_month);
create index if not exists expenses_date_idx on public.expenses (expense_date);

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

-- RLS: staff-only, scoped to their org (same pattern as the rest) -----------
alter table public.expenses enable row level security;
drop policy if exists "staff manage org expenses" on public.expenses;
create policy "staff manage org expenses"
  on public.expenses for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

grant select, insert, update, delete on public.expenses to authenticated;
