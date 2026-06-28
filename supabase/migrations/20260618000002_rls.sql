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
