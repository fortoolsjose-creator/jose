-- Cargo moratorio configurable por organización.
-- mora_tasa_mensual: % mensual que se cobra sobre el saldo vencido.
-- mora_dias_gracia: días de tolerancia antes de empezar a cobrar mora.
-- En 0 (default) no se cobra mora, así que es retrocompatible.
alter table public.organizations
  add column if not exists mora_tasa_mensual numeric(5,2) not null default 0;
alter table public.organizations
  add column if not exists mora_dias_gracia integer not null default 0;
