-- Prévisions mensuelles détaillées par client. Le total commercial est toujours
-- calculé depuis ces lignes et n'est jamais saisi séparément.
create table public.previsions_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  etablissement_id uuid not null references public.establishments(id) on delete cascade,
  period_code text not null check (period_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  chiffre_affaires_previsionnel numeric(14, 2) not null default 0 check (chiffre_affaires_previsionnel >= 0),
  marge_previsionnelle numeric(14, 2) not null default 0,
  commentaire text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, etablissement_id, period_code)
);

create index previsions_clients_period_user_idx
  on public.previsions_clients (period_code, user_id);
create index previsions_clients_etablissement_idx
  on public.previsions_clients (etablissement_id);

create trigger update_previsions_clients_updated_at
  before update on public.previsions_clients
  for each row execute function public.update_updated_at_column();

alter table public.previsions_clients enable row level security;
grant select, insert, update, delete on public.previsions_clients to authenticated;

create policy "Forecasts visible to owner or admin"
  on public.previsions_clients for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  );

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
          and (e.commercial_id = (select auth.uid()) or e.client_triggered_by = (select auth.uid()))
      )
    )
  );

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
          and (e.commercial_id = (select auth.uid()) or e.client_triggered_by = (select auth.uid()))
      )
    )
  );

create policy "Forecasts deleted by owner or admin"
  on public.previsions_clients for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  );

-- Les performances existantes deviennent les chiffres réels. Seul un admin
-- peut les saisir et clôturer ; l'app agence peut les synchroniser côté serveur.
alter table public.performances_clients
  add column if not exists statut_cloture text not null default 'brouillon'
    check (statut_cloture in ('brouillon', 'confirme')),
  add column if not exists cloture_at timestamptz,
  add column if not exists cloture_by uuid references public.profiles(id) on delete set null;

create index performances_clients_cloture_idx
  on public.performances_clients (period_code, user_id, statut_cloture);
