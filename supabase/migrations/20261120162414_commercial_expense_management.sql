-- Gestion des notes de frais et déplacements commerciaux.
-- Migration additive : aucune table historique n'est modifiée.

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and actif = true
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated, service_role;

create or replace function public.is_service_role_request()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role') = 'service_role', false);
$$;

revoke all on function public.is_service_role_request() from public, anon;
grant execute on function public.is_service_role_request() to authenticated, service_role;

create table public.expense_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('personnel', 'societe', 'location', 'autre')),
  label text not null,
  registration text,
  fiscal_power integer check (fiscal_power between 1 and 20),
  holder_name text,
  valid_from date not null,
  valid_to date,
  mileage_eligible boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_vehicles_dates_check check (valid_to is null or valid_to >= valid_from),
  constraint expense_vehicles_rental_check check (vehicle_type <> 'location' or mileage_eligible = false),
  constraint expense_vehicles_power_check check (not mileage_eligible or fiscal_power is not null)
);

create table public.mileage_rate_brackets (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  fiscal_power_min integer not null check (fiscal_power_min between 1 and 20),
  fiscal_power_max integer not null check (fiscal_power_max between fiscal_power_min and 20),
  distance_from numeric(12,2) not null default 0 check (distance_from >= 0),
  distance_to numeric(12,2) check (distance_to is null or distance_to >= distance_from),
  rate_per_km numeric(12,6) not null check (rate_per_km >= 0),
  fixed_amount numeric(12,2) not null default 0 check (fixed_amount >= 0),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, fiscal_power_min, fiscal_power_max, distance_from)
);

create table public.expense_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  period_code text not null check (period_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  period_start date generated always as (
    make_date(substring(period_code, 1, 4)::integer, substring(period_code, 6, 2)::integer, 1)
  ) stored,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'correction_required', 'validated', 'closed')),
  mileage_km_snapshot numeric(12,2) not null default 0 check (mileage_km_snapshot >= 0),
  mileage_amount_snapshot numeric(12,2) not null default 0 check (mileage_amount_snapshot >= 0),
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  correction_reason text,
  validated_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  payroll_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_code)
);

