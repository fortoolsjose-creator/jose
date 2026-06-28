-- Nivel 1: estacionamiento como cobro aparte + saldo base del fondo de operación.
alter table public.leases
  add column if not exists parking_fee numeric not null default 0;

alter table public.properties
  add column if not exists operating_fund_opening numeric not null default 0,
  add column if not exists operating_fund_opening_note text;
