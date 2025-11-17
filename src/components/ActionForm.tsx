import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  Plus,
  Building2,
} from "lucide-react";

type ActionType = "phoning" | "mailing" | "visite" | "rdv";
type ActionStatus = "a_venir" | "a_relancer" | "effectue";

interface EstablishmentOption {
  id: string;
  nom: string;
  ville: string | null;
}

interface ActionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledDate?: string;
  establishmentId?: string | null;
  onSuccess: () => void;
}

export function ActionForm({
  open,
  onOpenChange,
  prefilledDate,
  establishmentId,
  onSuccess,
}: ActionFormProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>(
    []
  );

  const [selectedEstabId, setSelectedEstabId] = useState<string | "">("");
  const [type, setType] = useState<ActionType>("phoning");
  const [statut, setStatut] = useState<ActionStatus>("a_venir");
  const [date, setDate] = useState<string>(
    prefilledDate || new Date().toISOString().slice(0, 10)
  );
  const [commentaire, setCommentaire] = useState("");

  // Création rapide établissement
  const [creatingEstab, setCreatingEstab] = useState(false);
  const [newEstabNom, setNewEstabNom] = useState("");
  const [newEstabVille, setNewEstabVille] = useState("");
  const [newEstabStatut, setNewEstabStatut] = useState<
    "prospect" | "client" | "ancien_client"
  >("prospect");

  useEffect(() => {
    if (open) {
      void loadEstablishments();
      // reset si ouverture
      setDate(prefilledDate || new Date().toISOString().slice(0, 10));
      setStatut("a_venir");
      setType("phoning");
      setCommentaire("");
      if (establishmentId) {
        setSelectedEstabId(establishmentId);
      } else {
        setSelectedEstabId("");
      }
    }
  }, [open, prefilledDate, establishmentId]);

  const loadEstablishments = async () => {
    const { data, error } = await supabase
      .from("establishments")
      .select("id, nom, ville")
      .order("nom", { ascending: true });

    if (!error && data) {
      setEstablishments(data as any);
    }
  };

  const handleCreateEstablishment = async () => {
    if (!newEstabNom.trim()) {
      toast({
        variant: "destructive",
        title: "Nom obligatoire",
        description: "Merci de renseigner un nom d'établissement.",
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("establishments")
      .insert({
        nom: newEstabNom.trim(),
        ville: newEstabVille.trim() || null,
        statut: newEstabStatut,
      })
      .select("id, nom, ville")
      .single();

    setLoading(false);

    if (error || !data) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'établissement.",
      });
      return;
    }

    // On ajoute dans la liste et on sélectionne
    setEstablishments((prev) => [
      ...prev,
      { id: data.id, nom: data.nom, ville: data.ville },
    ]);
    setSelectedEstabId(data.id);
    setCreatingEstab(false);
    setNewEstabNom("");
    setNewEstabVille("");

    toast({
      title: "Établissement créé",
      description: "La fiche a été créée et sélectionnée.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEstabId) {
      toast({
        variant: "destructive",
        title: "Établissement obligatoire",
        description: "Merci de sélectionner un établissement.",
      });
      return;
    }
    if (!date) {
      toast({
        variant: "destructive",
        title: "Date obligatoire",
        description: "Merci de renseigner une date d'action.",
      });
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      toast({
        variant: "destructive",
        title: "Non connecté",
        description: "Vous devez être connecté pour créer une action.",
      });
      return;
    }

    const payload: {
      etablissement_id: string;
      user_id: string;
      type: ActionType;
      date_action: string;
      statut_action: ActionStatus;
      commentaire: string | null;
    } = {
      etablissement_id: selectedEstabId,
      user_id: user.id,
      type,
      date_action: date,
      statut_action: statut,
      commentaire: commentaire.trim() || null,
    };

    const { error } = await supabase.from("actions").insert(payload);

    setLoading(false);

    if (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'action.",
      });
      return;
    }

    toast({
      title: "Action créée",
      description: "L'action a été ajoutée au planning.",
    });

    onSuccess();
    onOpenChange(false);
  };

  const renderTypeButton = (t: ActionType, label: string, icon: JSX.Element) => {
    const active = type === t;
    return (
      <button
        type="button"
        onClick={() => setType(t)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${
          active
            ? "border-[#840404] bg-[#840404]/5 text-[#840404]"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
          {icon}
        </span>
        <span>{label}</span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle action</DialogTitle>
          <DialogDescription>
            Planifiez une action de prospection ou une relance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Établissement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Établissement</Label>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-[#840404] hover:underline"
                onClick={() => setCreatingEstab((v) => !v)}
              >
                <Plus className="h-3 w-3" />
                <span>Création rapide</span>
              </button>
            </div>

            {!creatingEstab ? (
              <Select
                value={selectedEstabId}
                onValueChange={(v) => setSelectedEstabId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un établissement" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {establishments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom}
                      {e.ville ? ` – ${e.ville}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                  <Building2 className="h-3 w-3" />
                  <span>Création rapide d&apos;un établissement</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Nom *</Label>
                    <Input
                      value={newEstabNom}
                      onChange={(e) => setNewEstabNom(e.target.value)}
                      placeholder="Nom de l'établissement"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ville</Label>
                    <Input
                      value={newEstabVille}
                      onChange={(e) => setNewEstabVille(e.target.value)}
                      placeholder="Lyon..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Statut</Label>
                    <Select
                      value={newEstabStatut}
                      onValueChange={(v: any) => setNewEstabStatut(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="ancien_client">
                          Ancien client
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreatingEstab(false);
                      setNewEstabNom("");
                      setNewEstabVille("");
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateEstablishment}
                    disabled={loading}
                  >
                    {loading ? "Création..." : "Créer et sélectionner"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Type d'action */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type d&apos;action</Label>
            <div className="grid grid-cols-2 gap-2">
              {renderTypeButton(
                "phoning",
                "Phoning",
                <Phone className="h-3.5 w-3.5 text-slate-700" />
              )}
              {renderTypeButton(
                "mailing",
                "Mailing",
                <Mail className="h-3.5 w-3.5 text-slate-700" />
              )}
              {renderTypeButton(
                "visite",
                "Visite terrain",
                <MapPin className="h-3.5 w-3.5 text-slate-700" />
              )}
              {renderTypeButton(
                "rdv",
                "Rendez-vous",
                <CalendarIcon className="h-3.5 w-3.5 text-slate-700" />
              )}
            </div>
          </div>

          {/* Statut + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Statut</Label>
              <Select
                value={statut}
                onValueChange={(v: any) => setStatut(v as ActionStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_venir">Planifié</SelectItem>
                  <SelectItem value="a_relancer">À relancer</SelectItem>
                  <SelectItem value="effectue">Effectué</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Commentaire */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Commentaire</Label>
            <Textarea
              rows={3}
              placeholder="Notes de prospection, compte rendu, éléments à relancer..."
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer l'action"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
