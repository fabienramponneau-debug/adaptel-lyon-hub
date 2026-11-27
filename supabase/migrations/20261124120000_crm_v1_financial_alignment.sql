-- Alignement financier CRM V1 avec les reels ERP de l'app agence.
-- Migration additive uniquement : aucune suppression ni renommage de donnee.

alter table public.performances_clients
  add column if not exists marge_apres_cet numeric(14, 2),
  add column if not exists heures_facturees numeric(14, 2)
    check (heures_facturees is null or heures_facturees >= 0),
  add column if not exists prime_beneficiaire_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists prime_taux numeric(8, 6)
    check (prime_taux is null or (prime_taux >= 0 and prime_taux <= 1)),
  add column if not exists prime_montant numeric(14, 2);

comment on column public.performances_clients.marge is
  'Marge reelle avant CET, source de verite pour les objectifs et les primes.';
comment on column public.performances_clients.marge_apres_cet is
  'Marge reelle apres CET, conservee separement et jamais additionnee a marge.';
comment on column public.performances_clients.prime_montant is
  'Montant fige lors de la confirmation du reel.';

alter table public.objectifs_financiers
  add column if not exists reference_marge text not null default 'avant_cet'
    check (reference_marge in ('avant_cet', 'apres_cet'));

-- Un bareme est une nouvelle version complete de trois paliers. Les lignes ne
-- sont jamais modifiees : une evolution ajoute trois lignes a un nouveau mois.
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  effective_from text not null
    check (effective_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  month_from integer not null check (month_from >= 1),
  month_to integer check (month_to is null or month_to >= month_from),
  base_rate numeric(8, 6) not null check (base_rate >= 0 and base_rate <= 1),
  bonus_rate numeric(8, 6) not null default 0
    check (bonus_rate >= 0 and bonus_rate <= 1),
  margin_basis text not null default 'avant_cet'
    check (margin_basis = 'avant_cet'),
  actor_agency_user_id uuid,
  actor_name text,
  created_at timestamptz not null default now(),
  unique (effective_from, month_from),
  check (
    (month_from = 1 and month_to = 12)
    or (month_from = 13 and month_to = 24)
    or (month_from = 25 and month_to is null)
  )
);

comment on table public.commission_rules is
  'Baremes de prime versionnes et inseres sans mise a jour retroactive.';

alter table public.commission_rules enable row level security;
revoke all on public.commission_rules from public, anon, authenticated;
grant select, insert on public.commission_rules to service_role;
revoke update, delete on public.commission_rules from service_role;

insert into public.commission_rules (
  effective_from, month_from, month_to, base_rate, bonus_rate, margin_basis,
  actor_name
) values
  ('1900-01', 1, 12, 0.05, 0.02, 'avant_cet', 'Bareme initial V1'),
  ('1900-01', 13, 24, 0.04, 0, 'avant_cet', 'Bareme initial V1'),
  ('1900-01', 25, null, 0.03, 0, 'avant_cet', 'Bareme initial V1')
on conflict (effective_from, month_from) do nothing;

-- Moteur unique de taux. Les ecrans et le pont lisent ensuite les montants
-- figes sur performances_clients et ne reproduisent jamais ce calcul.
create or replace function public.commission_rate_v1(
  p_period_code text,
  p_triggered_at timestamptz
)
returns numeric
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with age as (
    select (
      (substring(p_period_code, 1, 4)::integer - extract(year from p_triggered_at)::integer) * 12
      + (substring(p_period_code, 6, 2)::integer - extract(month from p_triggered_at)::integer)
      + 1
    ) as month_number
  ), applicable_version as (
    select max(effective_from) as effective_from
    from public.commission_rules
    where effective_from <= p_period_code
  )
  select case
    when p_triggered_at is null or age.month_number < 1 then 0::numeric
    else coalesce(rule.base_rate + rule.bonus_rate, 0::numeric)
  end
  from age
  left join applicable_version version on true
  left join public.commission_rules rule
    on rule.effective_from = version.effective_from
   and age.month_number >= rule.month_from
   and (rule.month_to is null or age.month_number <= rule.month_to);
$$;

revoke all on function public.commission_rate_v1(text, timestamptz)
  from public, anon, authenticated;

create or replace function public.insert_commission_rules_v1(
  p_effective_from text,
  p_rules jsonb,
  p_actor_agency_user_id uuid,
  p_actor_name text
)
returns setof public.commission_rules
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_effective_from !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mois d''application invalide.';
  end if;
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) <> 3 then
    raise exception 'Le bareme doit contenir exactement trois paliers.';
  end if;
  if exists (
    select 1 from public.commission_rules
    where effective_from = p_effective_from
  ) then
    raise exception 'Un bareme existe deja pour ce mois.';
  end if;

  return query
  insert into public.commission_rules (
    effective_from, month_from, month_to, base_rate, bonus_rate,
    margin_basis, actor_agency_user_id, actor_name
  )
  select
    p_effective_from,
    (item ->> 'monthFrom')::integer,
    nullif(item ->> 'monthTo', '')::integer,
    (item ->> 'baseRate')::numeric,
    coalesce((item ->> 'bonusRate')::numeric, 0),
    'avant_cet',
    p_actor_agency_user_id,
    nullif(btrim(p_actor_name), '')
  from jsonb_array_elements(p_rules) item
  returning *;
end;
$$;