create table public.expense_trips (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.expense_periods(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  travel_date date not null,
  start_location text not null,
  final_destination text not null,
  return_location text,
  purpose text not null check (purpose in ('prospection', 'rendez_vous', 'suivi_client', 'fidelisation', 'autre')),
  vehicle_id uuid references public.expense_vehicles(id) on delete restrict,
  contact_name text,
  comment text,
  total_km numeric(10,2) not null default 0 check (total_km >= 0 and total_km <= 2000),
  kilometers_manually_adjusted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_trip_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.expense_trips(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  from_location text not null,
  to_location text not null,
  kilometers numeric(10,2) not null check (kilometers >= 0 and kilometers <= 1000),
  establishment_id uuid references public.establishments(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, sequence_number)
);

create table public.expense_trip_actions (
  trip_id uuid not null references public.expense_trips(id) on delete cascade,
  action_id uuid not null references public.actions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (trip_id, action_id)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  label text not null,
  is_meal boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.expense_categories (code, label, is_meal, sort_order)
values
  ('parking', 'Parking', false, 10),
  ('bike_rental', 'Location de vélo', false, 20),
  ('vehicle_rental', 'Location de véhicule', false, 30),
  ('toll', 'Péage', false, 40),
  ('transport', 'Transports', false, 50),
  ('meal', 'Repas professionnel', true, 60),
  ('other', 'Autre frais professionnel', false, 70)
on conflict (code) do nothing;

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.expense_periods(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  trip_id uuid references public.expense_trips(id) on delete set null,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  expense_date date not null,
  amount numeric(12,2) not null check (amount >= 0 and amount <= 100000),
  description text not null,
  restaurant_name text,
  business_reason text,
  invited_contacts text[] not null default '{}',
  guest_count integer check (guest_count is null or guest_count > 0),
  receipt_path text,
  receipt_name text,
  receipt_mime_type text,
  receipt_size_bytes bigint check (receipt_size_bytes is null or receipt_size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_period_history (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.expense_periods(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_source text not null default 'crm' check (actor_source in ('crm', 'app_agence', 'system')),
  reason text,
  mileage_km numeric(12,2) not null default 0,
  mileage_amount numeric(12,2) not null default 0,
  expenses_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.expense_adjustments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.expense_periods(id) on delete restrict,
  expense_item_id uuid references public.expense_items(id) on delete restrict,
  trip_id uuid references public.expense_trips(id) on delete restrict,
  amount_delta numeric(12,2) not null default 0 check (amount_delta between -100000 and 100000),
  kilometers_delta numeric(10,2) not null default 0 check (kilometers_delta between -2000 and 2000),
  reason text not null check (length(trim(reason)) >= 5),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_source text not null check (actor_source in ('crm', 'app_agence')),
  created_at timestamptz not null default now(),
  constraint expense_adjustments_non_zero check (amount_delta <> 0 or kilometers_delta <> 0)
);

create table public.expense_change_history (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references public.expense_periods(id) on delete restrict,
  entity_type text not null check (entity_type in ('period', 'trip', 'trip_leg', 'expense_item', 'vehicle')),
  entity_id uuid not null,
  operation text not null check (operation in ('insert', 'update', 'delete', 'admin_correction')),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_source text not null default 'crm' check (actor_source in ('crm', 'app_agence', 'system')),
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index expense_vehicles_user_dates_idx on public.expense_vehicles (user_id, valid_from, valid_to);
create index mileage_rate_brackets_lookup_idx on public.mileage_rate_brackets (year, fiscal_power_min, fiscal_power_max, distance_from);
create index expense_periods_user_period_idx on public.expense_periods (user_id, period_code desc);
create index expense_periods_status_idx on public.expense_periods (status, period_code desc);
create index expense_trips_period_date_idx on public.expense_trips (period_id, travel_date);
create index expense_trips_user_date_idx on public.expense_trips (user_id, travel_date);
create index expense_trips_vehicle_idx on public.expense_trips (vehicle_id) where vehicle_id is not null;
create index expense_trip_legs_establishment_idx on public.expense_trip_legs (establishment_id) where establishment_id is not null;
create index expense_trip_legs_contact_idx on public.expense_trip_legs (contact_id) where contact_id is not null;
create index expense_trip_actions_action_idx on public.expense_trip_actions (action_id);
create index expense_items_period_date_idx on public.expense_items (period_id, expense_date);
create index expense_items_user_date_idx on public.expense_items (user_id, expense_date);
create index expense_items_trip_idx on public.expense_items (trip_id) where trip_id is not null;
create index expense_items_category_idx on public.expense_items (category_id);
create index expense_period_history_period_idx on public.expense_period_history (period_id, created_at desc);
create index expense_adjustments_period_idx on public.expense_adjustments (period_id, created_at desc);
create index expense_adjustments_item_idx on public.expense_adjustments (expense_item_id) where expense_item_id is not null;
create index expense_adjustments_trip_idx on public.expense_adjustments (trip_id) where trip_id is not null;
create index expense_change_history_period_idx on public.expense_change_history (period_id, created_at desc);

create or replace function public.calculate_mileage_entitlement(
  p_year integer,
  p_fiscal_power integer,
  p_distance numeric
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select round(greatest(0, p_distance) * bracket.rate_per_km + bracket.fixed_amount, 2)
  from public.mileage_rate_brackets bracket
  where bracket.year = p_year
    and p_fiscal_power between bracket.fiscal_power_min and bracket.fiscal_power_max
    and greatest(0, p_distance) >= bracket.distance_from
    and (bracket.distance_to is null or greatest(0, p_distance) <= bracket.distance_to)
  order by bracket.distance_from desc
  limit 1;
$$;

revoke all on function public.calculate_mileage_entitlement(integer, integer, numeric) from public, anon;
grant execute on function public.calculate_mileage_entitlement(integer, integer, numeric) to authenticated, service_role;

create or replace function public.validate_mileage_rate_bracket()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.mileage_rate_brackets bracket
    where bracket.year = new.year
      and bracket.id <> coalesce(new.id, gen_random_uuid())
      and int4range(bracket.fiscal_power_min, bracket.fiscal_power_max, '[]') && int4range(new.fiscal_power_min, new.fiscal_power_max, '[]')
      and numrange(bracket.distance_from, bracket.distance_to, '[]') && numrange(new.distance_from, new.distance_to, '[]')
  ) then raise exception 'Cette tranche chevauche un barème existant'; end if;
  return new;
end;
$$;

revoke all on function public.validate_mileage_rate_bracket() from public, anon;
grant execute on function public.validate_mileage_rate_bracket() to authenticated, service_role;

create trigger validate_mileage_rate_bracket_trigger
before insert or update on public.mileage_rate_brackets
for each row execute function public.validate_mileage_rate_bracket();

create or replace function public.refresh_expense_period_mileage(p_period_id uuid)
returns table (kilometers numeric, amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.expense_periods%rowtype;
  v_vehicle record;
  v_previous_km numeric;
  v_current_km numeric;
  v_previous_amount numeric;
  v_total_amount numeric;
  v_km numeric := 0;
  v_amount numeric := 0;
begin
  select * into v_period from public.expense_periods where id = p_period_id;
  if v_period.id is null then raise exception 'Période introuvable'; end if;
  if (select auth.uid()) is not null
    and v_period.user_id <> (select auth.uid())
    and not coalesce(public.is_active_admin(), false)
    and not coalesce(public.is_service_role_request(), false)
  then raise exception 'Accès refusé'; end if;

  for v_vehicle in
    select distinct vehicle.id, vehicle.fiscal_power
    from public.expense_trips trip
    join public.expense_vehicles vehicle on vehicle.id = trip.vehicle_id
    where trip.period_id = p_period_id and vehicle.mileage_eligible = true
  loop
    select coalesce(sum(trip.total_km), 0) into v_current_km
    from public.expense_trips trip
    where trip.period_id = p_period_id and trip.vehicle_id = v_vehicle.id;

    select coalesce(sum(trip.total_km), 0) into v_previous_km
    from public.expense_trips trip
    join public.expense_periods period on period.id = trip.period_id
    where trip.vehicle_id = v_vehicle.id
      and period.user_id = v_period.user_id
      and extract(year from period.period_start) = extract(year from v_period.period_start)
      and period.period_start < v_period.period_start
      and period.status in ('submitted', 'correction_required', 'validated', 'closed');

    v_previous_amount := coalesce(public.calculate_mileage_entitlement(extract(year from v_period.period_start)::integer, v_vehicle.fiscal_power, v_previous_km), 0);
    v_total_amount := coalesce(public.calculate_mileage_entitlement(extract(year from v_period.period_start)::integer, v_vehicle.fiscal_power, v_previous_km + v_current_km), 0);
    v_km := v_km + v_current_km;
    v_amount := v_amount + greatest(0, v_total_amount - v_previous_amount);
  end loop;

  update public.expense_periods
  set mileage_km_snapshot = round(v_km, 2), mileage_amount_snapshot = round(v_amount, 2)
  where id = p_period_id;
  return query select round(v_km, 2), round(v_amount, 2);
end;
$$;

revoke all on function public.refresh_expense_period_mileage(uuid) from public, anon, authenticated, service_role;

create or replace function public.expense_period_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin boolean := coalesce(public.is_active_admin(), false)
    or coalesce(public.is_service_role_request(), false)
    or current_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    if new.user_id <> (select auth.uid()) and not v_admin then raise exception 'Accès refusé'; end if;
    if not v_admin and (
      new.status <> 'draft' or new.mileage_km_snapshot <> 0 or new.mileage_amount_snapshot <> 0 or
      new.submitted_at is not null or new.submitted_by is not null or new.reviewed_at is not null or
      new.reviewed_by is not null or new.validated_at is not null or new.validated_by is not null or
      new.closed_at is not null or new.closed_by is not null or new.payroll_reference is not null
    ) then raise exception 'Les champs administratifs ne peuvent pas être renseignés à la création'; end if;
    return new;
  end if;

  if new.user_id <> old.user_id or new.period_code <> old.period_code then
    raise exception 'Le propriétaire et le mois ne peuvent pas être modifiés';
  end if;

  if not v_admin and (
    new.mileage_km_snapshot is distinct from old.mileage_km_snapshot or
    new.mileage_amount_snapshot is distinct from old.mileage_amount_snapshot or
    new.submitted_at is distinct from old.submitted_at or new.submitted_by is distinct from old.submitted_by or
    new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by or
    new.validated_at is distinct from old.validated_at or new.validated_by is distinct from old.validated_by or
    new.closed_at is distinct from old.closed_at or new.closed_by is distinct from old.closed_by or
    new.payroll_reference is distinct from old.payroll_reference or
    (new.correction_reason is distinct from old.correction_reason and new.status = old.status)
  ) then raise exception 'Les champs administratifs sont protégés'; end if;

  if new.status is distinct from old.status then
    if not v_admin then
      if old.user_id <> (select auth.uid()) or old.status not in ('draft', 'correction_required') or new.status <> 'submitted' then
        raise exception 'Transition de statut non autorisée';
      end if;
      new.submitted_at := now();
      new.submitted_by := (select auth.uid());
      new.correction_reason := null;
    else
      if not (
        (old.status = 'submitted' and new.status in ('correction_required', 'validated')) or
        (old.status = 'correction_required' and new.status = 'validated') or
        (old.status = 'validated' and new.status = 'closed')
      ) then raise exception 'Transition administrative non autorisée'; end if;
      new.reviewed_at := now();
      new.reviewed_by := (select auth.uid());
      if new.status = 'correction_required' and nullif(trim(new.correction_reason), '') is null then
        raise exception 'Le motif de correction est obligatoire';
      end if;
      if new.status = 'validated' then new.validated_at := now(); new.validated_by := (select auth.uid()); end if;
      if new.status = 'closed' then new.closed_at := now(); new.closed_by := (select auth.uid()); end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.expense_period_before_write() from public, anon;
grant execute on function public.expense_period_before_write() to authenticated, service_role;

create trigger expense_period_before_write_trigger
before insert or update on public.expense_periods
for each row execute function public.expense_period_before_write();

create or replace function public.expense_period_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expenses numeric;
  v_mileage_km numeric;
  v_mileage_amount numeric;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'submitted' then
      perform public.refresh_expense_period_mileage(new.id);
    end if;
    select mileage_km_snapshot, mileage_amount_snapshot
      into v_mileage_km, v_mileage_amount
    from public.expense_periods where id = new.id;
    select coalesce(sum(amount), 0) into v_expenses from public.expense_items where period_id = new.id;
    insert into public.expense_period_history (
      period_id, from_status, to_status, actor_id, actor_source, reason,
      mileage_km, mileage_amount, expenses_amount
    ) values (
      new.id, case when tg_op = 'INSERT' then null else old.status end, new.status,
      (select auth.uid()), case when (select auth.uid()) is null then 'system' else 'crm' end,
      new.correction_reason, coalesce(v_mileage_km, 0), coalesce(v_mileage_amount, 0), v_expenses
    );
  end if;
  return new;
end;
$$;

revoke all on function public.expense_period_after_write() from public, anon, authenticated;

create trigger expense_period_after_write_trigger
after insert or update on public.expense_periods
for each row execute function public.expense_period_after_write();

create or replace function public.validate_expense_detail()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.expense_periods%rowtype;
  v_vehicle public.expense_vehicles%rowtype;
  v_is_meal boolean;
  v_date date;
begin
  select * into v_period from public.expense_periods where id = new.period_id;
  if v_period.id is null or v_period.user_id <> new.user_id then raise exception 'Période ou propriétaire incohérent'; end if;
  v_date := coalesce(
    nullif(to_jsonb(new) ->> 'travel_date', '')::date,
    nullif(to_jsonb(new) ->> 'expense_date', '')::date
  );
  if to_char(v_date, 'YYYY-MM') <> v_period.period_code then raise exception 'La date doit appartenir au mois de la période'; end if;

  if tg_table_name = 'expense_trips' then
    if nullif(to_jsonb(new) ->> 'vehicle_id', '') is not null then
      select * into v_vehicle from public.expense_vehicles where id = (to_jsonb(new) ->> 'vehicle_id')::uuid;
      if v_vehicle.id is null or v_vehicle.user_id <> new.user_id then raise exception 'Véhicule incohérent'; end if;
      if v_date < v_vehicle.valid_from or (v_vehicle.valid_to is not null and v_date > v_vehicle.valid_to) then
        raise exception 'Ce véhicule n''est pas valide à la date du déplacement';
      end if;
    end if;
  end if;

  if tg_table_name = 'expense_items' then
    select is_meal into v_is_meal from public.expense_categories where id = new.category_id;
    if v_is_meal and (
      nullif(trim(new.restaurant_name), '') is null or
      nullif(trim(new.business_reason), '') is null or
      new.guest_count is null
    ) then raise exception 'Restaurant, motif et nombre de convives sont obligatoires pour un repas'; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_expense_detail() from public, anon;
grant execute on function public.validate_expense_detail() to authenticated, service_role;

create trigger validate_expense_trip_trigger before insert or update on public.expense_trips
for each row execute function public.validate_expense_detail();
create trigger validate_expense_item_trigger before insert or update on public.expense_items
for each row execute function public.validate_expense_detail();

create or replace function public.audit_expense_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_entity_id uuid := (v_row ->> 'id')::uuid;
  v_period_id uuid;
  v_entity_type text;
begin
  if tg_table_name in ('expense_trips', 'expense_items') then
    v_period_id := (v_row ->> 'period_id')::uuid;
  elsif tg_table_name = 'expense_trip_legs' then
    select period_id into v_period_id from public.expense_trips where id = (v_row ->> 'trip_id')::uuid;
  end if;
  v_entity_type := case tg_table_name
    when 'expense_trips' then 'trip'
    when 'expense_trip_legs' then 'trip_leg'
    when 'expense_items' then 'expense_item'
    when 'expense_vehicles' then 'vehicle'
  end;
  insert into public.expense_change_history (
    period_id, entity_type, entity_id, operation, actor_id, actor_source, before_data, after_data
  ) values (
    v_period_id, v_entity_type, v_entity_id, lower(tg_op), (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'crm' end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_expense_change() from public, anon, authenticated;

create trigger audit_expense_trip_trigger after insert or update or delete on public.expense_trips
for each row execute function public.audit_expense_change();
create trigger audit_expense_leg_trigger after insert or update or delete on public.expense_trip_legs
for each row execute function public.audit_expense_change();
create trigger audit_expense_item_trigger after insert or update or delete on public.expense_items
for each row execute function public.audit_expense_change();
create trigger audit_expense_vehicle_trigger after insert or update or delete on public.expense_vehicles
for each row execute function public.audit_expense_change();

create or replace function public.expense_child_edit_allowed(p_period_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.expense_periods period
    where period.id = p_period_id
      and period.user_id = p_user_id
      and period.status in ('draft', 'correction_required')
      and (period.user_id = (select auth.uid()) or (select public.is_active_admin()) or (select public.is_service_role_request()))
  );
$$;

revoke all on function public.expense_child_edit_allowed(uuid, uuid) from public, anon;
grant execute on function public.expense_child_edit_allowed(uuid, uuid) to authenticated, service_role;

create or replace function public.sync_expense_trip_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_trip_id uuid;
begin
  v_trip_id := coalesce(new.trip_id, old.trip_id);
  update public.expense_trips trip
  set total_km = coalesce((select sum(leg.kilometers) from public.expense_trip_legs leg where leg.trip_id = v_trip_id), 0),
      kilometers_manually_adjusted = false,
      updated_at = now()
  where trip.id = v_trip_id and trip.kilometers_manually_adjusted = false;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_expense_trip_total() from public, anon;
grant execute on function public.sync_expense_trip_total() to authenticated, service_role;

create trigger sync_expense_trip_total_trigger
after insert or update or delete on public.expense_trip_legs
for each row execute function public.sync_expense_trip_total();

create or replace function public.crm_last_action_dates(p_establishment_ids uuid[])
returns table (establishment_id uuid, last_action_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  select action.etablissement_id, max(action.date_action)
  from public.actions action
  where action.etablissement_id = any(p_establishment_ids)
  group by action.etablissement_id;
$$;

revoke all on function public.crm_last_action_dates(uuid[]) from public, anon, authenticated;
grant execute on function public.crm_last_action_dates(uuid[]) to service_role;

alter table public.expense_vehicles enable row level security;
alter table public.mileage_rate_brackets enable row level security;
alter table public.expense_periods enable row level security;
alter table public.expense_trips enable row level security;
alter table public.expense_trip_legs enable row level security;
alter table public.expense_trip_actions enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_period_history enable row level security;
alter table public.expense_adjustments enable row level security;
alter table public.expense_change_history enable row level security;

create policy "Expense vehicles visible to owner or admin" on public.expense_vehicles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_active_admin()));
create policy "Expense vehicles created by owner or admin" on public.expense_vehicles for insert to authenticated
with check (user_id = (select auth.uid()) or (select public.is_active_admin()));
create policy "Expense vehicles updated by owner or admin" on public.expense_vehicles for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_active_admin()))
with check (user_id = (select auth.uid()) or (select public.is_active_admin()));

create policy "Mileage rates visible to authenticated users" on public.mileage_rate_brackets for select to authenticated using (true);
create policy "Mileage rates managed by admins" on public.mileage_rate_brackets for all to authenticated
using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

create policy "Expense periods visible to owner or admin" on public.expense_periods for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_active_admin()));
create policy "Expense periods created by owner or admin" on public.expense_periods for insert to authenticated
with check (user_id = (select auth.uid()) or (select public.is_active_admin()));
create policy "Expense periods updated by owner or admin" on public.expense_periods for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_active_admin()))
with check (user_id = (select auth.uid()) or (select public.is_active_admin()));

create policy "Expense trips visible through period" on public.expense_trips for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_active_admin()));
create policy "Expense trips created while period editable" on public.expense_trips for insert to authenticated
with check (public.expense_child_edit_allowed(period_id, user_id));
create policy "Expense trips updated while period editable" on public.expense_trips for update to authenticated
using (public.expense_child_edit_allowed(period_id, user_id)) with check (public.expense_child_edit_allowed(period_id, user_id));
create policy "Expense trips deleted while period editable" on public.expense_trips for delete to authenticated
using (public.expense_child_edit_allowed(period_id, user_id));

create policy "Expense legs visible through trip" on public.expense_trip_legs for select to authenticated
using (exists (select 1 from public.expense_trips trip where trip.id = trip_id and (trip.user_id = (select auth.uid()) or (select public.is_active_admin()))));
create policy "Expense legs created in editable trip" on public.expense_trip_legs for insert to authenticated
with check (exists (select 1 from public.expense_trips trip where trip.id = trip_id and public.expense_child_edit_allowed(trip.period_id, trip.user_id)));
create policy "Expense legs updated in editable trip" on public.expense_trip_legs for update to authenticated
using (exists (select 1 from public.expense_trips trip where trip.id = trip_id and public.expense_child_edit_allowed(trip.period_id, trip.user_id)))
with check (exists (select 1 from public.expense_trips trip where trip.id = trip_id and public.expense_child_edit_allowed(trip.period_id, trip.user_id)));
create policy "Expense legs deleted in editable trip" on public.expense_trip_legs for delete to authenticated
using (exists (select 1 from public.expense_trips trip where trip.id = trip_id and public.expense_child_edit_allowed(trip.period_id, trip.user_id)));

create policy "Expense action links visible through trip" on public.expense_trip_actions for select to authenticated
using (exists (select 1 from public.expense_trips trip where trip.id = trip_id and (trip.user_id = (select auth.uid()) or (select public.is_active_admin()))));
create policy "Expense action links created in editable trip" on public.expense_trip_actions for insert to authenticated
with check (exists (select 1 from public.expense_trips trip where trip.id = trip_id and public.expense_child_edit_allowed(trip.period_id, trip.user_id)));
create policy "Expense action links deleted in editable trip" on public.expense_trip_actions for delete to authenticated
using (exists (select 1 from public.expense_trips trip where trip.id = trip_id and public.expense_child_edit_allowed(trip.period_id, trip.user_id)));

create policy "Expense categories visible to authenticated users" on public.expense_categories for select to authenticated using (true);
create policy "Expense categories managed by admins" on public.expense_categories for all to authenticated
using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

create policy "Expense items visible to owner or admin" on public.expense_items for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_active_admin()));
create policy "Expense items created while period editable" on public.expense_items for insert to authenticated
with check (public.expense_child_edit_allowed(period_id, user_id));
create policy "Expense items updated while period editable" on public.expense_items for update to authenticated
using (public.expense_child_edit_allowed(period_id, user_id)) with check (public.expense_child_edit_allowed(period_id, user_id));
create policy "Expense items deleted while period editable" on public.expense_items for delete to authenticated
using (public.expense_child_edit_allowed(period_id, user_id));

