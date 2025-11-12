import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface EstablishmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EstablishmentForm({ open, onOpenChange, onSuccess }: EstablishmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [parametrages, setParametrages] = useState<any>({
    groupes: [],
    secteurs: [],
    activites: [],
    concurrents: [],
  });
  const [formData, setFormData] = useState({
    nom: "",
    statut: "prospect" as const,
    groupe_id: "",
    secteur_id: "",
    activite_id: "",
    adresse: "",
    code_postal: "",
    ville: "",
    concurrent_id: "",
    info_concurrent: "",
    commentaire: "",
  });

  useEffect(() => {
    if (open) {
      fetchParametrages();
    }
  }, [open]);

  const fetchParametrages = async () => {
    const { data } = await supabase.from("parametrages").select("*");
    if (data) {
      const grouped = {
        groupes: data.filter((p) => p.categorie === "groupe"),
        secteurs: data.filter((p) => p.categorie === "secteur"),
        activites: data.filter((p) => p.categorie === "activite"),
        concurrents: data.filter((p) => p.categorie === "concurrent"),
      };
      setParametrages(grouped);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user.id) {
      toast.error("Vous devez être connecté");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("establishments").insert({
      nom: formData.nom,
      statut: formData.statut,
      groupe_id: formData.groupe_id || null,
      secteur_id: formData.secteur_id || null,
      activite_id: formData.activite_id || null,
      adresse: formData.adresse || null,
      code_postal: formData.code_postal || null,
      ville: formData.ville || null,
      concurrent_id: formData.concurrent_id || null,
      info_concurrent: formData.info_concurrent || null,
      commentaire: formData.commentaire || null,
      commercial_id: session.session.user.id,
    });

    if (error) {
      toast.error("Erreur lors de la création");
    } else {
      toast.success("Établissement créé avec succès");
      setFormData({
        nom: "",
        statut: "prospect",
        groupe_id: "",
        secteur_id: "",
        activite_id: "",
        adresse: "",
        code_postal: "",
        ville: "",
        concurrent_id: "",
        info_concurrent: "",
        commentaire: "",
      });
      onOpenChange(false);
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel établissement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nom *</Label>
            <Input
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
              placeholder="Nom de l'établissement"
            />
          </div>

          <div>
            <Label>Statut *</Label>
            <Select
              value={formData.statut}
              onValueChange={(value: any) => setFormData({ ...formData, statut: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="ancien_client">Ancien client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Groupe</Label>
              <Select
                value={formData.groupe_id}
                onValueChange={(value) => setFormData({ ...formData, groupe_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {parametrages.groupes.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.valeur}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Secteur</Label>
              <Select
                value={formData.secteur_id}
                onValueChange={(value) => setFormData({ ...formData, secteur_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {parametrages.secteurs.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.valeur}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Activité</Label>
            <Select
              value={formData.activite_id}
              onValueChange={(value) => setFormData({ ...formData, activite_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {parametrages.activites.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.valeur}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Adresse</Label>
            <Input
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              placeholder="Adresse complète"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code postal</Label>
              <Input
                value={formData.code_postal}
                onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                placeholder="69000"
              />
            </div>
            <div>
              <Label>Ville</Label>
              <Input
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                placeholder="Lyon"
              />
            </div>
          </div>

          <div>
            <Label>Concurrent</Label>
            <Select
              value={formData.concurrent_id}
              onValueChange={(value) => setFormData({ ...formData, concurrent_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {parametrages.concurrents.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.valeur}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Info concurrent</Label>
            <Textarea
              value={formData.info_concurrent}
              onChange={(e) => setFormData({ ...formData, info_concurrent: e.target.value })}
              placeholder="Informations sur la concurrence"
            />
          </div>

          <div>
            <Label>Commentaire</Label>
            <Textarea
              value={formData.commentaire}
              onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
              placeholder="Notes internes"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer l'établissement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
