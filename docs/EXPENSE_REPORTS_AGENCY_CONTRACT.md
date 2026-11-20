# Pont App Agence ↔ CRM — Notes de frais

État : implémenté localement côté CRM, non appliqué et non déployé.

L'application agence appelle l'Edge Function CRM `agency-crm-bridge` avec le mécanisme existant :

- méthode `POST` ;
- en-tête `x-adaptel-sync-secret: CRM_AGENCY_SYNC_SECRET` ;
- `requestId` UUID et `actor` obligatoires ;
- aucune clé privilégiée dans le navigateur.

Les justificatifs sont stockés dans le bucket privé `expense-receipts`. Le pont ne renvoie jamais de chemin public permanent : il produit une URL signée valable cinq minutes.

## 1. Lister les périodes

```json
{
  "operation": "list_expense_periods",
  "requestId": "uuid",
  "actor": { "agencyUserId": "uuid", "prenom": "Fabien", "nom": "Ramponneau" },
  "userId": "uuid-ou-tous",
  "fromPeriod": "2026-01",
  "toPeriod": "2026-12"
}
```

Réponse :

```json
{
  "periods": [{
    "id": "uuid",
    "userId": "uuid",
    "commercialName": "Prénom Nom",
    "periodCode": "2026-11",
    "status": "submitted",
    "declaredKilometers": 325.4,
    "reimbursableKilometers": 280.4,
    "mileageAmount": 176.25,
    "expensesAmount": 82.5,
    "mealsAmount": 28.5,
    "expenseBreakdown": [{ "code": "meal", "label": "Repas professionnel", "amount": 28.5 }],
    "adjustmentAmount": 0,
    "adjustmentKilometers": 0,
    "totalReimbursement": 258.75,
    "submittedAt": "ISO-8601",
    "correctionReason": null,
    "validatedAt": null,
    "closedAt": null,
    "payrollReference": null,
    "updatedAt": "ISO-8601"
  }]
}
```

## 2. Consulter une période

```json
{ "operation": "get_expense_period", "requestId": "uuid", "actor": { "agencyUserId": "uuid", "prenom": "Fabien", "nom": "Ramponneau" }, "periodId": "uuid" }
```

Réponse : `{ period, trips, expenses, history }`. Les trajets contiennent `expense_trip_legs` et `expense_trip_actions`. Les dépenses contiennent leur catégorie et les métadonnées du justificatif, mais aucune URL publique.

## 3. Ouvrir un justificatif

```json
{ "operation": "get_expense_receipt_url", "requestId": "uuid", "actor": { "agencyUserId": "uuid", "prenom": "Fabien", "nom": "Ramponneau" }, "expenseItemId": "uuid" }
```

Réponse :

```json
{ "url": "https://...signature-temporaire", "expiresIn": 300, "fileName": "ticket.pdf" }
```

## 4. Contrôler une période

```json
{
  "operation": "review_expense_period",
  "requestId": "uuid",
  "actor": { "agencyUserId": "uuid", "prenom": "Fabien", "nom": "Ramponneau" },
  "periodId": "uuid",
  "action": "request_correction",
  "reason": "Le justificatif du péage du 12/11 est illisible"
}
```

Actions disponibles :

| Action | Statut initial | Statut obtenu | Champs obligatoires |
|---|---|---|---|
| `request_correction` | `submitted` | `correction_required` | `reason` |
| `validate` | `submitted` | `validated` | aucun |
| `close` | `validated` | `closed` | `payrollReference` |

Réponse : `{ "ok": true, "status": "..." }`.

Une période clôturée n'est pas rouverte par cette API.

## 5. Ajouter un ajustement après clôture

L'opération ne modifie jamais les lignes d'origine. Elle ajoute un écart administratif distinct, motivé et historisé.

```json
{
  "operation": "add_expense_adjustment",
  "requestId": "uuid",
  "actor": { "agencyUserId": "uuid", "prenom": "Fabien", "nom": "Ramponneau" },
  "periodId": "uuid",
  "expenseItemId": "uuid-facultatif",
  "tripId": "uuid-facultatif",
  "amountDelta": -12.50,
  "kilometersDelta": 0,
  "reason": "Montant du justificatif corrigé après contrôle paie"
}
```

La période doit être `closed`, le motif doit contenir au moins cinq caractères et au moins un des deux écarts doit être non nul. Réponse : `{ "ok": true, "adjustmentId": "uuid" }`.

## 6. Statuts à afficher

| Valeur API | Libellé recommandé |
|---|---|
| `draft` | En préparation |
| `submitted` | Transmise pour contrôle |
| `correction_required` | Correction demandée |
| `validated` | Validée |
| `closed` | Intégrée en paie |

## 7. Responsabilités

- CRM : saisie du commercial, véhicule, barème, calcul des IK, pièces jointes, verrouillage et historique.
- App agence : liste, contrôle, consultation des justificatifs, demande de correction, validation et confirmation de l'intégration en paie.
- L'app agence ne recalcule jamais les indemnités kilométriques.
- Les montants et kilomètres figés au moment de la transmission sont la référence administrative.

## 8. Migration CRM associée

`supabase/migrations/20261120162414_commercial_expense_management.sql`

La migration est additive et crée le bucket privé, les tables, index, règles RLS, fonctions de calcul et journaux nécessaires.
