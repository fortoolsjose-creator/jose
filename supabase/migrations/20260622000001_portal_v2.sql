-- Llave — Portal v2: comprobante de pago (imagen), depósito pagado, actas
-- (entrega/vencimiento), incremento de renta por contrato e historial de
-- renovaciones. Idempotente: seguro de re-pegar en el SQL Editor de Supabase.

-- Columnas nuevas -----------------------------------------------------------
-- Imagen del comprobante de pago (la sube el inquilino al avisar, o el staff
-- al registrar el pago). Se guarda como ruta dentro del bucket privado.
alter table public.payments add column if not exists proof_path text;

-- Contrato / arrendamiento
alter table public.leases add column if not exists deposit_paid boolean not null default false;
alter table public.leases add column if not exists acta_entrega_path text;
alter table public.leases add column if not exists acta_vencimiento_path text;
-- % de incremento anual por contrato (lo capturas tú; puede ser la inflación
-- del año). La fórmula calcula la renta nueva = renta_actual * (1 + pct/100).
alter table public.leases add column if not exists annual_increase_pct numeric(5,2);

-- Historial de renovaciones / incrementos de renta --------------------------
create table if not exists public.lease_renewals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lease_id      uuid not null references public.leases(id) on delete cascade,
  previous_rent numeric(12,2) not null,
  new_rent      numeric(12,2) not null,
  increase_pct  numeric(5,2),
  previous_end  date,
  new_end       date,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists lease_renewals_lease_idx on public.lease_renewals (lease_id);
create index if not exists lease_renewals_org_idx on public.lease_renewals (org_id);

alter table public.lease_renewals enable row level security;

drop policy if exists "staff manage org renewals" on public.lease_renewals;
create policy "staff manage org renewals"
  on public.lease_renewals for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());

drop policy if exists "tenant reads own renewals" on public.lease_renewals;
create policy "tenant reads own renewals"
  on public.lease_renewals for select to authenticated
  using (lease_id in (select public.tenant_lease_ids()));

grant select, insert, update, delete on public.lease_renewals to authenticated;
