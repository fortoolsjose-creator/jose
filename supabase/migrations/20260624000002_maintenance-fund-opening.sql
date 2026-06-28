-- Saldo base del fondo de mantenimiento por propiedad (colchón histórico al corte).
-- El fondo actual = saldo base + cuotas cobradas − gastos de mantenimiento (en plataforma).
alter table public.properties
  add column if not exists maintenance_fund_opening numeric not null default 0,
  add column if not exists maintenance_fund_opening_note text;
