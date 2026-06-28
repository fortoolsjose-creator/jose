-- Llave - combined Phase 0 schema (init + RLS + storage).
-- Paste this whole file into the Supabase SQL Editor and Run.

-- ============================================================
-- 20260618000001_init.sql
-- ============================================================
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


-- ============================================================
-- 20260618000002_rls.sql
-- ============================================================
-- Llave — Phase 0: Row-Level Security
-- RLS is the SOURCE OF TRUTH for tenant isolation. App-layer checks are UX only.
--
-- Approach: SECURITY DEFINER helper functions look up the caller's profile to get
-- their org_id / role. They are owned by the migration role (= table owner), so they
-- bypass RLS on `profiles` and cannot recurse. (A future optimization is to inject
-- org_id/role as JWT claims via a custom access-token hook and read auth.jwt(), which
-- avoids the per-query lookup — but that needs a dashboard toggle, so we keep it in SQL.)
--
-- The Supabase `service_role` key bypasses RLS entirely; it is used ONLY by trusted
-- server-side admin jobs (seeding, invites), never for tenant-facing queries.

-- ===========================================================================
-- Helper functions (SECURITY DEFINER, search_path locked, fully qualified)
-- ===========================================================================

create or replace function public.auth_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.profiles where id = auth.uid() and deleted_at is null limit 1
$$;

create or replace function public.auth_user_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and deleted_at is null limit 1
$$;

create or replace function public.is_org_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'staff') and deleted_at is null
  )
$$;

-- Sets of ids the current tenant is entitled to see (bypass RLS to avoid nesting issues)
create or replace function public.tenant_lease_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.leases where tenant_profile_id = auth.uid() and deleted_at is null
$$;

create or replace function public.tenant_unit_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select unit_id from public.leases where tenant_profile_id = auth.uid() and deleted_at is null
$$;

create or replace function public.tenant_property_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct property_id from public.units
   where id in (select public.tenant_unit_ids()) and deleted_at is null
$$;

-- request ids the current tenant can see (their own requests, or for their units)
create or replace function public.tenant_request_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.maintenance_requests
   where (created_by = auth.uid()
      or unit_id in (select public.tenant_unit_ids()))
     and deleted_at is null
$$;

-- ===========================================================================
-- Enable RLS
-- ===========================================================================
alter table public.organizations         enable row level security;
alter table public.profiles               enable row level security;
alter table public.properties             enable row level security;
alter table public.units                  enable row level security;
alter table public.leases                 enable row level security;
alter table public.payments               enable row level security;
alter table public.maintenance_requests   enable row level security;
alter table public.request_events         enable row level security;
alter table public.listings               enable row level security;
alter table public.applications           enable row level security;
alter table public.documents              enable row level security;

-- ===========================================================================
-- organizations
-- ===========================================================================
create policy "staff read their org"
  on public.organizations for select to authenticated
  using (id = public.auth_org_id() and public.is_org_staff());

-- Tenants only need the org's public branding (name, logo) — never bank/tax fields.
-- This view runs with the owner's rights (bypasses RLS) but exposes ONLY safe columns,
-- scoped to the caller's own org.
create view public.org_public_info as
  select id, name, logo_url
    from public.organizations
   where id = public.auth_org_id();
grant select on public.org_public_info to authenticated;

create policy "staff update their org"
  on public.organizations for update to authenticated
  using (id = public.auth_org_id() and public.is_org_staff())
  with check (id = public.auth_org_id() and public.is_org_staff());

-- ===========================================================================
-- profiles
-- ===========================================================================
create policy "read own profile or staff reads org profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (org_id = public.auth_org_id() and public.is_org_staff())
  );

create policy "staff insert profiles in their org"
  on public.profiles for insert to authenticated
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "update own profile or staff updates org profiles"
  on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or (org_id = public.auth_org_id() and public.is_org_staff())
  )
  with check (
    id = auth.uid()
    or (org_id = public.auth_org_id() and public.is_org_staff())
  );

-- Guard: a non-staff user cannot escalate their own role or change org.
-- (auth.uid() is null for the service_role/seed path, which is exempted.)
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_org_staff() then
    if new.role is distinct from old.role then
      raise exception 'No puedes cambiar tu rol.';
    end if;
    if new.org_id is distinct from old.org_id then
      raise exception 'No puedes cambiar de organización.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ===========================================================================
-- properties
-- ===========================================================================
create policy "staff manage org properties"
  on public.properties for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads own properties"
  on public.properties for select to authenticated
  using (id in (select public.tenant_property_ids()));

-- ===========================================================================
-- units
-- ===========================================================================
create policy "staff manage org units"
  on public.units for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads own units"
  on public.units for select to authenticated
  using (id in (select public.tenant_unit_ids()));

-- ===========================================================================
-- leases
-- ===========================================================================
create policy "staff manage org leases"
  on public.leases for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads own leases"
  on public.leases for select to authenticated
  using (tenant_profile_id = auth.uid());

-- ===========================================================================
-- payments
-- ===========================================================================
create policy "staff manage org payments"
  on public.payments for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads own payments"
  on public.payments for select to authenticated
  using (lease_id in (select public.tenant_lease_ids()));

