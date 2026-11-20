# Complément à transmettre à Claude — cycle prospect/client et identité

Ce complément précise le rapprochement entre l'application agence et le CRM. Il ne faut encore déployer aucune migration ni Edge Function côté agence avant la remise de l'audit.

## Constat CRM vérifié

- Le CRM contient 1 055 prospects actifs, 58 clients actifs et 28 anciens clients.
- Céline est indiquée comme responsable de suivi de 1 091 fiches historiques, mais un seul client possède actuellement une attribution `client_triggered_by = Céline`.
- Aucune fiche CRM n'est encore liée à un identifiant client agence et aucune ne possède actuellement de SIRET.
- Le futur commercial doit donc démarrer avec un portefeuille personnel vide tout en pouvant consulter les anciennes fiches et leurs actions.

## Règles d'identité obligatoires

1. Le nom ou la raison sociale ne constitue jamais une clé de liaison automatique.
2. Le SIRET aide à proposer un rapprochement, mais tout cas ambigu exige une validation humaine.
3. Après rapprochement, l'identifiant client stable de l'app agence (`agency_client_id`) devient la clé technique de référence dans le CRM.
4. Le matricule ERP doit être conservé comme identifiant métier complémentaire, jamais comme substitut silencieux à l'identifiant agence. Merci d'indiquer son nom de colonne, son type et son unicité pendant l'audit.
5. Les codes commerciaux ERP (1 ACCOR, 3 Kibler, 4 Collectivité, 5 Céline, futur 6, etc.) servent aussi à des regroupements de reporting. Ils ne doivent pas être utilisés comme identifiant du commercial CRM et ne doivent pas être écrasés par la liaison CRM.

## Cycle métier cible

1. Le commercial crée et travaille un prospect dans le CRM. Toutes ses actions restent attachées à cette fiche.
2. Lorsque le prospect va réellement travailler avec ADAPTEL, sa fiche client complète est créée dans l'app agence.
3. Pendant cette création, l'utilisateur agence peut rechercher puis sélectionner explicitement le prospect CRM correspondant. La recherche peut proposer des candidats par nom, adresse, ville ou SIRET, mais ne valide jamais seule une liaison.
4. Après création réussie du client agence et obtention de son identifiant stable et de son matricule ERP, l'Edge Function agence appelle le pont CRM.
5. Le CRM met à jour la même fiche : statut `client`, `agency_client_id`, matricule ERP, SIRET confirmé, `client_triggered_by` et `client_triggered_at`. Il ne crée pas de doublon et conserve toutes les actions de prospection.
6. Si le client agence n'est issu d'aucun prospect CRM, l'utilisateur peut soit le laisser non lié, soit choisir explicitement de créer une fiche CRM client. Aucun rapprochement par nom seul.

## Portefeuille et historique

- `commercial_id` désigne le responsable de suivi actuel de la fiche.
- `client_triggered_by` désigne le commercial ayant réellement apporté le client et reste l'attribution utilisée pour ses résultats et ses primes.
- Le changement futur de responsable ne doit jamais modifier `client_triggered_by`.
- Le nouveau commercial voit par défaut uniquement « Mon portefeuille », initialement vide, et dispose séparément d'une « Base historique » consultable contenant les anciennes fiches et actions.
- Aucun transfert massif des 1 091 fiches de Céline ne doit être effectué automatiquement.

## Modification minimale attendue côté app agence

Pendant l'audit, déterminer l'emplacement le plus léger pour :

- conserver le lien vers `crm_establishment_id` ou un identifiant équivalent ;
- afficher dans la fiche client agence le commercial CRM apporteur lorsque le client est lié ;
- proposer la sélection du prospect CRM pendant ou juste après la création du client ;
- transmettre au CRM l'identifiant agence stable et le matricule ERP ;
- réutiliser ce lien pour les estimations mensuelles issues des plannings.

Il n'est pas demandé de renseigner un commercial CRM sur tous les clients agence existants. Seuls les clients réellement apportés et explicitement reliés doivent alimenter les indicateurs du commercial.

## Opérations API canoniques

Les noms sont désormais harmonisés :

- `list_unlinked_clients`
- `list_linkable_crm_prospects` à cadrer
- `link_client`
- `sync_planning_estimates`
- `get_crm_dashboard`
- `set_crm_objectives`
- `manage_crm_user`

Merci de préciser dans ton rapport le meilleur point d'intégration dans le parcours de création client agence, le nom exact du champ matricule ERP et les éventuelles contraintes de transaction ou de retour arrière.
