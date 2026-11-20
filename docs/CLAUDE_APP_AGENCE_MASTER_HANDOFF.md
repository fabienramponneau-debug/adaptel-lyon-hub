# Message complet à transmettre à Claude — App agence ↔ CRM ADAPTEL

Ce message remplace et consolide les précédents prompts. Tu as en charge uniquement le dépôt et le Supabase de l'application agence `adaptel-app-simple`. Codex gère le CRM `adaptel-lyon-hub` et le Supabase `adaptel-lyon-crm` (`hwkhaxawsqvgarxlqzzd`). Ne modifie pas directement le code, les migrations, les politiques RLS ou les fonctions du CRM.

## Objectif général

Faire évoluer les deux applications comme une suite cohérente sans fusionner leurs bases :

- l'app agence reste la source principale pour les clients opérationnels, plannings, tarifs, CA estimé et données réelles ;
- le CRM reste la source principale pour les prospects, actions commerciales, objectifs, prévisionnels, attribution commerciale et reporting du commercial ;
- Fabien doit pouvoir consulter et administrer le CRM depuis l'app agence ;
- les calculs fiables déjà présents dans l'app agence doivent être réutilisés, jamais recopiés dans un second moteur ;
- aucune clé `service_role` ni secret partagé ne doit arriver dans un navigateur.

## État actuel du CRM déjà réalisé

- Gestion des utilisateurs CRM depuis l'application : création, rôles, actif/inactif.
- Objectifs financiers mensuels et vue annuelle.
- Prévisionnel commercial détaillé par client ou prospect.
- Estimation planning séparée, destinée à recevoir les calculs de l'app agence.
- CA et marge réels saisis puis clôturés par l'administrateur.
- Taux de marge calculé avec `marge / CA × 100`.
- Tableau de bord comparant objectif, prévisionnel, estimation planning et réel.
- Historique immuable des modifications financières.
- Portefeuille personnel distinct de la base historique.
- Un commercial peut reprendre volontairement une ancienne fiche dans son portefeuille sans perdre son historique.
- Les actions de l'ancien commercial restent visibles mais non modifiables par le nouveau commercial. Chacun peut modifier ses propres actions ; l'administrateur conserve un droit de correction.
- Toute réattribution d'une fiche est historisée.

Constat réel dans la base CRM : Céline est responsable de suivi de 1 091 fiches historiques — 1 034 prospects, 35 clients et 22 anciens clients — mais un seul client est actuellement identifié comme réellement déclenché par elle. Aucune réattribution massive au nouveau commercial ne doit être faite.

## Cycle prospect → client

1. Le commercial prépare son activité dans le CRM et crée ses prospects avant ses visites, appels ou mailings.
2. S'il trouve une fiche déjà présente dans la base historique, il peut l'ajouter à son portefeuille, modifier les informations générales et poursuivre le suivi.
3. Les anciennes actions restent attachées à la fiche et sont non modifiables par lui. Ses nouvelles actions s'ajoutent à la suite.
4. Quand le prospect commence réellement à travailler avec ADAPTEL, sa fiche client complète est créée dans l'app agence.
5. Pendant cette création, l'utilisateur agence recherche et sélectionne explicitement le prospect CRM correspondant.
6. Après création réussie du client agence, l'Edge Function agence transmet au CRM : identifiant client agence stable, matricule ERP, SIRET confirmé et identifiant de la fiche CRM.
7. Le CRM transforme la même fiche en client, conserve toutes les actions et fixe `client_triggered_by` et `client_triggered_at`. Aucun doublon n'est créé.
8. Si le client agence n'est issu d'aucun prospect CRM, il peut rester non lié ou faire l'objet d'une création CRM explicitement validée.

## Identité et rapprochement client

Le nom ne doit jamais provoquer une liaison automatique. Les raisons sociales peuvent différer entre le CRM et l'app agence.

- `agency_client_id` : identifiant technique stable de la fiche client agence ;
- `erp_client_code` : matricule client ERP, utilisé comme identifiant métier visible ;
- `siret` : élément de contrôle supplémentaire ;
- nom, adresse et ville : uniquement pour présenter des candidats à l'utilisateur.

Le CRM garantit l'unicité de `agency_client_id` et du matricule ERP. Une liaison est refusée si l'un des deux est déjà rattaché à une autre fiche CRM.

Parcours souhaité également côté CRM : le commercial peut saisir un matricule client agence, mais ce ne doit pas être une saisie libre aveugle. Une Edge Function CRM doit interroger une fonction serveur de l'app agence, retrouver exactement le client par matricule, retourner son nom/adresse/SIRET pour confirmation, puis seulement enregistrer la liaison.

Merci d'identifier pendant l'audit :

- la table client agence ;
- son identifiant stable ;
- le nom exact et le type du champ matricule ERP ;
- son unicité réelle ;
- le meilleur point d'intégration dans le formulaire de création client ;
- les éventuels cas multi-sites ou SIRET ambigus.

## Codes commerciaux ERP

Les codes ERP ne correspondent pas toujours à une personne :

- 1 : Groupe ACCOR ;
- 3 : KIBLER Christophe, regroupement de nombreux clients hors catégories spécifiques ;
- 4 : Collectivité ;
- 5 : BARRE Céline ;
- 9 : RAMPONNEAU Fabien, plus utilisé ;
- futur commercial : probablement code 6.

