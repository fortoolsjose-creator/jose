-- Checklist de cierre de mes: marca de cada proceso por periodo (procesos 1-39
-- de la asistente; los nombres viven en el código). Ataca el "desorden".
create table if not exists public.process_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  process_no smallint not null,
  period_month date not null,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, process_no, period_month)
);
create index if not exists process_completions_org_period_idx
  on public.process_completions(org_id, period_month);
alter table public.process_completions enable row level security;
create policy "staff manage org process completions" on public.process_completions for all to authenticated
  using (org_id = public.auth_org_id() and public.is_org_staff())
  with check (org_id = public.auth_org_id() and public.is_org_staff());
