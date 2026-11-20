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
