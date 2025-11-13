import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, Lightbulb, Search, Info, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  id: string;
  titre: string;
  description: string | null;
  type: "suggestion" | "idee" | "prospect_a_verifier" | "info_commerciale";
  statut: "a_traiter" | "en_cours" | "traite";
  priorite: "basse" | "normale" | "haute";
  created_at: string;
  etablissement_id: string | null;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onUpdate: () => void;
  onClick?: () => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "suggestion": return <Lightbulb className="h-4 w-4" />;
    case "idee": return <Lightbulb className="h-4 w-4" />;
    case "prospect_a_verifier": return <Search className="h-4 w-4" />;
    case "info_commerciale": return <Info className="h-4 w-4" />;
    default: return <Info className="h-4 w-4" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "suggestion": return "Suggestion";
    case "idee": return "Idée";
    case "prospect_a_verifier": return "Prospect à vérifier";
    case "info_commerciale": return "Info commerciale";
    default: return type;
  }
};

const getPriorityColor = (priorite: string) => {
  switch (priorite) {
    case "haute": return "border-red-500 text-red-700 bg-red-50";
    case "normale": return "border-blue-500 text-blue-700 bg-blue-50";
    case "basse": return "border-gray-500 text-gray-700 bg-gray-50";
    default: return "";
  }
};

export function SuggestionCard({ suggestion, onUpdate, onClick }: SuggestionCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleMarkAsDone = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("suggestions")
      .update({
        statut: "traite",
        traite_at: new Date().toISOString(),
        traite_by: user?.id,
      })
      .eq("id", suggestion.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de marquer comme traité",
      });
    } else {
      toast({
        title: "Marqué comme traité",
        description: "La suggestion a été mise à jour",
      });
      onUpdate();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("suggestions")
      .delete()
      .eq("id", suggestion.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer",
      });
    } else {
      toast({ title: "Supprimé" });
      onUpdate();
    }
    setLoading(false);
  };

  return (
    <Card 
      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
        suggestion.statut === "traite" ? "opacity-60" : ""
      }`}
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="text-primary">{getTypeIcon(suggestion.type)}</div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">{suggestion.titre}</h4>
              <p className="text-xs text-muted-foreground">
                {format(new Date(suggestion.created_at), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {suggestion.statut !== "traite" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsDone();
                }}
                disabled={loading}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={loading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {suggestion.description && (
          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{getTypeLabel(suggestion.type)}</Badge>
          <Badge variant="outline" className={getPriorityColor(suggestion.priorite)}>
            {suggestion.priorite === "haute" ? "Priorité haute" : 
             suggestion.priorite === "normale" ? "Priorité normale" : "Priorité basse"}
          </Badge>
          {suggestion.statut === "traite" && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-500">
              Traité
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
