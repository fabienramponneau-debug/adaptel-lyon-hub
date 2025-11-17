import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, Trash2, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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

const getTypeLabel = (type: Suggestion["type"]) => {
  switch (type) {
    case "prospect_a_verifier":
      return "A contacter";
    case "idee":
      return "A voir";
    case "suggestion":
      return "Suggestion prospect";
    case "info_commerciale":
      return "Info commerciale";
    default:
      return type;
  }
};

const getPriorityClasses = (priorite: Suggestion["priorite"]) => {
  switch (priorite) {
    case "haute":
      return "bg-red-50 text-red-700 border-red-200";
    case "normale":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "basse":
      return "bg-slate-50 text-slate-700 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

export function SuggestionCard({
  suggestion,
  onUpdate,
  onClick,
}: SuggestionCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleMarkAsDone = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("suggestions")
        .update({
          statut: "traite",
          traite_at: new Date().toISOString(),
          traite_by: user?.id,
        } as any)
        .eq("id", suggestion.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de marquer comme traité",
        });
      } else {
        toast({
          title: "Suggestion traitée",
          description: "La suggestion a été mise à jour",
        });
        onUpdate();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("suggestions")
        .delete()
        .eq("id", suggestion.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de supprimer la suggestion",
        });
      } else {
        toast({ title: "Suggestion supprimée" });
        onUpdate();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProspect = async () => {
    // Si déjà lié à un établissement, on ne recrée pas
    if (suggestion.etablissement_id) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Vous devez être connecté",
        });
        return;
      }

      // Création du prospect minimal
      const { data: estData, error: estError } = await supabase
        .from("establishments")
        .insert({
          nom: suggestion.titre,
          statut: "prospect",
          commentaire: suggestion.description || null,
        } as any)
        .select("id")
        .single();

      if (estError || !estData) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de créer le prospect",
        });
        return;
      }

      // Lier la suggestion à l'établissement et passer en "en_cours"
      const { error: linkError } = await supabase
        .from("suggestions")
        .update({
          statut: "en_cours",
          etablissement_id: estData.id,
        } as any)
        .eq("id", suggestion.id);

      if (linkError) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description:
            "Prospect créé, mais impossible de mettre à jour la suggestion",
        });
      } else {
        toast({
          title: "Prospect créé",
          description: "La suggestion a été prise en compte",
        });
        onUpdate();
      }
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = getTypeLabel(suggestion.type);
  const priorityClasses = getPriorityClasses(suggestion.priorite);
  const createdLabel = format(
    new Date(suggestion.created_at),
    "d MMMM yyyy",
    { locale: fr }
  );

  const isTraite = suggestion.statut === "traite";

  return (
    <Card
      className={[
        "p-4 transition-colors cursor-default border border-slate-200",
        isTraite ? "opacity-60 bg-slate-50" : "hover:bg-slate-50",
      ].join(" ")}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Ligne 1 : Nom + priorité */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[14px] text-slate-900 truncate">
              {suggestion.titre}
            </h4>
          </div>
          <div
            className={[
              "inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium",
              priorityClasses,
            ].join(" ")}
          >
            {suggestion.priorite === "haute"
              ? "Priorité haute"
              : suggestion.priorite === "normale"
              ? "Priorité normale"
              : "Priorité basse"}
          </div>
        </div>

        {/* Type + date + commentaire */}
        <div className="space-y-1">
          <div className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
            {typeLabel}
          </div>
          <p className="text-[11px] text-slate-500">{createdLabel}</p>
          {suggestion.description && (
            <p className="text-xs text-slate-700 whitespace-pre-line">
              {suggestion.description}
            </p>
          )}
          {suggestion.etablissement_id && (
            <p className="text-[11px] text-emerald-700 mt-1">
              Prospect créé et lié au portefeuille
            </p>
          )}
          {isTraite && (
            <p className="text-[11px] text-slate-500 mt-1">
              Statut : traité (vu / pris en compte)
            </p>
          )}
        </div>

        {/* Ligne boutons bas à droite */}
        <div className="flex items-center justify-end gap-1 pt-1">
          {/* Créer prospect */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={loading || !!suggestion.etablissement_id}
            onClick={(e) => {
              e.stopPropagation();
              handleCreateProspect();
            }}
            className="h-7 w-7 rounded-full border border-slate-200 hover:bg-slate-100"
            title={
              suggestion.etablissement_id
                ? "Prospect déjà créé"
                : "Créer le prospect"
            }
          >
            <Building2
              className={
                suggestion.etablissement_id
                  ? "h-3.5 w-3.5 text-slate-400"
                  : "h-3.5 w-3.5 text-[#840404]"
              }
            />
          </Button>

          {/* Vu = Traité */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={loading || isTraite}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAsDone();
            }}
            className="h-7 w-7 rounded-full border border-slate-200 hover:bg-slate-100"
            title="Marquer comme vu / traité"
          >
            <Check
              className={
                isTraite
                  ? "h-3.5 w-3.5 text-emerald-400"
                  : "h-3.5 w-3.5 text-emerald-600"
              }
            />
          </Button>

          {/* Supprimer */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="h-7 w-7 rounded-full border border-slate-200 hover:bg-slate-100"
            title="Supprimer la suggestion"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
