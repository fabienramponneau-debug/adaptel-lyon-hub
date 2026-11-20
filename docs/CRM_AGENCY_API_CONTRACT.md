# Contrat d'integration App agence -> ADAPTEL CRM

## Responsabilites

- Le depot `adaptel-lyon-hub` et le Supabase `adaptel-lyon-crm` restent la source de verite du CRM.
- Le depot `adaptel-app-simple` et son Supabase restent geres independamment.
- L'application agence ne se connecte jamais directement au Supabase CRM depuis le navigateur.
- Claude implemente le pont cote application agence sous la forme d'une Edge Function reservee aux administrateurs agence.
- Le CRM exposera les operations necessaires par une Edge Function serveur-a-serveur. Un secret partage sera stocke dans les secrets Supabase des deux projets, jamais dans le frontend ni dans Git.

Implementation CRM : `supabase/functions/agency-crm-bridge/index.ts`. La fonction
et son journal ont ete deployes le 19/11/2026. Tant que le secret
`CRM_AGENCY_SYNC_SECRET` n'est pas configure dans les deux projets, le endpoint
refuse les appels avec l'etat « non configure ».

Chaque appel agence contient un `requestId` UUID et un acteur agence. Le CRM
les conserve dans `agency_bridge_journal`. Une nouvelle tentative avec le meme
`requestId` restitue la reponse deja calculee et ne rejoue pas l'ecriture.

## Identifiants de rapprochement

La table CRM `public.establishments` contient desormais :

- `agency_client_id text` : identifiant stable du client dans l'application agence ;
- `erp_client_code text` : matricule client ERP affiche et recherche par les utilisateurs ;
- `siret text` : aide au rapprochement initial et aux conventions.

`agency_client_id` devient l'identifiant technique de reference apres le premier rapprochement. Le matricule ERP est un identifiant metier complementaire. Les deux sont uniques dans le CRM. Le nom ne sert jamais de cle et le SIRET ne doit pas etre utilise seul quand plusieurs etablissements juridiques ou sites partagent une situation ambigue.

## Donnees financieres CRM

### Objectifs

Table `public.objectifs_financiers` :

- `user_id` : commercial CRM ;
- `period_code` : mois `YYYY-MM` ;
- `objectif_ca` : chiffre d'affaires attendu ;
- `objectif_marge` : marge attendue.

Un seul enregistrement est autorise par commercial et par mois.

### Realisations clients

Table `public.previsions_clients` :

- `chiffre_affaires_previsionnel` et `marge_previsionnelle` : prevision saisie dans le CRM par le commercial ;
- `chiffre_affaires_estime_planning` et `marge_estimee_planning` : estimation automatique calculee par l'app agence ;
- `planning_synced_at` : date du dernier calcul agence.

Le total previsionnel d'un commercial n'est jamais saisi directement : il est toujours la somme de ses clients. La synchronisation agence ne doit jamais ecraser les colonnes de prevision saisies par le commercial.

Un client est inclus automatiquement dans le suivi financier d'un commercial uniquement lorsque `establishments.client_triggered_by` correspond a ce commercial et que l'etablissement a le statut `client`. Un prospect affecte via `commercial_id` peut etre ajoute explicitement au previsionnel d'un mois, sans devenir pour autant un client declenche.

