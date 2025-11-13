import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Competitor {
  id: string;
  concurrent_nom: string;
  coefficient: number | null;
  taux_horaire: number | null;
  date_info: string;
  commentaire: string | null;
  created_at: string;
}

interface CompetitorHistoryProps {
  establishmentId: string;
}

export function CompetitorHistory({ establishmentId }: CompetitorHistoryProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    concurrent_nom: "",
    coefficient: "",
    taux_horaire: "",
    date_info: new Date().toISOString().split("T")[0],
    commentaire: "",
  });

  useEffect(() => {
    fetchCompetitors();
  }, [establishmentId]);

  const fetchCompetitors = async () => {
    const { data, error } = await supabase
      .from("competitors_history")
      .select("*")
      .eq("etablissement_id", establishmentId)
      .order("date_info", { ascending: false });

    if (!error && data) {
      setCompetitors(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("competitors_history").insert({
      etablissement_id: establishmentId,
      concurrent_nom: formData.concurrent_nom,
      coefficient: formData.coefficient ? parseFloat(formData.coefficient) : null,
      taux_horaire: formData.taux_horaire ? parseFloat(formData.taux_horaire) : null,
      date_info: formData.date_info,
      commentaire: formData.commentaire || null,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'ajouter le concurrent",
      });
    } else {
      toast({
        title: "Concurrent ajouté",
        description: "L'historique a été mis à jour",
      });
      setOpen(false);
      setFormData({
        concurrent_nom: "",
        coefficient: "",
        taux_horaire: "",
        date_info: new Date().toISOString().split("T")[0],
        commentaire: "",
      });
      fetchCompetitors();
    }

    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("competitors_history")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'entrée",
      });
    } else {
      toast({ title: "Supprimé", description: "L'entrée a été supprimée" });
      fetchCompetitors();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Historique des concurrents</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une information concurrent</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nom du concurrent *</Label>
                <Input
                  required
                  value={formData.concurrent_nom}
                  onChange={(e) => setFormData({ ...formData, concurrent_nom: e.target.value })}
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Coefficient</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.coefficient}
                    onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
                    placeholder="Ex: 1.5"
                  />
                </div>
                <div>
                  <Label>Taux horaire (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.taux_horaire}
                    onChange={(e) => setFormData({ ...formData, taux_horaire: e.target.value })}
                    placeholder="Ex: 45.50"
                  />
                </div>
              </div>
              <div>
                <Label>Date de l'information *</Label>
                <Input
                  type="date"
                  required
                  value={formData.date_info}
                  onChange={(e) => setFormData({ ...formData, date_info: e.target.value })}
                />
              </div>
              <div>
                <Label>Commentaire</Label>
                <Textarea
                  value={formData.commentaire}
                  onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                  placeholder="Informations complémentaires..."
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Ajout..." : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun concurrent enregistré
          </p>
        ) : (
          competitors.map((competitor) => (
            <Card key={competitor.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">{competitor.concurrent_nom}</h4>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(competitor.date_info), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    {competitor.coefficient && (
                      <span className="text-muted-foreground">
                        Coeff: <span className="font-medium text-foreground">{competitor.coefficient}</span>
                      </span>
                    )}
                    {competitor.taux_horaire && (
                      <span className="text-muted-foreground">
                        Taux: <span className="font-medium text-foreground">{competitor.taux_horaire}€/h</span>
                      </span>
                    )}
                  </div>
                  {competitor.commentaire && (
                    <p className="text-sm text-muted-foreground mt-2">{competitor.commentaire}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(competitor.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