create policy "Expense period history visible to owner or admin" on public.expense_period_history for select to authenticated
using (exists (select 1 from public.expense_periods period where period.id = period_id and (period.user_id = (select auth.uid()) or (select public.is_active_admin()))));
create policy "Expense adjustments visible to owner or admin" on public.expense_adjustments for select to authenticated
using (exists (select 1 from public.expense_periods period where period.id = period_id and (period.user_id = (select auth.uid()) or (select public.is_active_admin()))));
create policy "Expense adjustments created by admins" on public.expense_adjustments for insert to authenticated
with check (
  (select public.is_active_admin())
  and exists (select 1 from public.expense_periods period where period.id = period_id and period.status = 'closed')
  and actor_id = (select auth.uid())
  and actor_source = 'crm'
);
create policy "Expense change history visible to owner or admin" on public.expense_change_history for select to authenticated
using (exists (select 1 from public.expense_periods period where period.id = period_id and (period.user_id = (select auth.uid()) or (select public.is_active_admin()))));

revoke all on public.expense_vehicles, public.mileage_rate_brackets, public.expense_periods,
  public.expense_trips, public.expense_trip_legs, public.expense_trip_actions,
  public.expense_categories, public.expense_items, public.expense_period_history,
  public.expense_adjustments, public.expense_change_history
