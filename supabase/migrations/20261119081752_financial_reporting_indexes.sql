create index if not exists establishments_commercial_idx
  on public.establishments (commercial_id);

create index if not exists establishments_client_triggered_by_idx
  on public.establishments (client_triggered_by);

create index if not exists performances_clients_cloture_by_idx
  on public.performances_clients (cloture_by);
