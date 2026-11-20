alter table public.previsions_clients
  alter column marge_estimee_planning drop not null,
  alter column marge_estimee_planning drop default;
