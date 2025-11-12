-- =====================================================
-- SEED DATA FOR ADAPTEL LYON CRM
-- =====================================================
-- This file contains example data to populate the database
-- Execute this after running the migrations

-- =====================================================
-- 1. PARAMETRAGES (Reference lists)
-- =====================================================

-- Groupes
INSERT INTO public.parametrages (categorie, valeur) VALUES
('groupe', 'Accor'),
('groupe', 'ACPPA'),
('groupe', 'Indépendant'),
('groupe', 'Best Western'),
('groupe', 'Logis Hotels');

-- Secteurs
INSERT INTO public.parametrages (categorie, valeur) VALUES
('secteur', 'Hôtellerie'),
('secteur', 'Restauration'),
('secteur', 'Restauration collective'),
('secteur', 'Santé');

-- Activités
INSERT INTO public.parametrages (categorie, valeur) VALUES
('activite', 'Hôtel'),
('activite', 'Restaurant'),
('activite', 'EHPAD'),
('activite', 'Crèche'),
('activite', 'Scolaire'),
('activite', 'Entreprise'),
('activite', 'Résidence hôtelière');

-- Concurrents
INSERT INTO public.parametrages (categorie, valeur) VALUES
('concurrent', 'Concurrent A'),
('concurrent', 'Concurrent B'),
('concurrent', 'Concurrent C'),
('concurrent', 'Orange Business'),
('concurrent', 'SFR Pro');

