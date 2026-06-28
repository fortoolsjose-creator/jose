-- Datos fiscales (CFDI/factura). Esta migración se aplicó directo en producción
-- pegando el SQL en Supabase, pero el archivo nunca se guardó en el repo; se agrega
-- aquí para que una reconstrucción de la base desde cero quede igual que producción.
-- Todo con guardas idempotentes: es un no-op seguro donde ya existe.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fiscal_status') then
    create type public.fiscal_status as enum ('con_factura', 'sin_factura', 'pendiente');
  end if;
end $$;

alter table public.payments
  add column if not exists fiscal_status public.fiscal_status not null default 'pendiente',
  add column if not exists invoiced_at timestamptz;

alter table public.profiles
  add column if not exists rfc text,
  add column if not exists razon_social text,
  add column if not exists regimen_fiscal text,
  add column if not exists uso_cfdi text,
  add column if not exists requiere_factura boolean not null default false;
