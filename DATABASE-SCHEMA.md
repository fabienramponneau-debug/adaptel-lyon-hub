# Structure de la base de données - CRM ADAPTEL Lyon

## Tables

### 1. profiles
Table des profils utilisateurs (liée à auth.users)

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'commercial',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Colonnes:**
- `id`: UUID, clé primaire liée à auth.users
- `nom`: Nom de l'utilisateur
- `prenom`: Prénom de l'utilisateur
- `role`: Rôle (enum: admin, commercial)
- `actif`: Indique si l'utilisateur est actif
- `created_at`: Date de création
- `updated_at`: Date de dernière modification

**RLS (Row Level Security):**
- SELECT: Les utilisateurs peuvent voir leur propre profil
- UPDATE: Les utilisateurs peuvent modifier leur propre profil
- INSERT/DELETE: Interdits (gérés par trigger lors de l'inscription)

---

### 2. parametrages
Table des paramètres configurables (listes de référence)

```sql
CREATE TABLE public.parametrages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie parametrage_category NOT NULL,
  valeur TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Colonnes:**
- `id`: UUID, clé primaire
- `categorie`: Catégorie du paramètre (enum: groupe, secteur, activite, concurrent)
- `valeur`: Valeur du paramètre (ex: "Accor", "Hôtellerie", "Restaurant")
- `created_at`: Date de création

**Catégories disponibles:**
- `groupe`: Groupes d'établissements (ex: Accor, ACPPA)
- `secteur`: Secteurs d'activité (ex: Hôtellerie, Restauration)
- `activite`: Types d'activités (ex: Hôtel, Restaurant, EHPAD)
- `concurrent`: Liste des concurrents

**RLS:**
- Toutes les opérations (SELECT, INSERT, UPDATE, DELETE) autorisées pour les utilisateurs authentifiés

---

### 3. establishments
Table principale des établissements (prospects, clients, anciens clients)

```sql
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  statut establishment_status NOT NULL DEFAULT 'prospect',
  groupe_id UUID REFERENCES parametrages(id),
  secteur_id UUID REFERENCES parametrages(id),
  activite_id UUID REFERENCES parametrages(id),
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  commercial_id UUID REFERENCES profiles(id),
  commentaire TEXT,
  concurrent_id UUID REFERENCES parametrages(id),
  info_concurrent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Colonnes:**
- `id`: UUID, clé primaire
- `nom`: Nom de l'établissement
- `statut`: Statut (enum: prospect, client, ancien_client)
- `groupe_id`: Référence vers un groupe (parametrages)
- `secteur_id`: Référence vers un secteur (parametrages)
- `activite_id`: Référence vers une activité (parametrages)
- `adresse`: Adresse complète
- `code_postal`: Code postal
- `ville`: Ville
- `commercial_id`: Commercial assigné (référence profiles)
- `commentaire`: Notes internes
- `concurrent_id`: Concurrent identifié (parametrages)
- `info_concurrent`: Informations sur la concurrence
- `created_at`: Date de création
- `updated_at`: Date de dernière modification

**RLS:**
- Toutes les opérations (SELECT, INSERT, UPDATE, DELETE) autorisées pour les utilisateurs authentifiés

---

### 4. contacts
Table des contacts liés aux établissements

```sql
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  fonction TEXT,
  telephone TEXT,
  email TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Colonnes:**
- `id`: UUID, clé primaire
- `etablissement_id`: Référence vers l'établissement
- `nom`: Nom du contact
- `prenom`: Prénom du contact
- `fonction`: Fonction/poste du contact
- `telephone`: Numéro de téléphone
- `email`: Adresse email
- `actif`: Indique si le contact est actif (soft delete)
- `created_at`: Date de création

**RLS:**
- Toutes les opérations (SELECT, INSERT, UPDATE, DELETE) autorisées pour les utilisateurs authentifiés

---

### 5. actions
Table des actions commerciales (phoning, mailing, visites, rendez-vous)

```sql
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type action_type NOT NULL,
  date_action DATE NOT NULL,
  statut_action action_status NOT NULL DEFAULT 'a_venir',
  commentaire TEXT,
  relance_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Colonnes:**
- `id`: UUID, clé primaire
- `etablissement_id`: Référence vers l'établissement
- `user_id`: Utilisateur ayant créé/effectué l'action
- `type`: Type d'action (enum: phoning, mailing, visite, rdv)
- `date_action`: Date de l'action
- `statut_action`: Statut (enum: effectue, a_venir, a_relancer)
- `commentaire`: Notes/commentaires sur l'action
- `relance_date`: Date de relance prévue (optionnelle)
- `created_at`: Date de création

**Types d'actions disponibles:**
- `phoning`: Appel téléphonique
- `mailing`: Envoi d'email/courrier
- `visite`: Visite terrain
- `rdv`: Rendez-vous client

**Statuts d'actions:**
- `effectue`: Action réalisée
- `a_venir`: Action planifiée
- `a_relancer`: Action nécessitant un suivi

**RLS:**
- Toutes les opérations (SELECT, INSERT, UPDATE, DELETE) autorisées pour les utilisateurs authentifiés

---

## Types Enum

### user_role
```sql
CREATE TYPE user_role AS ENUM ('admin', 'commercial');
```

### establishment_status
```sql
CREATE TYPE establishment_status AS ENUM ('prospect', 'client', 'ancien_client');
```

### parametrage_category
```sql
CREATE TYPE parametrage_category AS ENUM ('groupe', 'secteur', 'activite', 'concurrent');
```

### action_type
```sql
CREATE TYPE action_type AS ENUM ('phoning', 'mailing', 'visite', 'rdv');
```

### action_status
```sql
CREATE TYPE action_status AS ENUM ('effectue', 'a_venir', 'a_relancer');
```

---

## Fonctions et Triggers

### Fonction update_updated_at_column
Met à jour automatiquement le champ `updated_at` lors d'une modification

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Trigger sur establishments
```sql
CREATE TRIGGER update_establishments_updated_at
BEFORE UPDATE ON establishments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Trigger sur profiles
```sql
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Fonction handle_new_user
Crée automatiquement un profil lors de l'inscription d'un utilisateur

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nom'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Prenom'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'commercial')
  );
  RETURN NEW;
