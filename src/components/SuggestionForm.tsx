import { useState } from "react";
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

interface SuggestionFormProps {
  onSuccess: () => void;
}

export function SuggestionForm({ onSuccess }: SuggestionFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    type: "suggestion" as "suggestion" | "idee" | "prospect_a_verifier" | "info_commerciale",
    priorite: "normale" as "basse" | "normale" | "haute",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez être connecté",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("suggestions").insert({
      titre: formData.titre,
      description: formData.description || null,
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
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle suggestion
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une suggestion</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              required
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Titre de la suggestion"
            />
          </div>

          <div>
            <Label>Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="idee">Idée</SelectItem>
                <SelectItem value="prospect_a_verifier">Prospect à vérifier</SelectItem>
                <SelectItem value="info_commerciale">Info commerciale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Priorité *</Label>
            <Select
              value={formData.priorite}
              onValueChange={(value: any) => setFormData({ ...formData, priorite: value })}
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
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Détails de la suggestion..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Création..." : "Créer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
