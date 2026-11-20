-- Indexes couvrant les clés étrangères du module Notes de frais.
create index if not exists expense_adjustments_actor_idx
  on public.expense_adjustments (actor_id) where actor_id is not null;
create index if not exists expense_change_history_actor_idx
  on public.expense_change_history (actor_id) where actor_id is not null;
create index if not exists expense_period_history_actor_idx
  on public.expense_period_history (actor_id) where actor_id is not null;
create index if not exists expense_periods_submitted_by_idx
  on public.expense_periods (submitted_by) where submitted_by is not null;
create index if not exists expense_periods_reviewed_by_idx
  on public.expense_periods (reviewed_by) where reviewed_by is not null;
create index if not exists expense_periods_validated_by_idx
  on public.expense_periods (validated_by) where validated_by is not null;
create index if not exists expense_periods_closed_by_idx
  on public.expense_periods (closed_by) where closed_by is not null;
