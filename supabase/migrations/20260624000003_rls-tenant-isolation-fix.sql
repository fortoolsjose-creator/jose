-- Fix de aislamiento entre inquilinos.
-- Antes: un contrato TERMINADO (status='ended') seguía concediendo acceso a la
-- unidad, así que un ex-inquilino veía los reportes/fotos del nuevo inquilino de
-- la misma unidad (y viceversa). Ahora el acceso por unidad es solo de contratos
-- ACTIVOS, y cada inquilino ve únicamente los reportes que él creó.

-- 1) Unidades del inquilino: solo de contratos activos.
create or replace function public.tenant_unit_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select unit_id from public.leases
   where tenant_profile_id = auth.uid()
     and status = 'active'
     and deleted_at is null
$$;

-- 2) Reportes visibles para el inquilino: solo los que él creó.
create or replace function public.tenant_request_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.maintenance_requests
   where created_by = auth.uid() and deleted_at is null
$$;

-- 3) Política de lectura de reportes: solo los propios (quita el acceso por unidad,
--    que filtraba reportes de otros inquilinos de la misma unidad).
drop policy if exists "tenant reads own requests" on public.maintenance_requests;
create policy "tenant reads own requests"
  on public.maintenance_requests for select to authenticated
  using (created_by = auth.uid() and deleted_at is null);

-- Nota: tenant_lease_ids() se deja igual (un ex-inquilino sí puede seguir viendo
-- SUS propios pagos históricos, que nunca son de otro inquilino).
