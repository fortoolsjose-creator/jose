-- Nómina (procesos #19, #21, #36). Estructura lista; los datos reales (lista de
-- personal, montos y formato de acuse) los aporta la asistente — nada inventado.
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  role text,            -- limpieza, mantenimiento, oficial, administradora...
  pay_frequency text,   -- quincenal / mensual
  base_pay numeric,     -- null hasta tener el dato real
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists workers_org_id_idx on public.workers(org_id) where deleted_at is null;
alter table public.workers enable row level security;
create policy "staff manage org workers" on public.workers for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
create trigger workers_updated_at before update on public.workers
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  period_month date not null,
  amount numeric not null,
  paid_date date,
  method public.payment_method,
  acuse_path text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists payroll_payments_worker_idx on public.payroll_payments(worker_id);
alter table public.payroll_payments enable row level security;
create policy "staff manage org payroll" on public.payroll_payments for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
