-- ============================================================================
-- METROS REDONDOS — SQL pendiente (correr en orden, de arriba a abajo).
-- Todo es idempotente (if not exists / or replace), así que puedes pegarlo
-- completo en Supabase → SQL Editor → Run, o sección por sección.
-- Generado por Claude mientras saliste. Cuando termine, dime "ya" y despliego.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) GARANTÍAS / PÓLIZAS: monto, vigencia (para alertar) y referencia del pagaré.
-- ----------------------------------------------------------------------------
alter table public.leases
  add column if not exists garantia_monto numeric,
  add column if not exists poliza_vigencia date,
  add column if not exists pagare_referencia text;

-- ----------------------------------------------------------------------------
-- 2) AVISOS / ANUNCIOS: el dueño/staff publica, el inquilino los ve en su portal.
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id),
  title text not null,
  body text,
  until date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists announcements_org_idx on public.announcements(org_id) where deleted_at is null;
alter table public.announcements enable row level security;
drop policy if exists "staff manage org announcements" on public.announcements;
create policy "staff manage org announcements" on public.announcements for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
drop policy if exists "members read org announcements" on public.announcements;
create policy "members read org announcements" on public.announcements for select to authenticated
  using (org_id = public.auth_org_id());

-- ----------------------------------------------------------------------------
-- 3) DESGLOSE FISCAL por cobro: subtotal + IVA 16% + retención ISR (estimado).
--    Se calcula al registrar el pago y se imprime en el recibo. No altera el
--    monto cobrado; es la base para cuadrar con el contador / el CFDI.
-- ----------------------------------------------------------------------------
alter table public.payments
  add column if not exists subtotal numeric,
  add column if not exists iva numeric,
  add column if not exists retencion_isr numeric,
  add column if not exists retencion_iva numeric;

-- ----------------------------------------------------------------------------
-- 4) MULTI-ENTIDAD (CIT/PH/SPH/CIMMA): catálogo de sociedades + a qué sociedad
--    pertenece cada edificio. Base para reportes por entidad. (El prorrateo de
--    gastos compartidos es una fase posterior.)
-- ----------------------------------------------------------------------------
create table if not exists public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  rfc text,
  regimen text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.legal_entities enable row level security;
drop policy if exists "staff manage legal entities" on public.legal_entities;
create policy "staff manage legal entities" on public.legal_entities for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

alter table public.properties
  add column if not exists entity_id uuid references public.legal_entities(id);

-- ----------------------------------------------------------------------------
-- 5) ENCUESTA DE SATISFACCIÓN (NPS) del inquilino tras resolver un reporte.
-- ----------------------------------------------------------------------------
create table if not exists public.satisfaction_ratings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid references public.maintenance_requests(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.satisfaction_ratings enable row level security;
drop policy if exists "staff reads org ratings" on public.satisfaction_ratings;
create policy "staff reads org ratings" on public.satisfaction_ratings for select to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff());
drop policy if exists "tenant inserts own rating" on public.satisfaction_ratings;
create policy "tenant inserts own rating" on public.satisfaction_ratings for insert to authenticated
  with check (org_id = public.auth_org_id() and created_by = auth.uid());
drop policy if exists "tenant reads own rating" on public.satisfaction_ratings;
create policy "tenant reads own rating" on public.satisfaction_ratings for select to authenticated
  using (created_by = auth.uid());
