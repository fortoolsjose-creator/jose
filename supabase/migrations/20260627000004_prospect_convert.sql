-- Convertir prospecto → inquilino: enlaza el contrato creado y marca la
-- conversión (idempotente: converted_at evita duplicados por doble clic).
alter table public.prospects
  add column if not exists lease_id uuid references public.leases(id),
  add column if not exists converted_at timestamptz;
