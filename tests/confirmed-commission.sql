-- À exécuter après la migration V1 dans une transaction de recette annulée.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000101', 'prime-admin@example.invalid', '{"role":"admin"}'),
  ('00000000-0000-4000-8000-000000000102', 'prime-apporteur@example.invalid', '{}');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

insert into public.establishments (id, nom, commercial_id, client_triggered_by, client_triggered_at)
values ('00000000-0000-4000-8000-000000000103', 'Recette prime',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102', '2025-01-04T12:00:00Z');

set local role authenticated;

do $$
declare
  performance_id constant uuid := '00000000-0000-4000-8000-000000000104';
  apporteur constant uuid := '00000000-0000-4000-8000-000000000102';
  snapshot public.performances_clients%rowtype;
begin
  insert into public.performances_clients
    (id, user_id, etablissement_id, period_code, chiffre_affaires, marge, statut_cloture, source)
  values (performance_id, auth.uid(), '00000000-0000-4000-8000-000000000103',
    '2025-01', 200, 100, 'confirme', 'manuel');

  update public.performances_clients set prime_montant = 999 where id = performance_id;
  update public.performances_clients set prime_taux = 0.99 where id = performance_id;
  update public.performances_clients set prime_beneficiaire_id = auth.uid() where id = performance_id;

  select * into strict snapshot from public.performances_clients where id = performance_id;
  if (snapshot.prime_beneficiaire_id, snapshot.prime_taux, snapshot.prime_montant)
      is distinct from (apporteur, 0.07::numeric, 7::numeric) then
    raise exception 'Un administrateur a modifié directement une prime confirmée';
  end if;

  update public.performances_clients set statut_cloture = 'brouillon' where id = performance_id;
  select * into strict snapshot from public.performances_clients where id = performance_id;
  if snapshot.prime_beneficiaire_id is not null or snapshot.prime_taux is not null
      or snapshot.prime_montant is not null then
    raise exception 'La réouverture n’a pas vidé le snapshot';
  end if;

  update public.performances_clients set marge = 200 where id = performance_id;
  update public.performances_clients set statut_cloture = 'confirme' where id = performance_id;
  select * into strict snapshot from public.performances_clients where id = performance_id;
  if (snapshot.prime_beneficiaire_id, snapshot.prime_taux, snapshot.prime_montant)
      is distinct from (apporteur, 0.07::numeric, 14::numeric) then
    raise exception 'La confirmation après correction n’a pas recalculé la prime';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