END;
$$;
```

### Trigger sur auth.users
```sql
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
```

---

## Relations principales

1. **profiles** ↔ **establishments**: Un commercial (profile) peut gérer plusieurs établissements
2. **establishments** ↔ **contacts**: Un établissement peut avoir plusieurs contacts
3. **establishments** ↔ **actions**: Un établissement peut avoir plusieurs actions
4. **profiles** ↔ **actions**: Un utilisateur peut créer plusieurs actions
5. **parametrages** ↔ **establishments**: Les établissements utilisent les paramètres (groupe, secteur, activité, concurrent)

---

## Données d'exemple (seed.sql)

### Utilisateurs
- Fabien (admin)
- Céline (commercial)

### Paramètres
- **Groupes**: Accor, ACPPA, Indépendant
- **Secteurs**: Hôtellerie, Restauration, Restauration collective
- **Activités**: Hôtel, Restaurant, EHPAD, Crèche, Scolaire, Entreprise
- **Concurrents**: Concurrent A, Concurrent B, Concurrent C

### Établissements (5 exemples)
- Mélange de prospects, clients et anciens clients
- Différents groupes, secteurs et activités
- Villes variées (Lyon, Villeurbanne, etc.)

### Actions (10 exemples)
- Différents types (phoning, mailing, visite, rdv)
- Statuts variés (effectué, à venir, à relancer)
- Répartis sur différents établissements

---

## Notes techniques

- **Sécurité**: RLS activé sur toutes les tables
- **Soft delete**: Le champ `actif` permet de désactiver des contacts sans les supprimer
- **Timestamps**: `created_at` et `updated_at` automatiques
- **UUID**: Tous les IDs sont des UUID (gen_random_uuid())
- **Cascades**: Les suppressions d'établissements entraînent la suppression des contacts et actions liés
