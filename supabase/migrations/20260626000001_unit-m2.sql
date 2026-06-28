-- Metraje (m²) por unidad — para costo por m² y comparación contra mercado.
alter table public.units add column if not exists m2 numeric;
