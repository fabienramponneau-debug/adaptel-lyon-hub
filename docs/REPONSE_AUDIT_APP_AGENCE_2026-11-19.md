# Réponse Codex à l'audit app agence du 19/11/2026

Ce document répond à `adaptel-app-simple/docs/crm/AUDIT_APP_AGENCE_LIAISON_CRM.md`. Claude peut l'utiliser comme décision de cadrage à jour pour poursuivre le travail local côté app agence. Aucun déploiement du pont ne doit être fait tant que les secrets ne sont pas configurés dans les deux projets.

## Décisions métier Q1 à Q4

### Q1 — Marge estimée planning

Décision : envoyer uniquement le CA estimé pour la V1. `estimatedMargin` doit être `null`, jamais `0`, afin de ne pas faire croire à une marge nulle. Le CRM conserve séparément :

- la marge prévisionnelle saisie par le commercial ;
- la marge réelle consolidée saisie par Fabien ;
- la marge planning comme « non disponible » tant qu'un véritable coût de revient n'est pas défini.

### Q2 — Clients historiques

Décision : un rapprochement historique n'ouvre aucun droit à prime. `link_client` exige maintenant un `linkMode` explicite :

- `new_business` : nouveau client réellement déclenché par le commercial, attribution et date de départ des primes ;
- `historical_match` : client qui travaillait déjà avec ADAPTEL, simple rapprochement technique, aucune nouvelle attribution et aucune prime.

Le mode ne doit jamais être déduit automatiquement du nom ou du statut.

### Q3 — SIRET dans l'app agence

Décision mise à jour : le SIRET est conservé dans les deux applications. L'ajout côté agence est additif et utile pour les conventions comme pour le contrôle du rapprochement. Il reste facultatif, validé sur 14 chiffres et ne provoque jamais seul une liaison automatique.

### Q4 — Compte agence du commercial

Décision : oui, le nouveau commercial aura à terme un compte agence limité de rôle `user`, nécessaire pour son affichage dans le module Équipe. Ce compte ne doit lui donner aucun droit d'administration CRM dans l'app agence. Ce point ne bloque pas les premières étapes du pont ; il devient nécessaire avant la surimpression du calendrier.

## Autres arbitrages

- Le matricule ERP reste obligatoire pour créer une liaison fiable. Les 21 clients agence sans matricule devront recevoir un matricule avant rapprochement.
- `agency_client_id` correspond exactement à `clients.id`, transmis comme texte.
- Le matricule `clients.matricule_erp` reste du texte ; aucune conversion numérique.
- Les anciens clients CRM sont proposés avec les prospects dans la recherche de fiches à rapprocher.
- L'app agence ne stocke pas une copie de la liaison : elle utilise `list_linked_clients`.
- Les actions d'activité du tableau de bord correspondent aux actions `effectue`. Les actions à venir servent à la planification, pas au reporting réalisé.
- Les chiffres réels consolidés restent saisis et clôturés dans le CRM à partir de l'ERP.
- Deux secrets séparés par sens sont acceptés : `CRM_AGENCY_SYNC_SECRET` pour agence vers CRM et `AGENCY_CRM_SYNC_SECRET` pour CRM vers agence.

## Corrections déjà effectuées côté CRM

- La fin de période du tableau de bord utilise désormais le premier jour du mois suivant en borne exclusive ; novembre et février ne produisent plus de date invalide.
- `link_client` distingue nouveau client et rapprochement historique.
- La recherche de conflit de matricule utilise une égalité exacte.
- `list_linkable_crm_prospects` inclut aussi les anciens clients.
- L'opération `list_linked_clients` est préparée.
- `sync_planning_estimates` accepte une marge inconnue (`null`).
- Le Supabase CRM accepte désormais `marge_estimee_planning = null`.
- Le reporting CRM permet à l'admin de choisir le commercial directement dans les blocs financiers.
- Le suivi mensuel dispose d'une recherche rapide par nom pour les clients et prospects.

## Objectifs financiers : règle d'interface

L'objectif admin CA/marge est global par commercial et par mois. Fabien le saisit directement dans « Objectifs financiers annuels » ; il n'est pas ventilé obligatoirement client par client.

Le tableau « Suivi mensuel par client » sert à :

- détailler le prévisionnel du commercial ;
- afficher l'estimation CA du planning ;
- saisir puis clôturer les chiffres réels par client ;
- expliquer l'écart entre l'objectif global et le portefeuille prévu/réalisé.

## Suite autorisée côté Claude

Claude peut poursuivre les développements additifs locaux côté app agence : journal du pont, fonctions `crm-pont` et `crm-agence-entrant`, services frontend et écrans admin. Il ne doit ni déployer ni activer l'interface tant que Codex et Fabien n'ont pas configuré les secrets et validé l'appel de test.

La liaison lors de la création d'un client reste non bloquante : une panne CRM ne doit jamais empêcher la création du client agence.

## Historique CA/marge mensuel

Décision : oui, créer `clients_historique_mensuel` dans l'app agence comme future source unique des réels mensuels de tous les clients. Prévoir au minimum : client, mois, CA, marge brute, source (`saisie` ou `import_erp`), état brouillon/confirmé, auteur et dates de saisie/clôture, avec une contrainte unique client × mois et un historique des modifications.

Pendant la transition, la saisie CRM actuelle reste disponible pour la présentation et les vérifications. Ensuite, seuls les mois confirmés dans l'app agence sont envoyés au CRM pour les clients reliés, avec `source = 'agence'`, afin d'éviter toute double saisie.
