# Prompt à transmettre à Claude — audit app agence / liaison CRM

Tu as en charge exclusivement le dépôt et le Supabase de l’application agence `adaptel-app-simple`. Codex gère le dépôt CRM `adaptel-lyon-hub` et le Supabase CRM `adaptel-lyon-crm` (`hwkhaxawsqvgarxlqzzd`). Ne modifie pas le code, les migrations, les politiques RLS ni les Edge Functions du CRM.

## Objectif

Auditer l’application agence afin de préparer une liaison serveur-à-serveur simple, sécurisée et maintenable avec le CRM. Le navigateur de l’app agence ne doit jamais se connecter directement au Supabase CRM et aucune clé `service_role` ou secret partagé ne doit parvenir au frontend.

Le CRM distingue obligatoirement quatre niveaux financiers :

1. objectif CA/marge fixé par l’administrateur ;
2. prévision commerciale saisie par le commercial, détaillée par client ou prospect ;
3. estimation CA/marge issue des plannings de l’app agence ;
4. CA et marge réels consolidés et clôturés par l’administrateur.

Ces valeurs ne doivent jamais s’écraser entre elles. Le total commercial est calculé comme la somme des clients/prospects, jamais saisi indépendamment. Le taux de marge correspond à `marge / CA * 100`.

## Phase 1 — audit obligatoire avant mutation

Inspecte le dépôt, le Supabase agence et les Edge Functions existantes, puis rends un rapport factuel indiquant :

- la table qui représente le client agence et son identifiant stable ;
- les champs SIRET, raison sociale et établissements/sites disponibles ;
- les tables de planning, missions, heures et tarifs utilisées pour estimer le CA ;
- la fonction ou requête existante qui calcule déjà le CA estimé ;
- la source disponible pour estimer la marge et le taux de marge ;
- la source des chiffres réels après clôture mensuelle ;
- le fonctionnement actuel du module Équipe et des calendriers utilisateurs ;
- où intégrer les absences agence du commercial liées à la prospection, aux visites et aux rendez-vous clients ;
- le modèle actuel des administrateurs agence et la vérification `role + actif` côté serveur ;
- les Edge Functions et secrets existants qui peuvent être réutilisés ;
- les risques de doublons ou d’ambiguïtés entre client, établissement, SIRET et identifiant CRM.

Ne crée aucune nouvelle table de production et ne déploie aucune fonction pendant cette première phase. Ne réimplémente pas un calcul déjà fiable dans l’app agence.

## Contrat CRM déjà préparé

Le CRM possède :

- `establishments.agency_client_id` pour l’identifiant stable agence ;
- `establishments.siret` pour aider au rapprochement initial ;
- `establishments.commercial_id` pour le commercial qui suit le portefeuille ;
- `establishments.client_triggered_by` et `client_triggered_at` pour le commercial ayant réellement déclenché le client ;
- `objectifs_financiers` pour les objectifs admin mensuels ;
- `previsions_clients` pour les prévisions commerciales et les estimations planning séparées ;
- `performances_clients` pour les chiffres réels et leur clôture ;
- `financial_change_history` pour l’historique immuable des modifications.

Une Edge Function CRM `agency-crm-bridge` est préparée localement mais pas encore déployée. Elle utilisera un secret commun `CRM_AGENCY_SYNC_SECRET` dans les secrets Supabase des deux projets et l’en-tête serveur `x-adaptel-sync-secret`.

Opérations prévues :

- `list_unlinked_clients` : clients CRM non rapprochés ;
- `link_client` : liaison explicite client CRM ↔ client agence ;
- `sync_planning_estimates` : envoi par client et mois de `estimatedRevenue` et `estimatedMargin` ;
- `get_crm_dashboard` : lecture des indicateurs CRM depuis l’app agence ;
- `set_crm_objectives` : mise à jour admin des objectifs CRM ;
- `manage_crm_user` : gestion serveur des utilisateurs CRM.

Exemple de synchronisation planning :

```json
{
  "operation": "sync_planning_estimates",
  "items": [
    {
      "agencyClientId": "identifiant-stable-agence",
      "periodCode": "2026-11",
      "estimatedRevenue": 12500,
      "estimatedMargin": 2875
    }
  ]
}
```

## Architecture attendue côté agence

- Une Edge Function agence authentifie la session agence.
- Elle lit le profil agence et exige un administrateur actif pour les opérations de gestion.
- Elle appelle l’Edge Function CRM uniquement côté serveur.
- Le secret partagé reste dans les secrets Supabase, jamais dans Git, le navigateur ou les logs.
- Les synchronisations financières utilisent une clé d’idempotence et retournent le détail des clients non rapprochés.
- Le rapprochement initial doit être explicite et contrôlable ; ne jamais fusionner automatiquement deux clients uniquement parce que leurs noms se ressemblent.
- L’app agence doit réutiliser ses calculs de planning existants au lieu de les recopier dans le CRM.

## Livrable demandé

Rends :

1. un schéma précis des tables et fonctions existantes à réutiliser ;
2. la formule exacte actuellement utilisée pour le CA estimé et, si elle existe, la marge estimée ;
3. la stratégie de rapprochement des clients avec statistiques : correspondances sûres, ambiguës et impossibles ;
4. la liste des fichiers qui devront être modifiés côté app agence ;
5. le plan d’implémentation par petites étapes, avec tests et retour arrière ;
6. les questions métier réellement bloquantes ;
7. la proposition pour afficher la gestion CRM dans l’app agence sans dupliquer les données ;
8. la proposition d’intégration du calendrier commercial dans le module Équipe.

Préserve strictement les fonctionnalités actuelles de l’app agence. Pas de refonte générale, pas de fusion des deux Supabase, pas de dépendance directe du frontend agence vers le CRM.
