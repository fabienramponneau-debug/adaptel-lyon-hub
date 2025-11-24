// src/components/SuggestionForm.tsx

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  searchCitySuggestions,
  CitySuggestion,
} from "@/utils/geoApi";

interface SuggestionFormProps {
  onSuccess: () => void;
}

export function SuggestionForm({ onSuccess }: SuggestionFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    titre: "",
    ville: "",
    description: "",
    type: "suggestion" as
      | "suggestion"
      | "idee"
      | "prospect_a_verifier"
      | "info_commerciale",
    priorite: "normale" as "basse" | "normale" | "haute",
  });

  // Auto-complétion ville
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityTimeoutRef = useRef<number | null>(null);

  const handleVilleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, ville: value }));

    const trimmed = value.trim();
    if (cityTimeoutRef.current) {
      window.clearTimeout(cityTimeoutRef.current);
    }
    if (trimmed.length < 2) {
      setCitySuggestions([]);
      return;
    }

    cityTimeoutRef.current = window.setTimeout(async () => {
      setCityLoading(true);
      try {
        const res = await searchCitySuggestions(trimmed);
        setCitySuggestions(res);
      } catch (e) {
        // silencieux, pas grave pour l'UX
      } finally {
        setCityLoading(false);
      }
    }, 250);
  };

  const handleSelectCitySuggestion = (s: CitySuggestion) => {
    setFormData((prev) => ({
      ...prev,
      ville: s.nom,
    }));
    setCitySuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez être connecté",
      });
      setLoading(false);
      return;
    }

    // On préfixe la description avec la ville pour ne pas toucher au schéma Supabase
    const descriptionFinale =
      (formData.ville
        ? `[${formData.ville.trim()}] `
        : "") + (formData.description || "");

    const { error } = await supabase.from("suggestions").insert({
      titre: formData.titre,
      description:
        descriptionFinale.trim() === ""
          ? null
          : descriptionFinale.trim(),
      type: formData.type,
      priorite: formData.priorite,
      created_by: user.id,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la suggestion",
      });
    } else {
      toast({
        title: "Suggestion créée",
        description: "La suggestion a été ajoutée avec succès",
      });
      setOpen(false);
      setFormData({
        titre: "",
        ville: "",
        description: "",
        type: "suggestion",
        priorite: "normale",
      });
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full border border-slate-200 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4 text-[#840404]" />
          <span className="sr-only">Nouvelle suggestion</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle suggestion</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nom client *</Label>
            <Input
              required
              value={formData.titre}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  titre: e.target.value,
                }))
              }
              placeholder="Nom de l'établissement"
            />
          </div>

          <div>
            <Label>Ville (optionnel)</Label>
            <Input
              value={formData.ville}
              onChange={(e) => handleVilleChange(e.target.value)}
              placeholder="Ville"
            />
            {cityLoading && (
              <p className="text-[11px] text-slate-400 mt-1">
                Recherche des communes...
              </p>
            )}
            {!cityLoading && citySuggestions.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm text-xs">
                {citySuggestions.map((s) => (
                  <button
                    key={`${s.nom}-${s.code_postal}`}
                    type="button"
                    onClick={() => handleSelectCitySuggestion(s)}
                    className="w-full px-2 py-1 text-left hover:bg-blue-50 flex justify-between"
                  >
                    <span>{s.nom}</span>
                    <span className="text-slate-500">
                      {s.code_postal}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) =>
                setFormData((prev) => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* valeurs techniques inchangées, libellés adaptés */}
                <SelectItem value="suggestion">
                  Suggestion
                </SelectItem>
                <SelectItem value="info_commerciale">
                  Information
                </SelectItem>
                <SelectItem value="prospect_a_verifier">
                  A contacter
                </SelectItem>
                <SelectItem value="idee">
                  Etablissement à voir
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Priorité *</Label>
            <Select
              value={formData.priorite}
              onValueChange={(value: any) =>
                setFormData((prev) => ({ ...prev, priorite: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basse">Basse</SelectItem>
                <SelectItem value="normale">Normale</SelectItem>
                <SelectItem value="haute">Haute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Commentaire</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Commentaire / contexte..."
              rows={4}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#840404] hover:bg-[#6f0303]"
          >
            {loading ? "Création..." : "Créer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
