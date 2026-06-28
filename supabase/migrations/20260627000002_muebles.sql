-- Muebles como cobro aparte (unidades amuebladas): renta + muebles + mtto + estac.
alter table public.leases
  add column if not exists furniture_fee numeric not null default 0;
