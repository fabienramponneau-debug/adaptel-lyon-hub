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
