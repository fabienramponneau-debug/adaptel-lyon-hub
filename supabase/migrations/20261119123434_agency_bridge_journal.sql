-- Journal technique du pont agence <-> CRM.
-- Cette table n'est jamais accessible depuis les navigateurs : seules les
-- Edge Functions qui utilisent la cle serveur peuvent y ecrire ou la lire.
create table public.agency_bridge_journal (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  direction text not null check (direction in ('agence_vers_crm', 'crm_vers_agence')),
  operation text not null,
  actor_agency_user_id uuid,
  actor_name text,
  status text not null default 'processing' check (status in ('processing', 'success', 'error')),
  response_status integer check (response_status between 100 and 599),
  response_body jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (request_id, direction)
);

create index agency_bridge_journal_started_at_idx
  on public.agency_bridge_journal (started_at desc);

create index agency_bridge_journal_operation_idx
  on public.agency_bridge_journal (operation, started_at desc);

alter table public.agency_bridge_journal enable row level security;

revoke all on public.agency_bridge_journal from anon, authenticated;
revoke all on public.agency_bridge_journal from public;

comment on table public.agency_bridge_journal is
  'Journal prive et idempotent des appels serveur entre l app agence et le CRM.';