-- Tenant "marca como pagado": records their SPEI reference for admin confirmation.
-- No direct UPDATE policy for tenants — this RPC is the only write path, and it
-- touches ONLY tenant_reference / method / tenant_marked_paid_at, never `status`.
create or replace function public.tenant_submit_payment_reference(
  p_payment_id uuid,
  p_reference  text,
  p_method     public.payment_method default 'spei'
)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  rec public.payments;
begin
  select * into rec from public.payments p
   where p.id = p_payment_id
     and p.lease_id in (
       select id from public.leases where tenant_profile_id = auth.uid()
     );

  if rec.id is null then
    raise exception 'Recibo no encontrado o no te pertenece.';
  end if;
  if rec.status = 'paid' then
    raise exception 'El recibo ya está pagado.';
  end if;

  update public.payments
     set tenant_reference      = p_reference,
         method                = coalesce(p_method, method),
         tenant_marked_paid_at = now()
   where id = rec.id
  returning * into rec;

  return rec;
end;
$$;
revoke all on function public.tenant_submit_payment_reference(uuid, text, public.payment_method) from public;
grant execute on function public.tenant_submit_payment_reference(uuid, text, public.payment_method) to authenticated;

-- ===========================================================================
-- maintenance_requests
-- ===========================================================================
create policy "staff manage org requests"
  on public.maintenance_requests for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads own requests"
  on public.maintenance_requests for select to authenticated
  using (
    (created_by = auth.uid()
     or unit_id in (select public.tenant_unit_ids()))
    and deleted_at is null
  );

create policy "tenant creates requests for own unit"
  on public.maintenance_requests for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
    and (unit_id is null or unit_id in (select public.tenant_unit_ids()))
    and (lease_id is null or lease_id in (select public.tenant_lease_ids()))
  );

-- ===========================================================================
-- request_events (timeline)
-- ===========================================================================
create policy "staff manage org request events"
  on public.request_events for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads events on visible requests"
  on public.request_events for select to authenticated
  using (request_id in (select public.tenant_request_ids()));

create policy "tenant adds comment/photo to own requests"
  on public.request_events for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and actor_id = auth.uid()
    and type in ('comment', 'photo')
    and request_id in (
      select id from public.maintenance_requests
       where created_by = auth.uid() and deleted_at is null
    )
  );

-- ===========================================================================
-- listings (vacantes) — published ones are public
-- ===========================================================================
create policy "staff manage org listings"
  on public.listings for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "anyone reads published listings"
  on public.listings for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

-- ===========================================================================
-- applications (solicitudes) — anonymous can submit against a published listing
-- ===========================================================================
create policy "staff manage org applications"
  on public.applications for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "public submits application to a published listing"
  on public.applications for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.status = 'published'
        and l.deleted_at is null
        and l.org_id = applications.org_id
    )
  );

-- ===========================================================================
-- documents
-- ===========================================================================
create policy "staff manage org documents"
  on public.documents for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

create policy "tenant reads own documents"
  on public.documents for select to authenticated
  using (
    org_id = public.auth_org_id()
    and deleted_at is null
    and (
      (owner_type = 'profile' and owner_id = auth.uid())
      or (owner_type = 'lease'   and owner_id in (select public.tenant_lease_ids()))
      or (owner_type = 'unit'    and owner_id in (select public.tenant_unit_ids()))
    )
  );

-- ===========================================================================
-- Grants (RLS gates the rows; roles still need table privileges)
-- ===========================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.listings    to anon;   -- published listings only (RLS)
grant insert on public.applications to anon;   -- submit application (RLS); insert WITHOUT .select()


-- ============================================================
-- 20260618000003_storage.sql
-- ============================================================
-- Llave — Phase 0: Storage buckets + policies
-- Path convention:
--   public buckets:        {org_id}/<anything>
--   private (per-tenant):  {org_id}/{user_id}/<anything>
-- Staff manage everything under their own {org_id}/ prefix. Tenants read/write only
-- under their own {org_id}/{user_id}/ prefix in private buckets.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',        'avatars',        true,  5242880,  array['image/png','image/jpeg','image/webp']),
  ('listing-photos', 'listing-photos', true,  10485760, array['image/png','image/jpeg','image/webp']),
  ('documents',      'documents',      false, 15728640, null),
  ('receipts',       'receipts',       false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects (RLS is already enabled by Supabase)
-- ---------------------------------------------------------------------------

-- Public buckets are world-readable.
create policy "public read public buckets"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('avatars', 'listing-photos'));

-- Staff: full control of any file under their org's prefix, in any bucket.
create policy "staff manage org files"
  on storage.objects for all to authenticated
  using (
    (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_staff()
  )
  with check (
    (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_staff()
  );

-- Tenant: read their own private files at {org_id}/{user_id}/...
create policy "tenant read own private files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('documents', 'receipts')
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Tenant: upload their own files (e.g. maintenance photos) to documents/{org_id}/{user_id}/...
create policy "tenant upload own files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Tenant: replace/delete their own uploaded files.
create policy "tenant update own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "tenant delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );


