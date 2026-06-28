-- ============================================================================
-- METROS REDONDOS — SQL pendiente LOTE 2 (correr en orden, de arriba a abajo).
-- 4 features grandes: rentabilidad por sociedad + prorrateo, conciliación
-- bancaria, pagos parciales/abonos + saldo a favor, y cierre con candado.
-- Todo idempotente. Pégalo completo en Supabase → SQL Editor → Run.
-- Cuando termine, dime "ya" y despliego + reviso a fondo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) PRORRATEO DE GASTOS COMPARTIDOS por sociedad (CIT/PH/SPH/CIMMA).
--    Un gasto compartido se reparte en varias entidades por %. Base del estado
--    de resultados por sociedad.
-- ----------------------------------------------------------------------------
create table if not exists public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  entity_id uuid not null references public.legal_entities(id),
  proportion numeric not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists expense_allocations_expense_idx on public.expense_allocations(expense_id);
alter table public.expense_allocations enable row level security;
drop policy if exists "staff manage expense allocations" on public.expense_allocations;
create policy "staff manage expense allocations" on public.expense_allocations for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

-- ----------------------------------------------------------------------------
-- 2) CIERRE CON CANDADO: al cerrar un mes, se bloquean nuevas escrituras de
--    gastos/cobros de ese periodo (el dueño puede reabrir).
-- ----------------------------------------------------------------------------
create table if not exists public.period_locks (
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_month date not null,
  locked_at timestamptz not null default now(),
  locked_by uuid,
  primary key (org_id, period_month)
);
alter table public.period_locks enable row level security;
drop policy if exists "staff manage period locks" on public.period_locks;
create policy "staff manage period locks" on public.period_locks for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

-- ----------------------------------------------------------------------------
-- 3) CONCILIACIÓN BANCARIA: movimientos del estado de cuenta (importados de CSV)
--    para casarlos contra los cobros registrados.
-- ----------------------------------------------------------------------------
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  fecha date,
  monto numeric not null,
  referencia text,
  concepto text,
  matched_payment_id uuid references public.payments(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists bank_tx_org_idx on public.bank_transactions(org_id) where deleted_at is null;
alter table public.bank_transactions enable row level security;
drop policy if exists "staff manage bank tx" on public.bank_transactions;
create policy "staff manage bank tx" on public.bank_transactions for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

-- ----------------------------------------------------------------------------
-- 4) PAGOS PARCIALES / ABONOS: cada pago registrado es un renglón; el monto
--    pagado del mes = suma de sus abonos (antes el 2º abono pisaba al 1º).
-- ----------------------------------------------------------------------------
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  monto numeric not null,
  fecha date,
  method text,
  reference text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists payment_alloc_payment_idx on public.payment_allocations(payment_id);
alter table public.payment_allocations enable row level security;
drop policy if exists "staff manage payment allocations" on public.payment_allocations;
create policy "staff manage payment allocations" on public.payment_allocations for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

-- Backfill: convierte el amount_paid existente en un abono inicial (idempotente:
-- no duplica si ya hay abonos para ese cobro).
insert into public.payment_allocations (org_id, payment_id, monto, fecha, method, reference, created_by)
select org_id, id, amount_paid, coalesce(paid_date, created_at::date), method::text, reference, confirmed_by
from public.payments p
where amount_paid > 0 and deleted_at is null
  and not exists (select 1 from public.payment_allocations a where a.payment_id = p.id);
