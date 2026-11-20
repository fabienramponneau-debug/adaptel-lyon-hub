create table public.financial_change_history (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('objectif_financier', 'prevision_client', 'performance_client')),
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  user_id uuid references public.profiles(id) on delete set null,
  etablissement_id uuid references public.establishments(id) on delete set null,
  period_code text,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  change_source text not null default 'crm' check (change_source in ('crm', 'api_agence')),
  changed_at timestamptz not null default now()
);

create index financial_change_history_user_period_idx
  on public.financial_change_history (user_id, period_code, changed_at desc);
create index financial_change_history_establishment_idx
  on public.financial_change_history (etablissement_id, changed_at desc);
create index financial_change_history_changed_by_idx
  on public.financial_change_history (changed_by);

alter table public.financial_change_history enable row level security;
grant select, insert on public.financial_change_history to authenticated;
revoke update, delete on public.financial_change_history from authenticated;

create policy "Financial history visible to owner or admin"
  on public.financial_change_history for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  );

create policy "Financial history written by current user"
  on public.financial_change_history for insert
  to authenticated
  with check (changed_by = (select auth.uid()));

create or replace function public.log_financial_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  before_json jsonb;
  after_json jsonb;
  effective_json jsonb;
  type_name text;
begin
  before_json := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_json := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  effective_json := coalesce(after_json, before_json);
  type_name := case tg_table_name
    when 'objectifs_financiers' then 'objectif_financier'
    when 'previsions_clients' then 'prevision_client'
    when 'performances_clients' then 'performance_client'
  end;

  insert into public.financial_change_history (
    record_type,
    record_id,
    operation,
    user_id,
    etablissement_id,
    period_code,
    before_data,
    after_data,
    changed_by,
    change_source
  ) values (
    type_name,
    (effective_json ->> 'id')::uuid,
    tg_op,
    nullif(effective_json ->> 'user_id', '')::uuid,
    nullif(effective_json ->> 'etablissement_id', '')::uuid,
    effective_json ->> 'period_code',
    before_json,
    after_json,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'api_agence' else 'crm' end
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.log_financial_change() from public, anon, authenticated;

create trigger log_objectifs_financiers_change
  after insert or update or delete on public.objectifs_financiers
  for each row execute function public.log_financial_change();

create trigger log_previsions_clients_change
  after insert or update or delete on public.previsions_clients
  for each row execute function public.log_financial_change();

create trigger log_performances_clients_change
  after insert or update or delete on public.performances_clients
  for each row execute function public.log_financial_change();
