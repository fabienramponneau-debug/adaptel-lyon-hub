alter table public.previsions_clients
  add column if not exists chiffre_affaires_estime_planning numeric(14, 2) not null default 0
    check (chiffre_affaires_estime_planning >= 0),
  add column if not exists marge_estimee_planning numeric(14, 2) not null default 0,
  add column if not exists planning_synced_at timestamptz;
