-- Quick wins: CLABE por propiedad (la ve el inquilino para pagar),
-- consentimiento del aviso de privacidad, y bitácora de cambios de dinero.

-- 1) Cuenta para depósitos por propiedad (cada edificio = su entidad legal).
alter table public.properties
  add column if not exists clabe text,
  add column if not exists banco text,
  add column if not exists titular text;

-- 2) Constancia de consentimiento del aviso de privacidad (LFPDPPP).
alter table public.applications
  add column if not exists privacy_accepted_at timestamptz;

-- 3) Bitácora: registra UPDATE y DELETE en las tablas de dinero (no INSERT,
--    porque los cobros se autogeneran y harían ruido). Captura quién (auth.uid),
--    qué cambió (antes/después) y cuándo.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  table_name text not null,
  row_id uuid,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_org_idx on public.audit_log(org_id, created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "staff reads org audit" on public.audit_log;
create policy "staff reads org audit" on public.audit_log for select to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff());

create or replace function public.log_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_diff jsonb;
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_log(org_id, actor_id, table_name, row_id, action, diff)
    values (old.org_id, auth.uid(), tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  end if;
  select jsonb_object_agg(key, jsonb_build_object('antes', o.value, 'despues', n.value))
    into v_diff
  from jsonb_each(to_jsonb(old)) o
  join jsonb_each(to_jsonb(new)) n using (key)
  where o.value is distinct from n.value;
  if v_diff is null then return new; end if;
  insert into public.audit_log(org_id, actor_id, table_name, row_id, action, diff)
  values (new.org_id, auth.uid(), tg_table_name, new.id, 'update', v_diff);
  return new;
end $$;

drop trigger if exists audit_payments on public.payments;
create trigger audit_payments after update or delete on public.payments
  for each row execute function public.log_audit();
drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses after update or delete on public.expenses
  for each row execute function public.log_audit();
drop trigger if exists audit_leases on public.leases;
create trigger audit_leases after update or delete on public.leases
  for each row execute function public.log_audit();
drop trigger if exists audit_maintenance_fees on public.maintenance_fees;
create trigger audit_maintenance_fees after update or delete on public.maintenance_fees
  for each row execute function public.log_audit();
