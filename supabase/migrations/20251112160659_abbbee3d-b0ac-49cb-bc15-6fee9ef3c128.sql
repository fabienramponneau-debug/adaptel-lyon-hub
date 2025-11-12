-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'commercial');

-- Create enum for establishment status
CREATE TYPE public.establishment_status AS ENUM ('prospect', 'client', 'ancien_client');

-- Create enum for action types
CREATE TYPE public.action_type AS ENUM ('phoning', 'mailing', 'visite', 'rdv');

-- Create enum for action status
CREATE TYPE public.action_status AS ENUM ('effectue', 'a_venir', 'a_relancer');

-- Create enum for parametrage categories
CREATE TYPE public.parametrage_category AS ENUM ('groupe', 'secteur', 'activite', 'concurrent');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'commercial',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for profiles (users can only see their own profile)
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create parametrages table
CREATE TABLE public.parametrages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie public.parametrage_category NOT NULL,
  valeur TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(categorie, valeur)
);

-- Enable RLS on parametrages
ALTER TABLE public.parametrages ENABLE ROW LEVEL SECURITY;

-- Create policy for parametrages (all authenticated users can read)
CREATE POLICY "Authenticated users can view parametrages" ON public.parametrages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert parametrages" ON public.parametrages
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update parametrages" ON public.parametrages
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete parametrages" ON public.parametrages
  FOR DELETE TO authenticated USING (true);

-- Create establishments table
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  groupe_id UUID REFERENCES public.parametrages(id),
  statut public.establishment_status NOT NULL DEFAULT 'prospect',
  secteur_id UUID REFERENCES public.parametrages(id),
  activite_id UUID REFERENCES public.parametrages(id),
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  commercial_id UUID REFERENCES public.profiles(id),
  commentaire TEXT,
  concurrent_id UUID REFERENCES public.parametrages(id),
  info_concurrent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on establishments
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

-- Create policies for establishments
CREATE POLICY "Authenticated users can view all establishments" ON public.establishments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert establishments" ON public.establishments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update establishments" ON public.establishments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete establishments" ON public.establishments
  FOR DELETE TO authenticated USING (true);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  fonction TEXT,
  telephone TEXT,
  email TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Authenticated users can view all contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts" ON public.contacts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete contacts" ON public.contacts
  FOR DELETE TO authenticated USING (true);

-- Create actions table
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.action_type NOT NULL,
  date_action DATE NOT NULL,
  statut_action public.action_status NOT NULL DEFAULT 'a_venir',
  commentaire TEXT,
  relance_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on actions
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- Create policies for actions
CREATE POLICY "Authenticated users can view all actions" ON public.actions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert actions" ON public.actions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update actions" ON public.actions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete actions" ON public.actions
  FOR DELETE TO authenticated USING (true);

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_establishments_updated_at
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();