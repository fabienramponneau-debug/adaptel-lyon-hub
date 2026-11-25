# Publication securisee — CRM V1 financier

La migration financière V1, ses fonctions Edge et la planification attendent la fenêtre de publication commune avec l’App Agence.

La migration d’attribution commerciale est déjà appliquée. Son SQL dans le journal Supabase est identique au fichier du dépôt, désormais nommé `20261123165220_unify_commercial_assignment.sql`. L’ancien identifiant local était `20261123164449`.

Le journal distant présente d’autres écarts historiques. Pour cette publication, exécuter uniquement le fichier V1 `20261124120000_crm_v1_financial_alignment.sql` sur le projet CRM et enregistrer cette version après succès si le mécanisme d’application ciblée ne l’a pas déjà fait. Un `db push` global doit attendre la réconciliation de l’ensemble des versions.

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

1. Confirmer que l’App Agence est prête et valider le comptage des primes historiques.
2. Appliquer les migrations V1 ciblées sur chaque projet avant leurs fonctions Edge. Vérifier le journal CRM, puis comparer les types régénérés à `src/integrations/supabase/types.ts`.
3. Déployer `agency-crm-bridge` avant le pont sortant Agence qui l’appelle. Tester `get_commission_rules` et le rapport annuel.
4. Déployer `crm-agence-entrant` côté Agence et vérifier les deux contrats de la section 3. Déployer ensuite `sync-agency-actuals` avec la planification désactivée.
5. Tester un client sur un mois, le rejet d’un lot invalide et le rapprochement assisté. Publier les interfaces lorsque leurs dépendances SQL et Edge sont disponibles.
6. Terminer la recette commune sur octobre 2026 avant d’activer la synchronisation quotidienne. Configurer `SYNC_AGENCY_ACTUALS_CRON_SECRET` et contrôler `agency_bridge_journal` après le premier passage.

## 5. Criteres de non-publication

Ne pas publier si une seule des conditions suivantes est vraie : contrat agence encore ambigu (`margin` seul), snapshot de prime manquant, ecart non explique avec le reporting precedent, doublon financier, RLS ouverte sur `commission_rules`, secret absent, test de relecture non idempotent, ou build/tests non verts.