-- =====================================================
-- 2. USERS (À créer manuellement via l'interface)
-- =====================================================
-- Fabien (admin) - email: fabien@adaptel.fr
-- Céline (commercial) - email: celine@adaptel.fr
-- NOTE: Ces utilisateurs doivent être créés via l'interface d'authentification
-- Les profils seront automatiquement créés via le trigger handle_new_user

-- =====================================================
-- 3. ESTABLISHMENTS (Exemples)
-- =====================================================
-- NOTE: Remplacer les IDs de groupe, secteur, activité, concurrent et commercial
-- par les vrais IDs de votre base de données

-- Exemple d'insertion d'établissements (à adapter avec vos IDs):
/*
INSERT INTO public.establishments (nom, statut, groupe_id, secteur_id, activite_id, adresse, code_postal, ville, commentaire, concurrent_id, info_concurrent, commercial_id) 
SELECT 
  'Hôtel Mercure Lyon Centre',
  'client',
  (SELECT id FROM parametrages WHERE categorie = 'groupe' AND valeur = 'Accor' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'secteur' AND valeur = 'Hôtellerie' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'activite' AND valeur = 'Hôtel' LIMIT 1),
  '50 Cours Charlemagne',
  '69002',
  'Lyon',
  'Client fidèle depuis 2020, contrat de 3 ans renouvelé',
  (SELECT id FROM parametrages WHERE categorie = 'concurrent' AND valeur = 'Orange Business' LIMIT 1),
  'Équipement Orange en fin de contrat',
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1);

INSERT INTO public.establishments (nom, statut, groupe_id, secteur_id, activite_id, adresse, code_postal, ville, commentaire, commercial_id)
SELECT 
  'Restaurant La Table Lyonnaise',
  'prospect',
  (SELECT id FROM parametrages WHERE categorie = 'groupe' AND valeur = 'Indépendant' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'secteur' AND valeur = 'Restauration' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'activite' AND valeur = 'Restaurant' LIMIT 1),
  '15 Rue de la République',
  '69001',
  'Lyon',
  'Prospect chaud, RDV prévu la semaine prochaine',
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1);

INSERT INTO public.establishments (nom, statut, groupe_id, secteur_id, activite_id, adresse, code_postal, ville, commentaire, concurrent_id, info_concurrent, commercial_id)
SELECT 
  'EHPAD Les Acacias',
  'client',
  (SELECT id FROM parametrages WHERE categorie = 'groupe' AND valeur = 'ACPPA' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'secteur' AND valeur = 'Santé' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'activite' AND valeur = 'EHPAD' LIMIT 1),
  '28 Avenue du Général Leclerc',
  '69100',
  'Villeurbanne',
  'Client depuis 2019, très satisfait',
  (SELECT id FROM parametrages WHERE categorie = 'concurrent' AND valeur = 'SFR Pro' LIMIT 1),
  'Anciennement chez SFR Pro',
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1);

INSERT INTO public.establishments (nom, statut, groupe_id, secteur_id, activite_id, adresse, code_postal, ville, commentaire, commercial_id)
SELECT 
  'Hôtel Best Western Crequi Lyon Part-Dieu',
  'prospect',
  (SELECT id FROM parametrages WHERE categorie = 'groupe' AND valeur = 'Best Western' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'secteur' AND valeur = 'Hôtellerie' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'activite' AND valeur = 'Hôtel' LIMIT 1),
  '37 Rue de Bonnel',
  '69003',
  'Lyon',
  'Démonstration effectuée, en attente de décision',
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1);

INSERT INTO public.establishments (nom, statut, groupe_id, secteur_id, activite_id, adresse, code_postal, ville, commentaire, concurrent_id, info_concurrent, commercial_id)
SELECT 
  'Restaurant d''entreprise Pôle Santé Sud',
  'ancien_client',
  (SELECT id FROM parametrages WHERE categorie = 'groupe' AND valeur = 'Indépendant' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'secteur' AND valeur = 'Restauration collective' LIMIT 1),
  (SELECT id FROM parametrages WHERE categorie = 'activite' AND valeur = 'Entreprise' LIMIT 1),
  '165 Chemin du Grand Revoyet',
  '69310',
  'Pierre-Bénite',
  'Contrat non renouvelé en 2023, à relancer prochainement',
  (SELECT id FROM parametrages WHERE categorie = 'concurrent' AND valeur = 'Concurrent A' LIMIT 1),
  'Passé chez Concurrent A',
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1);
*/

-- =====================================================
-- 4. CONTACTS (Exemples)
-- =====================================================
-- NOTE: À adapter avec les IDs réels des établissements

/*
INSERT INTO public.contacts (etablissement_id, nom, prenom, fonction, telephone, email)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Hôtel Mercure Lyon Centre' LIMIT 1),
  'Dubois',
  'Marie',
  'Directrice',
  '04 72 00 00 01',
  'marie.dubois@mercure-lyon.fr';

INSERT INTO public.contacts (etablissement_id, nom, prenom, fonction, telephone, email)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant La Table Lyonnaise' LIMIT 1),
  'Martin',
  'Pierre',
  'Gérant',
  '04 72 00 00 02',
  'pierre.martin@latable.fr';

INSERT INTO public.contacts (etablissement_id, nom, prenom, fonction, telephone, email)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'EHPAD Les Acacias' LIMIT 1),
  'Rousseau',
  'Sophie',
  'Directrice des services',
  '04 72 00 00 03',
  'sophie.rousseau@acacias-ehpad.fr';

INSERT INTO public.contacts (etablissement_id, nom, prenom, fonction, telephone, email)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Hôtel Best Western Crequi Lyon Part-Dieu' LIMIT 1),
  'Bernard',
  'Jean',
  'Directeur général',
  '04 72 00 00 04',
  'j.bernard@bestwestern.fr';

INSERT INTO public.contacts (etablissement_id, nom, prenom, fonction, telephone, email)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant d''entreprise Pôle Santé Sud' LIMIT 1),
  'Petit',
  'Isabelle',
  'Responsable RH',
  '04 72 00 00 05',
  'i.petit@polesante.fr';
*/

-- =====================================================
-- 5. ACTIONS (Exemples)
-- =====================================================
-- NOTE: À adapter avec les IDs réels des établissements et utilisateurs

/*
-- Actions pour Hôtel Mercure (client)
INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Hôtel Mercure Lyon Centre' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'visite',
  '2024-01-15',
  'effectue',
  'Visite de suivi, tout va bien. Client satisfait du matériel.';

INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire, relance_date)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Hôtel Mercure Lyon Centre' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'rdv',
  CURRENT_DATE + INTERVAL '7 days',
  'a_venir',
  'RDV prévu pour discuter du renouvellement anticipé',
  CURRENT_DATE + INTERVAL '6 days';

-- Actions pour Restaurant La Table Lyonnaise (prospect)
INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant La Table Lyonnaise' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'phoning',
  '2024-01-10',
  'effectue',
  'Premier contact établi. Intéressé par une démonstration.';

INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant La Table Lyonnaise' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'mailing',
  '2024-01-12',
  'effectue',
  'Envoi de la documentation produit et tarifs.';

INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire, relance_date)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant La Table Lyonnaise' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'visite',
  CURRENT_DATE + INTERVAL '3 days',
  'a_venir',
  'Démonstration programmée sur site',
  CURRENT_DATE + INTERVAL '2 days';

-- Actions pour EHPAD Les Acacias (client)
INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'EHPAD Les Acacias' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'phoning',
  '2024-01-08',
  'effectue',
  'Appel de courtoisie. Aucun problème signalé.';

-- Actions pour Best Western (prospect)
INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire, relance_date)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Hôtel Best Western Crequi Lyon Part-Dieu' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'visite',
  '2024-01-18',
  'effectue',
  'Démonstration réussie. En attente de décision du siège.',
  CURRENT_DATE + INTERVAL '10 days';

INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire, relance_date)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Hôtel Best Western Crequi Lyon Part-Dieu' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'phoning',
  CURRENT_DATE,
  'a_relancer',
  'Relance pour connaître leur décision',
  CURRENT_DATE + INTERVAL '5 days';

-- Actions pour Restaurant d'entreprise (ancien client)
INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant d''entreprise Pôle Santé Sud' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'phoning',
  '2023-12-20',
  'effectue',
  'Fin de contrat. Client parti à la concurrence pour des raisons tarifaires.';

INSERT INTO public.actions (etablissement_id, user_id, type, date_action, statut_action, commentaire, relance_date)
SELECT 
  (SELECT id FROM establishments WHERE nom = 'Restaurant d''entreprise Pôle Santé Sud' LIMIT 1),
  (SELECT id FROM profiles WHERE role = 'commercial' LIMIT 1),
  'phoning',
  CURRENT_DATE + INTERVAL '14 days',
  'a_venir',
  'Relance prévue pour proposer une nouvelle offre compétitive',
  CURRENT_DATE + INTERVAL '13 days';
*/

-- =====================================================
-- FIN DU FICHIER SEED
-- =====================================================
-- NOTE: Les insertions commentées ci-dessus sont à adapter
-- avec les vrais IDs de votre base de données.
-- Vous pouvez les exécuter après avoir créé les utilisateurs
-- et récupéré leurs IDs.
