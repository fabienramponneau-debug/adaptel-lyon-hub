# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Fabien, administrateur, pilote l'activite commerciale, les utilisateurs, les objectifs et les reportings depuis l'application agence.
- Le commercial utilise le CRM au bureau et en mobilite pendant la prospection pour consulter son portefeuille, suivre ses objectifs et saisir ses comptes rendus.
- Les utilisateurs agence, dont Helene, peuvent transmettre au commercial des informations, recherches clients et signaux commerciaux sans disposer des droits d'administration.

## Product Purpose

ADAPTEL CRM centralise la prospection commerciale, les etablissements, les contacts, les actions et les resultats du commercial. Son evolution doit permettre de piloter les objectifs de chiffre d'affaires et de marge, de suivre les resultats par client, de gerer les comptes CRM depuis l'application agence et de produire rapidement des conventions de mise a disposition personnalisees.

Le succes signifie que l'administrateur dispose d'un reporting commercial complet sans double saisie inutile, que le commercial voit clairement ses priorites et sa progression sur ordinateur comme sur telephone, et que les fonctionnalites deja fiables de l'application agence sont reutilisees au lieu d'etre redeveloppees.

## Positioning

Le produit est une suite d'outils agence relies mais volontairement separes : l'application agence reste le poste de pilotage principal, tandis que le CRM conserve une experience specialisee pour le travail commercial et sa base Supabase propre.

## Operating Context

- Le CRM React/Vite est developpe en local puis deploye sur Vercel.
- Le CRM utilise le projet Supabase `adaptel-lyon-crm` sur l'offre gratuite.
- L'application agence dispose de son propre code et de son propre projet Supabase.
- Les donnees existantes du CRM sont en production et doivent etre preservees.
- Le volume cible est faible : un commercial principal et des donnees commerciales mesurees.
- La convention de mise a disposition part d'une trame Word de neuf pages, personnalisee avec l'identite du client, son logo, ses informations legales et ses conditions tarifaires.
- Les fonctions SMS et les mecanismes d'authentification par code deja operationnels dans l'application agence constituent la reference a reutiliser pour une future signature numerique.

## Capabilities and Constraints

- Conserver les deux applications, les deux deploiements et les deux projets Supabase pour cette phase.
- Ne pas casser les parcours, donnees, politiques d'acces ou fonctions existantes du CRM et de l'application agence.
- Gerer les utilisateurs CRM depuis l'interface : creation, role, activation et desactivation, sans suppression de leur historique.
- Permettre a l'administrateur de definir et ajuster des objectifs mensuels d'actions, de chiffre d'affaires et de marge par commercial.
- Donner au commercial une vue de ses objectifs, de sa progression et de ses resultats.
- Fournir a l'administrateur un reporting par periode et par commercial : prospection, visites, rendez-vous, phoning, mailing, nouveaux clients, chiffre d'affaires, marge et resultats par client.
- Prevoir le rapprochement entre un etablissement CRM et un client de l'application agence pour eviter la double saisie et permettre la remontee des donnees financieres.
- Generer une convention depuis un prospect ou client du CRM, la previsualiser, puis l'envoyer par email.
- Prevoir une signature numerique avec authentification SMS en reutilisant l'infrastructure de l'application agence.
- Optimiser les parcours essentiels du commercial pour un usage mobile web ; aucune application native n'est requise a ce stade.
- Les integrations entre bases doivent passer par des fonctions serveur securisees. Aucune cle `service_role` ou cle secrete ne doit etre exposee au navigateur.
- Les evolutions de schema doivent etre additives, versionnees et accompagnees de politiques RLS explicites.

## Brand Commitments

- Nom : ADAPTEL.
- Langue principale : francais.
- Conserver l'identite et les actifs de marque existants, dont les logos ADAPTEL deja presents dans les applications.
- Le ton doit rester professionnel, direct et adapte au travail quotidien d'une agence d'interim.

## Evidence on Hand

- Code du CRM : depot courant.
- Code de l'application agence : `C:\Users\ADA\Desktop\adaptel-app-simple`.
- Base CRM existante : 3 profils, plus de 1 100 etablissements et pres de 1 000 actions au 18 novembre 2026.
- Gestion des utilisateurs de reference dans l'application agence : `src/services/utilisateurs.service.ts`, `src/components/parametres/ParametresAdminSections.tsx` et l'Edge Function `supabase/functions/create-agency-user`.
- Trame Word de convention : a fournir ou identifier avant le lot de generation documentaire.
- Les valeurs cibles exactes de chiffre d'affaires et de marge seront saisies par l'administrateur.
- La source definitive des realisations de chiffre d'affaires et de marge doit etre confirmee lors du branchement avec l'application agence ; ne pas inventer de donnees financieres.

## Product Principles

1. Etendre sans casser : toute evolution preserve les donnees et les parcours existants.
2. Une saisie, plusieurs usages : reutiliser les donnees et services de l'application agence des qu'ils sont la source de verite.
3. Piloter en un regard : objectifs, realisations, ecarts et prochaines actions doivent etre immediatement lisibles.
4. Mobile sur le terrain : les parcours de prospection et de compte rendu doivent fonctionner confortablement sur telephone.
5. Securite par defaut : les operations administratives restent cote serveur et les droits sont verifies a chaque frontiere entre applications.

