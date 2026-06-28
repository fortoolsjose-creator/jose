-- Precio de compra por propiedad → para comparar contra el valor actual
-- (avalúo / valuación más reciente) y ver la ganancia de capital / plusvalía.
alter table public.properties
  add column if not exists purchase_price numeric,
  add column if not exists purchase_date date;
