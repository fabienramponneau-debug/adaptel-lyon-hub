import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ActionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  onSuccess: () => void;
  prefilledDate?: string;
}

export function ActionForm({ open, onOpenChange, establishmentId, onSuccess, prefilledDate }: ActionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "phoning" as "phoning" | "mailing" | "visite" | "rdv",
    date_action: prefilledDate || new Date().toISOString().split("T")[0],
    statut_action: "a_venir" as "effectue" | "a_venir" | "a_relancer",
    commentaire: "",
    relance_date: "",
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

    const { error } = await supabase.from("actions").insert({
      etablissement_id: establishmentId,
      user_id: user.id,
      type: formData.type,
      date_action: formData.date_action,
      statut_action: formData.statut_action,
      commentaire: formData.commentaire || null,
      relance_date: formData.relance_date || null,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'action",
      });
    } else {
      toast({
        title: "Action créée",
        description: "L'action a été ajoutée avec succès",
      });
      onOpenChange(false);
      setFormData({
        type: "phoning",
        date_action: new Date().toISOString().split("T")[0],
        statut_action: "a_venir",
        commentaire: "",
        relance_date: "",
      });
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle action</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type d'action *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phoning">Phoning</SelectItem>
                <SelectItem value="mailing">Mailing</SelectItem>
                <SelectItem value="visite">Visite terrain</SelectItem>
                <SelectItem value="rdv">Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              required
              value={formData.date_action}
              onChange={(e) => setFormData({ ...formData, date_action: e.target.value })}
            />
          </div>

          <div>
            <Label>Statut *</Label>
            <Select
              value={formData.statut_action}
              onValueChange={(value: any) => setFormData({ ...formData, statut_action: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="effectue">Effectué</SelectItem>
                <SelectItem value="a_venir">À venir</SelectItem>
                <SelectItem value="a_relancer">À relancer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.statut_action === "a_relancer" && (
            <div>
              <Label>Date de relance</Label>
              <Input
                type="date"
                value={formData.relance_date}
                onChange={(e) => setFormData({ ...formData, relance_date: e.target.value })}
              />
            </div>
          )}

          <div>
            <Label>Commentaire</Label>
            <Textarea
              value={formData.commentaire}
              onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
              placeholder="Détails de l'action..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Création..." : "Créer l'action"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
