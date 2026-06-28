-- Llave — Phase 0 schema (init)
-- Multi-tenant rental management for CDMX landlords.
-- Conventions: UUID PKs, created_at/updated_at on every table, deleted_at soft-delete
-- where it makes sense, org_id on every domain table.
-- Row-Level Security policies and Storage buckets are added in later migrations.

-- Extensions ----------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;  -- gen_random_uuid()

-- Enums ---------------------------------------------------------------------
create type public.user_role            as enum ('owner', 'staff', 'tenant');
create type public.property_type        as enum ('apartment', 'house');
create type public.unit_status          as enum ('occupied', 'vacant', 'maintenance');
create type public.guarantee_type       as enum ('aval', 'poliza_juridica', 'deposito', 'otro');
create type public.lease_status         as enum ('active', 'ended', 'pending');
create type public.payment_method       as enum ('spei', 'oxxo', 'cash', 'card', 'other');
create type public.payment_status       as enum ('pending', 'partial', 'paid', 'overdue');
create type public.maintenance_category as enum ('plomeria', 'electricidad', 'cerrajeria', 'electrodomesticos', 'limpieza', 'otro');
create type public.maintenance_priority as enum ('baja', 'media', 'alta', 'urgente');
create type public.maintenance_status   as enum ('recibido', 'en_proceso', 'resuelto', 'cancelado');
create type public.request_event_type   as enum ('created', 'status_change', 'comment', 'photo');
create type public.listing_status       as enum ('draft', 'published', 'paused', 'filled');
create type public.application_status   as enum ('recibida', 'en_revision', 'aprobada', 'rechazada');

-- updated_at trigger function -----------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables --------------------------------------------------------------------

-- organizations
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  default_clabe text,
  rfc           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- profiles (extends auth.users)
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  role            public.user_role not null default 'tenant',
  full_name       text,
  phone           text,
  email           text,
  whatsapp_opt_in boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index profiles_org_id_idx on public.profiles (org_id);

-- properties
create table public.properties (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  type       public.property_type not null default 'apartment',
  street     text,
  ext_number text,
  int_number text,
  colonia    text,
  municipio  text,
  cp         text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index properties_org_id_idx on public.properties (org_id);

-- units
create table public.units (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  label          text not null,
  bedrooms       integer,
  bathrooms      numeric(3,1),
  rent_amount    numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  status         public.unit_status not null default 'vacant',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index units_org_id_idx on public.units (org_id);
create index units_property_id_idx on public.units (property_id);

-- leases (contratos)
create table public.leases (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  unit_id           uuid not null references public.units(id) on delete restrict,
  tenant_profile_id uuid references public.profiles(id) on delete set null,
  start_date        date,
  end_date          date,
  rent_amount       numeric(12,2) not null default 0,
  deposit_amount    numeric(12,2) not null default 0,
  payment_day       integer not null default 1 check (payment_day between 1 and 31),
  guarantee_type    public.guarantee_type,
  guarantee_notes   text,
  status            public.lease_status not null default 'pending',
  contract_doc_url  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index leases_org_id_idx on public.leases (org_id);
create index leases_unit_id_idx on public.leases (unit_id);
create index leases_tenant_idx on public.leases (tenant_profile_id);

-- payments (recibos de renta)
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  lease_id        uuid not null references public.leases(id) on delete cascade,
  period_month    date not null,                 -- first day of the month, e.g. 2026-06-01
  amount_due      numeric(12,2) not null default 0,
  amount_paid     numeric(12,2) not null default 0,
  due_date        date,
  paid_date       date,
  method          public.payment_method,
  reference       text,                           -- SPEI clave de rastreo / folio
  status          public.payment_status not null default 'pending',
  receipt_pdf_url text,
  cfdi_id               text,                     -- Phase 3 (fiscal CFDI)
  confirmed_by          uuid references public.profiles(id) on delete set null,
  tenant_reference      text,                     -- SPEI clave the tenant submitted (awaiting admin confirmation)
  tenant_marked_paid_at timestamptz,              -- when the tenant flagged it as paid
  created_at            timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (lease_id, period_month)                 -- one rent row per lease per month
);
create index payments_org_id_idx on public.payments (org_id);
create index payments_lease_id_idx on public.payments (lease_id);
create index payments_status_idx on public.payments (status);
create index payments_period_idx on public.payments (period_month);

-- maintenance_requests (tickets)
create table public.maintenance_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  unit_id     uuid references public.units(id) on delete set null,
  lease_id    uuid references public.leases(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  title       text not null,
  description text,
  category    public.maintenance_category not null default 'otro',
  priority    public.maintenance_priority not null default 'media',
  status      public.maintenance_status not null default 'recibido',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index mreq_org_id_idx on public.maintenance_requests (org_id);
create index mreq_unit_id_idx on public.maintenance_requests (unit_id);
create index mreq_lease_id_idx on public.maintenance_requests (lease_id);
create index mreq_status_idx on public.maintenance_requests (status);

-- request_events (timeline). org_id added (not in original spec) so RLS can scope it.
create table public.request_events (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  type       public.request_event_type not null default 'comment',
  body       text,
  photo_url  text,
  created_at timestamptz not null default now()
);
create index revent_request_id_idx on public.request_events (request_id);
create index revent_org_id_idx on public.request_events (org_id);

-- listings (vacantes)
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  unit_id        uuid not null references public.units(id) on delete cascade,
  title          text not null,
  description    text,
  rent_amount    numeric(12,2) not null default 0,
  available_from date,
  photos         text[] not null default '{}',
  requirements   text,
  status         public.listing_status not null default 'draft',
  public_slug    text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index listings_org_id_idx on public.listings (org_id);
create index listings_slug_idx on public.listings (public_slug);

-- applications (solicitudes)
create table public.applications (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  listing_id        uuid not null references public.listings(id) on delete cascade,
  applicant_name    text not null,
  applicant_phone   text,
  applicant_email   text,
  monthly_income    numeric(12,2),
  income_proof_url  text,
  id_doc_url        text,                          -- INE
  guarantee_type    public.guarantee_type,
  guarantee_doc_url text,
  status            public.application_status not null default 'recibida',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index applications_org_id_idx on public.applications (org_id);
create index applications_listing_id_idx on public.applications (listing_id);

-- documents (generic store)
create table public.documents (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  owner_type text not null,                         -- e.g. 'lease', 'application', 'unit'
  owner_id   uuid not null,
  name       text not null,
  url        text not null,
  kind       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index documents_org_id_idx on public.documents (org_id);
create index documents_owner_idx on public.documents (owner_type, owner_id);

-- updated_at triggers --------------------------------------------------------
create trigger trg_organizations_updated         before update on public.organizations         for each row execute function public.set_updated_at();
create trigger trg_profiles_updated              before update on public.profiles              for each row execute function public.set_updated_at();
create trigger trg_properties_updated            before update on public.properties            for each row execute function public.set_updated_at();
create trigger trg_units_updated                 before update on public.units                 for each row execute function public.set_updated_at();
create trigger trg_leases_updated                before update on public.leases                for each row execute function public.set_updated_at();
create trigger trg_payments_updated              before update on public.payments              for each row execute function public.set_updated_at();
create trigger trg_maintenance_requests_updated  before update on public.maintenance_requests  for each row execute function public.set_updated_at();
create trigger trg_listings_updated              before update on public.listings              for each row execute function public.set_updated_at();
create trigger trg_applications_updated          before update on public.applications          for each row execute function public.set_updated_at();
create trigger trg_documents_updated             before update on public.documents             for each row execute function public.set_updated_at();
