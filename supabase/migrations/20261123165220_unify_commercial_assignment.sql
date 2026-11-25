-- commercial_id devient l'unique attribution courante d'un établissement.
-- Les champs client_triggered_by/client_triggered_at restent intacts : ils
-- conservent exclusivement l'historique nécessaire aux primes déjà acquises.

-- Un établissement ne doit porter qu'une ligne de prévision par mois, même
-- après une réattribution. L'arrêt explicite protège contre toute fusion
-- silencieuse si des doublons existaient avant la migration.
do $$
begin
  if exists (
    select 1
    from public.previsions_clients
    group by etablissement_id, period_code
    having count(*) > 1
  ) then
    raise exception 'Doublons de prévisions détectés : migration interrompue sans modification.';
  end if;

  if exists (
    select 1
    from public.performances_clients
    where source = 'agence' and agency_client_id is not null
    group by agency_client_id, period_code
    having count(*) > 1
  ) then
    raise exception 'Doublons de réels agence détectés : migration interrompue sans modification.';
  end if;
end;
$$;

create unique index if not exists previsions_clients_establishment_period_unique
  on public.previsions_clients (etablissement_id, period_code);

create unique index if not exists performances_clients_agency_period_unique
  on public.performances_clients (agency_client_id, period_code)
  where source = 'agence' and agency_client_id is not null;

-- Les prévisions personnelles sont autorisées uniquement pour le commercial
-- actuellement attribué. Les admins conservent leurs droits existants.
drop policy if exists "Forecasts inserted by owner or admin" on public.previsions_clients;
create policy "Forecasts inserted by owner or admin"
  on public.previsions_clients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
    or (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.establishments e
        where e.id = etablissement_id
          and e.commercial_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Forecasts updated by owner or admin" on public.previsions_clients;
create policy "Forecasts updated by owner or admin"
  on public.previsions_clients for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
    or (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.establishments e
        where e.id = etablissement_id
          and e.commercial_id = (select auth.uid())
      )
    )
  );

-- L'historique ne peut plus être fabriqué directement depuis le navigateur.
-- Il est écrit uniquement par le trigger, avec l'utilisateur CRM authentifié.
revoke insert on public.establishment_assignment_history from authenticated;

drop policy if exists "Assignment history written for current user"
  on public.establishment_assignment_history;

create or replace function public.log_establishment_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  previous_id uuid := case when tg_op = 'INSERT' then null else old.commercial_id end;
begin
  if new.commercial_id is not distinct from previous_id then
    return new;
  end if;

  if actor_id is null then
    raise exception 'Une session CRM authentifiée est requise pour modifier l''attribution commerciale.';
  end if;

  insert into public.establishment_assignment_history (
    etablissement_id,
    previous_commercial_id,
    new_commercial_id,
    changed_by
  ) values (
    new.id,
    previous_id,
    new.commercial_id,
    actor_id
  );

  return new;
end;
$$;

revoke all on function public.log_establishment_assignment() from public, anon, authenticated;

drop trigger if exists log_establishment_assignment_change on public.establishments;
create trigger log_establishment_assignment_change
  after insert or update of commercial_id on public.establishments
  for each row execute function public.log_establishment_assignment();
