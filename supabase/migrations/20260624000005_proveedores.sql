-- Directorio de proveedores (proceso #37 de la asistente).
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  service_type text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists providers_org_id_idx on public.providers(org_id) where deleted_at is null;
alter table public.providers enable row level security;
create policy "staff manage org providers" on public.providers for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
create trigger providers_updated_at before update on public.providers
  for each row execute function public.set_updated_at();