Ces codes servent aussi à des regroupements et extractions ERP. Ils ne doivent pas devenir l'identifiant du commercial CRM et ne doivent pas être écrasés. Un client ACCOR ou Collectivité apporté par le nouveau commercial doit pouvoir conserver sa classification ERP tout en étant attribué au nouveau commercial dans le CRM.

Il n'est pas nécessaire de renseigner un commercial CRM sur tous les clients agence existants. Seuls les clients réellement apportés et explicitement reliés alimentent ses résultats et ses primes.

## Les quatre niveaux financiers, strictement séparés

1. Objectif admin : fixé par Fabien, non modifiable par le commercial.
2. Prévisionnel commercial : estimations du commercial par client ou prospect, avec historique de chaque modification.
3. Estimation planning : CA, marge et taux calculés depuis les plannings de l'app agence.
4. Réel consolidé : CA et marge définitifs après clôture mensuelle validée par Fabien.

La comparaison finale de référence est objectif admin contre réel consolidé. Le prévisionnel et l'estimation planning servent au pilotage avant clôture. Le total d'un commercial est toujours la somme de ses clients/prospects, jamais un total saisi indépendamment.

## Variables commerciales confirmées

Assiette : marge réelle consolidée du client, uniquement après validation de la clôture mensuelle.

- mois 1 à 12 suivant le déclenchement du client : 5 % de prime + bonus de 2 %, soit 7 % de la marge ;
- mois 13 à 24 : 4 % de la marge ;
- à partir du mois 25 : 3 % de la marge ;
- le taux reste ensuite à 3 % tant que le client génère du CA et de la marge.

Les prévisions et estimations planning ne déclenchent jamais une prime réelle. Le CRM pourra afficher une simulation clairement identifiée, mais la prime due repose exclusivement sur les valeurs consolidées. La date de départ est `client_triggered_at`.

## Pont serveur-à-serveur

Le CRM possède localement une Edge Function `agency-crm-bridge`, non encore déployée. Elle attend un secret `CRM_AGENCY_SYNC_SECRET` dans les secrets Supabase des deux projets et l'en-tête serveur `x-adaptel-sync-secret`.

Opérations CRM canoniques :

- `list_linkable_crm_prospects`
- `list_unlinked_clients`
- `link_client`
- `sync_planning_estimates`
- `get_crm_dashboard`
- `set_crm_objectives`
- `manage_crm_user`

L'app agence doit avoir sa propre Edge Function authentifiée qui :

1. vérifie la session agence ;
2. lit le profil agence ;
3. exige `role = admin` et `actif = true` pour les opérations d'administration ;
4. appelle le CRM uniquement côté serveur ;
5. ne journalise jamais le secret ;
6. utilise une clé d'idempotence pour les synchronisations.

Pour la recherche par matricule déclenchée depuis le CRM, prévoir côté agence une opération serveur en lecture seule du type `resolve_agency_client_by_erp_code`, protégée par le même principe serveur-à-serveur. Elle doit retourner un résultat unique et officiel ou une erreur explicite, jamais une correspondance approximative silencieuse.

## Audit demandé côté app agence

Avant toute migration ou déploiement, fournir un rapport factuel sur :

- tables clients, SIRET, sites, matricule ERP et identifiants stables ;
- tables de planning, missions, heures, tarifs, coefficients et calculs de CA existants ;
- calcul actuel de marge ou données disponibles pour le produire ;
- source des chiffres réels après clôture mensuelle ;
- module Équipe et calendrier des utilisateurs agence ;
- intégration possible des absences du commercial liées aux prospections, visites et rendez-vous ;
- modèle admin/agence et Edge Functions existantes réutilisables ;
- risques de doublons, cas multi-sites et rapprochements ambigus ;
- fichiers précis à modifier et stratégie de retour arrière.

## Écrans attendus à terme dans l'app agence

- Gestion des utilisateurs CRM.
- Objectifs du commercial par mois et année.
- Reporting activité : prospection, phoning, mailing, visites, rendez-vous, nouveaux clients.
- Comparatif objectif/prévision/planning/réel, CA, marge et taux de marge.
- Résultats par client du commercial.
- Consultation des variables calculées sur les chiffres consolidés.
- Rapprochement explicite client agence ↔ prospect/client CRM.
- Calendrier commercial intégré au module Équipe.

## Autres évolutions CRM prévues

- Version mobile optimisée pour les prospections et comptes rendus.
- Génération de conventions de mise à disposition depuis un prospect ou client CRM à partir d'une trame Word de neuf pages.
- Personnalisation logo, coordonnées, SIRET, postes, taux horaires et coefficients.
- Envoi par mail puis signature numérique avec authentification SMS, en réutilisant autant que possible les fonctions déjà présentes dans l'app agence.

Ces évolutions ne doivent pas ralentir le pont financier et client actuel.

## Livrable immédiat attendu de Claude

1. Rapport d'audit factuel du dépôt et du Supabase agence.
2. Mapping exact des identifiants client agence, matricule ERP, SIRET et client CRM.
3. Formules existantes de CA et marge à réutiliser.
4. Proposition minimale des Edge Functions agence.
5. Liste des fichiers et migrations agence nécessaires.
6. Plan d'implémentation en petites étapes testables, sans régression.
7. Questions métier réellement bloquantes uniquement.

Préserver strictement l'app agence actuelle. Pas de fusion des Supabase, pas de connexion directe du frontend agence au CRM, pas de réécriture d'un calcul déjà existant et pas de rapprochement automatique par nom.
