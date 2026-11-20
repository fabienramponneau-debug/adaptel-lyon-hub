-- Objectifs financiers mensuels par commercial.
create table public.objectifs_financiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  period_code text not null check (period_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  objectif_ca numeric(14, 2) not null default 0 check (objectif_ca >= 0),
  objectif_marge numeric(14, 2) not null default 0 check (objectif_marge >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_code)
);

-- Realisations mensuelles detaillees par client. La colonne source permettra
-- au futur pont avec l'app agence de distinguer une saisie manuelle d'une synchro.
create table public.performances_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  etablissement_id uuid not null references public.establishments(id) on delete restrict,
  period_code text not null check (period_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  chiffre_affaires numeric(14, 2) not null default 0 check (chiffre_affaires >= 0),
  marge numeric(14, 2) not null default 0,
  source text not null default 'manuel' check (source in ('manuel', 'agence')),
  agency_client_id text,
  commentaire text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, etablissement_id, period_code)
);

alter table public.establishments
  add column if not exists siret text,
  add column if not exists agency_client_id text;

create unique index if not exists establishments_siret_unique
  on public.establishments (siret)
  where siret is not null and btrim(siret) <> '';

create index objectifs_financiers_period_user_idx
  on public.objectifs_financiers (period_code, user_id);
create index performances_clients_period_user_idx
  on public.performances_clients (period_code, user_id);
create index performances_clients_etablissement_idx
  on public.performances_clients (etablissement_id);

create trigger update_objectifs_financiers_updated_at
  before update on public.objectifs_financiers
  for each row execute function public.update_updated_at_column();
create trigger update_performances_clients_updated_at
  before update on public.performances_clients
  for each row execute function public.update_updated_at_column();

alter table public.objectifs_financiers enable row level security;
alter table public.performances_clients enable row level security;

grant select, insert, update, delete on public.objectifs_financiers to authenticated;
grant select, insert, update, delete on public.performances_clients to authenticated;

create policy "Financial targets visible to owner or admin"
  on public.objectifs_financiers for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles administrator
      where administrator.id = (select auth.uid())
        and administrator.role = 'admin'
        and administrator.actif = true
    )
  );

create policy "Financial targets inserted by admins"
  on public.objectifs_financiers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles administrator
      where administrator.id = (select auth.uid())
        and administrator.role = 'admin'
        and administrator.actif = true
    )
  );

create policy "Financial targets updated by admins"
  on public.objectifs_financiers for update
  to authenticated
  using (exists (select 1 from public.profiles administrator where administrator.id = (select auth.uid()) and administrator.role = 'admin' and administrator.actif = true))
  with check (exists (select 1 from public.profiles administrator where administrator.id = (select auth.uid()) and administrator.role = 'admin' and administrator.actif = true));

create policy "Financial targets deleted by admins"
  on public.objectifs_financiers for delete
  to authenticated
  using (exists (select 1 from public.profiles administrator where administrator.id = (select auth.uid()) and administrator.role = 'admin' and administrator.actif = true));

create policy "Client performance visible to owner or admin"
  on public.performances_clients for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles administrator
      where administrator.id = (select auth.uid())
        and administrator.role = 'admin'
        and administrator.actif = true
    )
  );

create policy "Client performance inserted by admins"
  on public.performances_clients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles administrator
      where administrator.id = (select auth.uid())
        and administrator.role = 'admin'
        and administrator.actif = true
    )
  );

create policy "Client performance updated by admins"
  on public.performances_clients for update
  to authenticated
  using (exists (select 1 from public.profiles administrator where administrator.id = (select auth.uid()) and administrator.role = 'admin' and administrator.actif = true))
  with check (exists (select 1 from public.profiles administrator where administrator.id = (select auth.uid()) and administrator.role = 'admin' and administrator.actif = true));

create policy "Client performance deleted by admins"
  on public.performances_clients for delete
  to authenticated
  using (exists (select 1 from public.profiles administrator where administrator.id = (select auth.uid()) and administrator.role = 'admin' and administrator.actif = true));
