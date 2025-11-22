// src/components/ActionForm.tsx
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
  /** 
   * - null / undefined = ouverture depuis Prospection (l'user choisit l'établissement)
   * - id défini = ouverture depuis la fiche établissement (select verrouillé)
   */
  establishmentId?: string | null;
  onSuccess: () => void;
  overrideCommercialId?: string | null;
}

export function ActionForm({
  open,
  onOpenChange,
  prefilledDate,
  establishmentId,
  onSuccess,
  overrideCommercialId,
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
  const [contactVu, setContactVu] = useState("");

  // Vrai si on vient de la fiche établissement (et donc établissement imposé)
  const isFromEstablishmentSheet = Boolean(establishmentId);

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
      setDate(prefilledDate || new Date().toISOString().slice(0, 10));
      setStatut("a_venir");
      setType("phoning");
      setCommentaire("");
      setContactVu("");
      setCreatingEstab(false);
      setNewEstabNom("");
      setNewEstabVille("");
      setNewEstabStatut("prospect");

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const commercialIdToUse = overrideCommercialId || user?.id || null;

    const { data, error } = await supabase
      .from("establishments")
      .insert({
        nom: newEstabNom.trim(),
        ville: newEstabVille.trim() || null,
        statut: newEstabStatut,
        commercial_id: commercialIdToUse,
      } as any)
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

    if ((type === "visite" || type === "rdv") && !contactVu.trim()) {
      toast({
        variant: "destructive",
        title: "Personne vue obligatoire",
        description:
          "Pour une Visite ou un RDV, la personne rencontrée est obligatoire.",
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

    const userIdToUse = overrideCommercialId || user.id;

    const payload: any = {
      etablissement_id: selectedEstabId,
      user_id: userIdToUse,
      type,
      date_action: date,
      statut_action: statut,
      commentaire: commentaire.trim() || null,
      contact_vu: contactVu.trim() || null,
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
      <DialogContent className="sm:max-w-[650px] rounded-xl">
        <DialogHeader>
          <DialogTitle>Planifier une action</DialogTitle>
          <DialogDescription>
            Ajouter une nouvelle action de prospection ou de suivi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ÉTABLISSEMENT + CREATION RAPIDE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">
                Établissement
              </label>

              {!isFromEstablishmentSheet && (
                <Button
                  type="button"
                  variant={creatingEstab ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setCreatingEstab((prev) => !prev)}
                >
                  <Plus className="h-3 w-3" />
                  <span>
                    {creatingEstab ? "Annuler la création" : "Création rapide"}
                  </span>
                </Button>
              )}
            </div>

            {/* Select établissement */}
            <Select
              value={selectedEstabId}
              onValueChange={setSelectedEstabId}
              disabled={isFromEstablishmentSheet}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {establishments.map((estab) => (
                  <SelectItem key={estab.id} value={estab.id}>
                    {estab.nom} ({estab.ville || "Ville inconnue"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Création rapide d’établissement (nom + ville + statut) */}
            {!isFromEstablishmentSheet && creatingEstab && (
              <div className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Building2 className="h-3.5 w-3.5" />
                  Création rapide d&apos;un établissement
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  <Input
                    value={newEstabNom}
                    onChange={(e) => setNewEstabNom(e.target.value)}
                    placeholder="Nom établissement *"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={newEstabVille}
                    onChange={(e) => setNewEstabVille(e.target.value)}
                    placeholder="Ville"
                    className="h-9 text-sm"
                  />
                  <Select
                    value={newEstabStatut}
                    onValueChange={(v: any) => setNewEstabStatut(v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
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
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
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
                    className="h-8"
                    onClick={handleCreateEstablishment}
                    disabled={loading || !newEstabNom.trim()}
                  >
                    {loading ? "Création..." : "Créer l'établissement"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* TYPE D'ACTION */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Type d&apos;action
            </label>
            <div className="flex flex-wrap gap-2">
              {renderTypeButton(
                "phoning",
                "Phoning",
                <Phone className="h-4 w-4 text-blue-600" />
              )}
              {renderTypeButton(
                "mailing",
                "Mailing",
                <Mail className="h-4 w-4 text-green-600" />
              )}
              {renderTypeButton(
                "visite",
                "Visite",
                <MapPin className="h-4 w-4 text-purple-600" />
              )}
              {renderTypeButton(
                "rdv",
                "RDV",
                <CalendarIcon className="h-4 w-4 text-orange-600" />
              )}
            </div>
          </div>

          {/* PERSONNE VUE (visite / rdv) */}
          {(type === "visite" || type === "rdv") && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Personne rencontrée / vue
              </label>
              <Input
                value={contactVu}
                onChange={(e) => setContactVu(e.target.value)}
                placeholder="Nom du contact (ex: M. Dupont / L'accueil)"
                autoComplete="off"
              />
            </div>
          )}

          {/* DATE + STATUT */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Date de l&apos;action
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Statut
              </label>
              <Select value={statut} onValueChange={(v: any) => setStatut(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_venir">Planifié (À venir)</SelectItem>
                  <SelectItem value="effectue">Effectué</SelectItem>
                  <SelectItem value="a_relancer">À relancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* COMMENTAIRE */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Commentaire
            </label>
            <Textarea
              rows={3}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Détails de l'action..."
            />
          </div>

          {/* CTA */}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enregistrement..." : "Enregistrer l'action"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
