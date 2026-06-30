-- #4 Cuota de mantenimiento: desde cuándo aplica la cuota vigente.
-- Los condominios cambian la cuota de forma irregular; esto deja registro de la fecha.
alter table public.leases add column if not exists maintenance_fee_desde date;

-- #6 Renovación: fecha límite para que el arrendatario conteste + seguimiento de respuesta.
alter table public.leases add column if not exists renewal_deadline date;
alter table public.leases add column if not exists renewal_sent_at date;
alter table public.leases add column if not exists renewal_responded_at date;
