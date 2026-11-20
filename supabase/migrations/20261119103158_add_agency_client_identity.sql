alter table public.establishments
  add column if not exists erp_client_code text;

create unique index if not exists establishments_agency_client_id_unique
  on public.establishments (agency_client_id)
  where agency_client_id is not null and btrim(agency_client_id) <> '';

create unique index if not exists establishments_erp_client_code_unique
  on public.establishments (lower(btrim(erp_client_code)))
  where erp_client_code is not null and btrim(erp_client_code) <> '';

create table public.establishment_assignment_history (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.establishments(id) on delete cascade,
  previous_commercial_id uuid references public.profiles(id) on delete set null,
  new_commercial_id uuid references public.profiles(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index establishment_assignment_history_establishment_idx
  on public.establishment_assignment_history (etablissement_id, changed_at desc);

alter table public.establishment_assignment_history enable row level security;
grant select, insert on public.establishment_assignment_history to authenticated;
revoke update, delete on public.establishment_assignment_history from authenticated;

create policy "Authenticated users view assignment history"
  on public.establishment_assignment_history for select
  to authenticated
  using (true);

create policy "Assignment history written for current user"
  on public.establishment_assignment_history for insert
  to authenticated
  with check (changed_by = (select auth.uid()));

create or replace function public.log_establishment_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.commercial_id is distinct from new.commercial_id then
    insert into public.establishment_assignment_history (
      etablissement_id,
      previous_commercial_id,
      new_commercial_id,
      changed_by
    ) values (
      new.id,
      old.commercial_id,
      new.commercial_id,
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.log_establishment_assignment() from public, anon, authenticated;

create trigger log_establishment_assignment_change
  after update of commercial_id on public.establishments
  for each row execute function public.log_establishment_assignment();
