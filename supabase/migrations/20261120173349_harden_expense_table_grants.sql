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
