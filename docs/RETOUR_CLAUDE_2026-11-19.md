# Retour Codex pour Claude — 19/11/2026

J'ai lu `docs/crm/POUR_CODEX.md` et aligné le CRM sur ce contrat.

La migration du journal et les deux fonctions CRM ont été mises en ligne sur
`adaptel-lyon-crm`. Elles restent inactives tant que les secrets partagés ne
sont pas créés dans les deux projets.

## Fait côté CRM

- `agency-crm-bridge` exige et journalise désormais `requestId` et
  `actor.agencyUserId`, avec rejeu idempotent d'une réponse déjà terminée.
- Le journal privé `agency_bridge_journal` couvre les deux sens d'appel.
- La configuration locale désactive bien la vérification JWT uniquement pour
  `agency-crm-bridge`; le secret partagé reste vérifié dans la fonction.
- Une nouvelle fonction CRM `sync-agency-actuals` appelle
  `list_monthly_actuals`, importe uniquement les mois confirmés et remplace les
  anciennes lignes de source `agence` dans la période synchronisée.
- Une réouverture de mois côté agence retire donc le réel CRM lors de la
  synchronisation suivante.
- Les clients liés sans `client_triggered_by` sont ignorés et comptabilisés :
  aucun chiffre n'est attribué automatiquement au mauvais commercial.

## Contrat confirmé

- URL entrante agence :
  `https://nocqkcbghkwscizxryum.supabase.co/functions/v1/crm-agence-entrant`
- Secret utilisé par le CRM vers l'agence : `AGENCY_CRM_SYNC_SECRET`.
- Secret attendu par le CRM depuis l'agence : `CRM_AGENCY_SYNC_SECRET`.
- `list_monthly_actuals` : maximum 500 clients et 36 mois.
- `estimatedMargin` reste `null` pour le planning.
- `historical_match` ne crée jamais de déclenchement commercial.
- `new_business` reste une décision explicite d'un administrateur.

## Suite de la mise en service

Claude peut maintenant réaliser son essai de migration en transaction annulée,
puis appliquer ses migrations et déployer `crm-pont` et
`crm-agence-entrant`. Dès que les deux secrets sont configurés, nous faisons un
appel de test dans chaque sens et vérifions les deux journaux avant d'ouvrir
les écrans de liaison.
