-- Mantenimiento del mes: quién lo hizo (trabajador), cuánto costó, y a qué edificio.
alter table public.maintenance_requests
  add column if not exists worker_id uuid references public.workers(id),
  add column if not exists cost numeric,
  add column if not exists property_id uuid references public.properties(id);
