# Publication securisee — CRM V1 financier

Etat : code prepare uniquement. Aucune migration appliquee, aucune Edge Function deployee, aucune planification activee.

## 1. Pre-controles obligatoires

Sur une copie de la base ou en environnement local restaure depuis un schema representatif :

1. noter le nombre de lignes `performances_clients` confirmees, par source ;
2. noter le nombre de fiches avec `client_triggered_by` et `client_triggered_at` ;
3. rechercher les doublons `etablissement_id, period_code` et `agency_client_id, period_code` ;
4. verifier que toutes les attributions historiques ont un `changed_at` coherent ;
5. sauvegarder les resultats du reporting annuel avant migration pour comparaison.

## 2. Essai de migration avec annulation

Executer `20261124120000_crm_v1_financial_alignment.sql` dans une transaction sur la copie, puis verifier avant `rollback` :

```sql
select source, statut_cloture, count(*)
from public.performances_clients
group by source, statut_cloture;

select count(*) filter (where prime_montant is null) as snapshots_manquants,
       sum(prime_montant) as total_primes
from public.performances_clients
where statut_cloture = 'confirme';

select effective_from, month_from, month_to, base_rate, bonus_rate
from public.commission_rules
order by effective_from, month_from;

select relname, relrowsecurity
from pg_class
where relname = 'commission_rules';
```

Tests SQL a jouer dans la meme transaction :

- mois 1, 12, 13, 24 et 25 : taux respectifs 7 %, 7 %, 4 %, 4 %, 3 % ;
- marge negative : prime nulle ;
- transfert de `commercial_id` : beneficiaire confirme inchange ;
- ajout d'un nouveau bareme : ancien mois confirme inchange ;
- tentative navigateur de modifier une ligne `source = 'agence'` : refusee ;
- relecture d'un reel agence identique : aucune mise a jour ;
- nouvelle confirmation plus recente : mise a jour et nouveau snapshot ;
- puis `rollback` et controle que le schema initial est intact.

## 3. Compatibilite App Agence

Avant de deployer `sync-agency-actuals`, Cursor doit confirmer les deux contrats de `CURSOR_CRM_V1_HANDOFF.md` :

- `list_monthly_actuals` avec `marginBeforeCet`, `marginAfterCet`, `hoursBilled`, `confirmedAt` ;
- `search_agency_clients { q }`.

Tant que ces champs ne sont pas disponibles, ne lancer aucune synchronisation : le CRM refusera le lot sans ecriture plutot que de confondre avant et apres CET.

## 4. Ordre de publication

1. Validation explicite de Fabien sur le comptage et la comparaison des primes historiques.
2. Application de la migration CRM uniquement.
3. Regeneration des types Supabase et comparaison avec `src/integrations/supabase/types.ts`.
4. Deploiement de `agency-crm-bridge` et tests lecture (`get_commission_rules`, rapport annuel).
5. Deploiement de `sync-agency-actuals`, sans planification, puis test cible sur un client et un mois.
6. Recette rapprochement assiste : recherche, annulation, confirmation, doublon refuse.
7. Recette commune Cursor/Codex sur octobre 2026.
8. Creation de `SYNC_AGENCY_ACTUALS_CRON_SECRET` et activation de l'appel quotidien avec le meme secret dans `x-adaptel-cron-secret`.
9. Controle des journaux `agency_bridge_journal` apres le premier passage.

## 5. Criteres de non-publication

Ne pas publier si une seule des conditions suivantes est vraie : contrat agence encore ambigu (`margin` seul), snapshot de prime manquant, ecart non explique avec le reporting precedent, doublon financier, RLS ouverte sur `commission_rules`, secret absent, test de relecture non idempotent, ou build/tests non verts.
