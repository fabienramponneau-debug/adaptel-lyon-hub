-- Create suggestions table for commercial tasks and ideas
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('suggestion', 'idee', 'prospect_a_verifier', 'info_commerciale')),
  statut TEXT NOT NULL DEFAULT 'a_traiter' CHECK (statut IN ('a_traiter', 'en_cours', 'traite')),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute')),
  created_by UUID REFERENCES auth.users(id),
  etablissement_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  traite_at TIMESTAMP WITH TIME ZONE,
  traite_by UUID REFERENCES auth.users(id)
);

-- Create competitors_history table for tracking competitor information over time
CREATE TABLE public.competitors_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  concurrent_nom TEXT NOT NULL,
  coefficient DECIMAL(10,2),
  taux_horaire DECIMAL(10,2),
  date_info DATE NOT NULL DEFAULT CURRENT_DATE,
  commentaire TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suggestions
CREATE POLICY "Authenticated users can view all suggestions"
ON public.suggestions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert suggestions"
ON public.suggestions FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update suggestions"
ON public.suggestions FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete suggestions"
ON public.suggestions FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS Policies for competitors_history
CREATE POLICY "Authenticated users can view all competitors history"
ON public.competitors_history FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert competitors history"
ON public.competitors_history FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update competitors history"
ON public.competitors_history FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete competitors history"
ON public.competitors_history FOR DELETE
USING (auth.role() = 'authenticated');

-- Create triggers for updated_at
CREATE TRIGGER update_suggestions_updated_at
BEFORE UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_competitors_history_updated_at
BEFORE UPDATE ON public.competitors_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_suggestions_statut ON public.suggestions(statut);
CREATE INDEX idx_suggestions_created_at ON public.suggestions(created_at DESC);
CREATE INDEX idx_competitors_history_etablissement ON public.competitors_history(etablissement_id);
CREATE INDEX idx_competitors_history_date ON public.competitors_history(date_info DESC);