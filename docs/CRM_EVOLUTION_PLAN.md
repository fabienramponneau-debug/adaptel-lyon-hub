# Evolution ADAPTEL CRM

## Etat de depart verifie le 18 novembre 2026

- Frontend React 18, Vite 5, TypeScript, Tailwind et composants shadcn/ui.
- Deploiement Vercel existant.
- Projet Supabase CRM `adaptel-lyon-crm` actif et accessible.
- Tables existantes avec RLS : `profiles`, `parametrages`, `establishments`, `contacts`, `actions`, `suggestions`, `competitors_history`, `objectifs_actions`.
- Trois comptes existants : Fabien (admin), Celine (commercial) et Helene (commercial).
- Le build de production passe avant evolution.
- Le lint global contient une dette historique importante ; les nouveaux fichiers ne doivent pas ajouter d'erreurs.
- Une modification locale anterieure existe dans `src/components/SuggestionCard.tsx` et doit etre preservee.
- Les migrations locales ne sont pas enregistrees dans l'historique distant Supabase. Toute nouvelle migration devra donc etre additive et verifiee explicitement.

## Architecture cible de cette phase

Les deux produits et leurs deux Supabase restent separes.

1. Le CRM reste l'outil quotidien du commercial.
2. L'application agence devient le poste de pilotage administrateur du CRM.
3. Les operations inter-projets passent par une fonction serveur qui :
   - verifie la session et le role admin de l'application agence ;
   - utilise des secrets serveur pour joindre le Supabase CRM ;
   - n'expose jamais de cle administrative au navigateur ;
   - journalise les operations sensibles.
4. Les fonctions SMS, email et signature deja presentes dans l'application agence sont reutilisees via cette frontiere serveur.

## Lots courts

### Lot 0 — Securisation et socle

- Versionner le nouveau schema sans modifier les donnees existantes.
- Corriger les deux alertes de securite actuelles sur les fonctions SQL avant d'ajouter des fonctions privilegiees.
- Ajouter une verification centralisee des roles et du statut actif.
- Regenerer les types Supabase du CRM.

### Lot 1 — Utilisateurs CRM

- Ajouter une Edge Function CRM de gestion des comptes, inspiree de `create-agency-user`.
- Creer un compte avec email, prenom, nom, role et statut.
- Activer ou desactiver sans supprimer l'historique.
- Refuser la connexion et couper les sessions d'un compte inactif.
- Proteger toutes les actions par une verification admin cote serveur.
- Ajouter l'interface de gestion dans le CRM, puis exposer les memes actions dans l'application agence via le pont securise.

### Lot 2 — Objectifs et resultats

- Conserver `objectifs_actions` pour les objectifs de visites, rendez-vous, phoning et mailing.
- Ajouter des objectifs mensuels de chiffre d'affaires et de marge par commercial.
- Ajouter un registre mensuel de resultats par client et commercial, avec provenance manuelle ou synchronisee.
- Afficher au commercial les objectifs, realisations, ecarts et progression.
- Afficher a l'administrateur les filtres par commercial, periode et client.

### Lot 3 — Reporting complet

- Activite : actions effectuees, rendez-vous, visites, relances et evolution.
- Acquisition : prospects crees, clients declenches et taux de conversion.
- Finance : CA, marge, atteinte des objectifs et repartition par client.
- Qualite des donnees : elements sans commercial, sans periode ou sans rapprochement agence.
- Exports seulement si un usage concret le justifie.

### Lot 4 — Integration dans l'application agence

- Ajouter une entree CRM reservee a l'administrateur.
- Consulter les indicateurs et ajuster les objectifs sans ouvrir le CRM.
- Gerer les comptes CRM depuis l'application agence.
- Rapprocher un etablissement CRM avec un client agence par identifiant stable, complete par SIRET quand il existe.
- Synchroniser les realisations financieres depuis la source de verite de l'application agence.

### Lot 5 — Mobile commercial

- Adapter la navigation et les ecrans de prospection aux largeurs telephone.
- Prioriser recherche, fiche etablissement, nouvelle action, compte rendu et relance.
- Conserver une web app responsive installable ; ne pas lancer de code natif a ce stade.

### Lot 6 — Conventions de mise a disposition

- Importer et figer la trame de neuf pages.
- Completer les donnees legales et tarifaires des etablissements.
- Gerer le logo client et les lignes de postes/taux/coefficient.
- Generer un document previsualisable, versionne et rattache au client.
- Envoyer par email via le service existant de l'application agence.
- Ajouter ensuite la signature par code SMS en reutilisant l'infrastructure existante.

## Regles anti-casse

- Pas de renommage ni de suppression de colonne pendant cette phase.
- Toute nouvelle table exposee a l'API a RLS active et des politiques testees.
- Les roles d'autorisation ne reposent pas sur `user_metadata` modifiable par l'utilisateur.
- Une desactivation ne supprime jamais les donnees historiques.
- Les nouvelles fonctions administratives ne sont pas executables par `anon` ou par un utilisateur non admin.
- Verification locale desktop et mobile avant deploiement.
- Build, tests cibles, controle des advisors Supabase et test SQL de lecture/ecriture avant livraison.
- Aucun push ni deploiement tant que le lot n'est pas valide en localhost.

## Decisions encore necessaires au moment du lot concerne

- Identifier la table et la regle de calcul qui font foi pour le CA et la marge dans l'application agence.
- Fournir ou identifier la derniere trame Word de convention et ses variantes eventuelles.
- Choisir si le nouveau commercial reprend l'identifiant/historique de Celine ou recoit un nouveau compte. Par defaut, un nouveau compte sera cree et Celine sera rendue inactive afin de conserver une piste d'audit correcte.