revoke all on function public.insert_commission_rules_v1(text, jsonb, uuid, text)
  from public, anon, authenticated;
grant execute on function public.insert_commission_rules_v1(text, jsonb, uuid, text)
  to service_role;

create or replace function public.freeze_performance_commission_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  beneficiary_id uuid;
  triggered_at timestamptz;
  applied_rate numeric;
begin
  if new.statut_cloture <> 'confirme' then
    if tg_op = 'UPDATE' and old.statut_cloture = 'confirme' then
      new.prime_beneficiaire_id := null;
      new.prime_taux := null;
      new.prime_montant := null;
    end if;
    return new;
  end if;

  -- Une ligne deja confirmee conserve son snapshot, meme si le bareme,
  -- l'attribution ou le beneficiaire courant change ensuite.
  if tg_op = 'UPDATE' and old.statut_cloture = 'confirme' then
    new.prime_beneficiaire_id := old.prime_beneficiaire_id;
    new.prime_taux := old.prime_taux;
    new.prime_montant := old.prime_montant;
    return new;
  end if;

  select e.client_triggered_by, e.client_triggered_at
    into beneficiary_id, triggered_at
  from public.establishments e
  where e.id = new.etablissement_id;

  applied_rate := public.commission_rate_v1(new.period_code, triggered_at);
  new.prime_beneficiaire_id := beneficiary_id;
  new.prime_taux := applied_rate;
  new.prime_montant := case
    when beneficiary_id is null or applied_rate = 0 then 0
    else round(greatest(new.marge, 0) * applied_rate, 2)
  end;
  return new;
end;
$$;

revoke all on function public.freeze_performance_commission_v1()
  from public, anon, authenticated;

drop trigger if exists freeze_performance_commission_v1
  on public.performances_clients;

create or replace function public.protect_agency_performance_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and (
    (tg_op in ('UPDATE', 'DELETE') and old.source = 'agence')
    or (tg_op in ('INSERT', 'UPDATE') and new.source = 'agence')
  ) then
    raise exception 'Les reels importes de l''agence sont en lecture seule dans le CRM.';
  end if;
  if auth.uid() is not null
     and tg_op = 'DELETE'
     and old.statut_cloture = 'confirme' then
    raise exception 'Un reel confirme ne peut pas etre supprime directement.';
  end if;
  if auth.uid() is not null
     and tg_op = 'UPDATE'
     and old.statut_cloture = 'confirme'
     and new.statut_cloture = 'confirme'
     and (
       old.chiffre_affaires is distinct from new.chiffre_affaires
       or old.marge is distinct from new.marge
       or old.marge_apres_cet is distinct from new.marge_apres_cet
       or old.heures_facturees is distinct from new.heures_facturees
       or old.user_id is distinct from new.user_id
     ) then
    raise exception 'Un reel confirme doit etre rouvert avant correction.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_agency_performance_v1()
  from public, anon, authenticated;

drop trigger if exists protect_agency_performance_v1
  on public.performances_clients;
create trigger protect_agency_performance_v1
  before insert or update or delete on public.performances_clients
  for each row execute function public.protect_agency_performance_v1();

-- Snapshot des mois deja confirmes au moment de la publication de la
-- migration. Cela fige l'affichage historique avant toute evolution future.
update public.performances_clients performance
set
  prime_beneficiaire_id = establishment.client_triggered_by,
  prime_taux = public.commission_rate_v1(
    performance.period_code,
    establishment.client_triggered_at
  ),
  prime_montant = case
    when establishment.client_triggered_by is null then 0
    else round(
      greatest(performance.marge, 0)
      * public.commission_rate_v1(
          performance.period_code,
          establishment.client_triggered_at
        ),
      2
    )
  end
from public.establishments establishment
where performance.etablissement_id = establishment.id
  and performance.statut_cloture = 'confirme'
  and performance.prime_montant is null;

-- Activer le gel après avoir renseigné les snapshots historiques.
create trigger freeze_performance_commission_v1
  before insert or update of statut_cloture, marge, etablissement_id, period_code,
    prime_beneficiaire_id, prime_taux, prime_montant
  on public.performances_clients
  for each row execute function public.freeze_performance_commission_v1();

create index if not exists performances_clients_prime_beneficiary_idx
  on public.performances_clients (prime_beneficiaire_id, period_code)
  where statut_cloture = 'confirme';

create or replace function public.crm_commission_totals_v1(
  p_year integer,
  p_user_id uuid default null
)
returns table (period_code text, commission numeric)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
  effective_user_id uuid;
begin
  if caller_id is null or p_year < 2020 or p_year > 2100 then
    raise exception 'Parametres de reporting invalides.';
  end if;
  select exists (
    select 1 from public.profiles
    where id = caller_id and role = 'admin' and actif = true
  ) into caller_is_admin;
  effective_user_id := case when caller_is_admin then p_user_id else caller_id end;

  return query
  select performance.period_code, sum(coalesce(performance.prime_montant, 0))::numeric
  from public.performances_clients performance
  where performance.statut_cloture = 'confirme'
    and performance.period_code between p_year::text || '-01' and p_year::text || '-12'
    and (effective_user_id is null or performance.prime_beneficiaire_id = effective_user_id)
  group by performance.period_code
  order by performance.period_code;
end;
$$;

revoke all on function public.crm_commission_totals_v1(integer, uuid)
  from public, anon;
grant execute on function public.crm_commission_totals_v1(integer, uuid)
  to authenticated;

