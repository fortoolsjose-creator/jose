-- Precios de mercado por unidad (estudio MPM de la asistente): mín / prom / máx.
alter table public.units
  add column if not exists rent_market_min numeric,
  add column if not exists rent_market_avg numeric,
  add column if not exists rent_market_max numeric,
  add column if not exists rent_market_source text,
  add column if not exists rent_market_updated_at timestamptz;
