alter table public.expense_periods
  drop constraint if exists expense_periods_period_code_check;

alter table public.expense_periods
  add constraint expense_periods_period_code_check
  check (period_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