Les quatre niveaux restent independants : objectif fixe par l'administrateur, previsionnel saisi par le commercial, estimation issue du planning agence et realise consolide apres cloture. Le taux de marge est calcule avec `marge / chiffre d'affaires x 100`.

Chaque modification financiere est conservee dans `public.financial_change_history` avec l'auteur, la source, la date et les valeurs avant/apres. Cet historique est non modifiable depuis les interfaces.

Table `public.performances_clients` :

- `user_id` : commercial CRM ;
- `etablissement_id` : client ou prospect CRM ;
- `period_code` : mois `YYYY-MM` ;
- `chiffre_affaires` ;
- `marge` ;
- `source` : `manuel` ou `agence` ;
- `agency_client_id` ;
- `commentaire` optionnel.
- `statut_cloture` : `brouillon` ou `confirme` ;
- `cloture_at` et `cloture_by` : piste d'audit de la validation admin.

Un seul enregistrement est autorise par commercial, etablissement et mois. Les chiffres reels restent en brouillon jusqu'a confirmation explicite de l'administrateur CRM.

## Operations attendues du pont

Toutes les requetes sont des `POST` avec l'en-tete serveur `x-adaptel-sync-secret`. Le navigateur ne doit jamais connaitre cette valeur.

### `link_client`

Rapproche une seule fois `establishmentId` avec `agencyClientId`, `erpClientCode`, un `linkMode` obligatoire (`new_business` ou `historical_match`) et, si disponible, le SIRET. La meme fiche CRM passe au statut client et conserve ses actions. `new_business` fixe le declencheur et la date de depart des primes ; `historical_match` ne cree jamais d'attribution commerciale ni de prime. L'operation refuse tout identifiant agence ou matricule deja lie a une autre fiche.

### `list_linkable_crm_prospects`

Recherche les prospects et anciens clients CRM actifs non encore lies afin de pouvoir selectionner explicitement la bonne fiche pendant la creation du client agence. Une ressemblance de nom ne valide jamais automatiquement la liaison.

### `list_linked_clients`

Retourne les liaisons existantes ou la liaison d'un `agencyClientId` precis afin que l'app agence affiche l'etat du rapprochement sans stocker une seconde copie.

### `sync_planning_estimates`

Entree :

```json
{
  "agencyClientId": "identifiant-client-agence",
  "periodCode": "2026-11",
  "estimatedRevenue": 12500.0,
  "estimatedMargin": null,
  "calculatedAt": "2026-11-18T15:00:00Z"
}
```

Traitement :

1. retrouver `establishments.agency_client_id` ;
2. utiliser le `client_triggered_by` de l'etablissement comme `user_id` ;
3. faire un upsert dans `previsions_clients` uniquement sur les champs `*_estime_planning` et `planning_synced_at` ;
4. accepter `estimatedMargin = null` tant que l'app agence ne dispose pas d'un calcul de marge, et refuser les autres valeurs invalides, les mois invalides et les clients non rapproches ;
5. retourner un statut explicite sans creer silencieusement un doublon.

### `get_crm_dashboard`

Entree : mois et, facultativement, identifiant du commercial CRM.

Sortie minimale :

```json
{
  "periodCode": "2026-11",
  "objectives": { "revenue": 0, "margin": 0 },
  "commercialForecast": { "revenue": 0, "margin": 0 },
  "planningEstimate": { "revenue": 0, "margin": 0 },
  "actuals": { "revenue": 0, "margin": 0, "marginRate": 0, "confirmed": false },
  "activity": { "phoning": 0, "mailing": 0, "visits": 0, "appointments": 0 },
  "acquisition": { "newProspects": 0, "newClients": 0 },
  "clients": []
}
```

### `set_crm_objectives`

Reserve a un administrateur agence authentifie. Met a jour les objectifs d'actions et financiers d'un commercial pour un mois donne.

### `manage_crm_user`

Reserve a un administrateur agence authentifie. Relaie cote serveur les operations de creation, modification, activation et desactivation deja implementees dans l'Edge Function CRM `manage-crm-users`.

## Import CRM des reels confirmes de l'agence

L'Edge Function CRM `sync-agency-actuals` est reservee a un administrateur CRM
actif. Elle appelle `crm-agence-entrant` avec l'operation
`list_monthly_actuals`, puis remplace uniquement les lignes CRM de source
`agence` sur la periode demandee.

- une periode couvre de 1 a 36 mois ;
- seuls les clients deja rapproches sont demandes ;
- seuls les mois confirmes par l'agence sont importes ;
- un mois rouvert dans l'agence disparait du realise CRM au prochain import ;
- un client sans `client_triggered_by` n'est attribue a aucun commercial et est
  signale dans le bilan de synchronisation ;
- les saisies manuelles CRM ne sont pas supprimees en masse : une ligne agence
  ne la remplace que lorsqu'un reel confirme correspondant existe.

Secret CRM requis : `AGENCY_CRM_SYNC_SECRET`. L'URL agence peut rester celle du
contrat ou etre surchargee par `AGENCY_CRM_BRIDGE_URL`.

## Securite obligatoire cote app agence

1. Recuperer et verifier la session agence dans l'Edge Function agence.
2. Lire le profil dans la table agence `utilisateurs`.
3. Exiger `role = 'admin'` et `actif = true` pour les operations de gestion.
4. Appeler l'API CRM uniquement depuis l'Edge Function, avec le secret partage en en-tete.
5. Ne jamais envoyer ce secret au navigateur, aux logs ou dans les messages d'erreur.
6. Ajouter une cle d'idempotence aux synchronisations financieres.
7. Journaliser l'auteur agence, l'operation, la date et le resultat, sans journaliser de secret.

## Ce que Claude ne doit pas modifier

- Les migrations et tables du Supabase CRM.
- Les politiques RLS CRM.
- L'Edge Function CRM `manage-crm-users`.
- Les calculs et composants du reporting CRM.

Toute evolution du contrat doit etre reportee dans ce fichier avant implementation des deux cotes.