from anon, authenticated;

grant select, insert, update on public.expense_vehicles to authenticated;
grant select, insert, update, delete on public.mileage_rate_brackets to authenticated;
grant select, insert, update on public.expense_periods to authenticated;
grant select, insert, update, delete on public.expense_trips, public.expense_trip_legs, public.expense_items to authenticated;
grant select, insert, delete on public.expense_trip_actions to authenticated;
grant select, insert, update, delete on public.expense_categories to authenticated;
grant select on public.expense_period_history, public.expense_change_history to authenticated;
grant select, insert on public.expense_adjustments to authenticated;
grant all on public.expense_vehicles, public.mileage_rate_brackets, public.expense_periods, public.expense_trips,
  public.expense_trip_legs, public.expense_trip_actions, public.expense_categories, public.expense_items,
  public.expense_period_history, public.expense_adjustments, public.expense_change_history to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts', 'expense-receipts', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Expense receipts readable by owner or admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_active_admin()))
);
create policy "Expense receipts uploaded by owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.expense_periods period
    where period.id::text = (storage.foldername(name))[2]
      and period.user_id = (select auth.uid())
      and period.status in ('draft', 'correction_required')
  )
);
create policy "Expense receipts updated by owner"
on storage.objects for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.expense_periods period where period.id::text = (storage.foldername(name))[2] and period.user_id = (select auth.uid()) and period.status in ('draft', 'correction_required'))
)
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.expense_periods period where period.id::text = (storage.foldername(name))[2] and period.user_id = (select auth.uid()) and period.status in ('draft', 'correction_required'))
);
create policy "Expense receipts deleted by owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.expense_periods period where period.id::text = (storage.foldername(name))[2] and period.user_id = (select auth.uid()) and period.status in ('draft', 'correction_required'))
);
