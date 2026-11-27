# Contrat Cursor — CRM V1 alignement financier

Reference : plan agence au commit `fa336c7`. Ce document decrit le code CRM prepare sur `codex/unify-commercial-assignment`. Aucun changement n'a ete effectue dans le depot App Agence et rien n'est deploye.

## Contrat attendu de `list_monthly_actuals`

Chaque ligne confirmee doit fournir sans ambiguite :

```json
{
  "agencyClientId": "uuid",
  "periodCode": "2026-10",
  "revenue": 1234.56,
  "marginBeforeCet": 321.00,
  "marginAfterCet": 300.00,
  "hoursBilled": 42.50,
  "hoursPaid": 40.00,
  "confirmedAt": "2026-11-05T10:00:00Z",
  "source": "agence"
}
```

Le CRM refuse tout le lot si une ligne ne contient pas les deux marges ou les heures facturees. L'ancien champ `margin` n'est volontairement pas utilise : cote agence il represente l'apres-CET et ne doit jamais alimenter `performances_clients.marge`.

Les appels sont limites aux UUID deja rapproches, par lots de 500. Si aucun client n'est rapproche, le CRM n'appelle pas l'agence.

## Recherche de clients agence

Operation entrante attendue :

```json
{ "operation": "search_agency_clients", "requestId": "uuid", "q": "nom ou matricule" }
```

Reponse :

```json
{
  "clients": [{
    "agencyClientId": "uuid",
    "erpClientCode": "3100462",
    "nom": "Client",
    "ville": "Lyon",
    "siret": "...",
    "actif": true,
    "lastMissionDate": null,
    "planningDataSince": "2026-08-01"
  }]
}
```

Maximum 20 resultats. Le CRM fait confirmer le choix, relit le client par son matricule avant la liaison, controle les doublons et ne cree rien dans l'app agence.

## Operations du pont agence vers CRM

- `set_crm_objectives` accepte `marginReference: "avant_cet" | "apres_cet"`.
- `get_commission_rules` retourne les versions du bareme.
- `set_commission_rules` recoit `effectiveFrom` et exactement trois paliers avec des taux decimaux. Exemple : `{ "monthFrom": 1, "monthTo": 12, "baseRate": 0.05, "bonusRate": 0.02 }`.
- `get_crm_annual_report` renvoie aussi `actualMarginBeforeCet`, `actualMarginAfterCet` et `hoursBilled`. `actualMargin` suit la reference de l'objectif. `commission` est le snapshot CRM, jamais un recalcul agence.

## Ordre de recette commune

1. Cursor livre les champs explicites de `list_monthly_actuals` et `search_agency_clients`.
2. Appliquer la migration CRM en transaction annulee, puis verifier le comptage avant/apres des lignes confirmees et des snapshots de prime.
3. Deployer les deux fonctions CRM sans activer la planification.
4. Tester un mois brouillon, un mois confirme, une relecture identique et une nouvelle confirmation plus recente.
5. Tester un transfert de portefeuille : le reel suit l'attribution du mois et la prime reste au beneficiaire historique.
6. Tester la recherche et la liaison sans changement de statut, d'attribution ou de beneficiaire.
7. Configurer le secret de planification et activer l'appel quotidien seulement apres validation commune.
