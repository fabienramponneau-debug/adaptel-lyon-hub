import { useEffect, useState, useRef } from "react";
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
  establishmentId?: string | null; // si fourni = fiche client
  onSuccess: () => void;
  overrideCommercialId?: string | null;
}

/** Suggestion de ville/code postal (local à ce composant) */
interface CitySuggestion {
  codePostal: string;
  ville: string;
  departement?: string;
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
  const [contactVu, setContactVu] = useState(""); // Personne vue pour visite / rdv

  // --- Création rapide établissement (dans le popup d'action) ---

  const [creatingEstab, setCreatingEstab] = useState(false);
  const [newEstabNom, setNewEstabNom] = useState("");
  const [newEstabVille, setNewEstabVille] = useState("");
  const [newEstabPostal, setNewEstabPostal] = useState("");
  const [newEstabStatut, setNewEstabStatut] = useState<
    "prospect" | "client" | "ancien_client"
  >("prospect");

  const [creatingEstabLoading, setCreatingEstabLoading] = useState(false);

  // Suggestions CP / Ville (locales à ce composant, pas de dépendance externe)
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const lastCityQueryRef = useRef<string>("");

  useEffect(() => {
    if (open) {
      void loadEstablishments();
      setDate(prefilledDate || new Date().toISOString().slice(0, 10));
      setStatut("a_venir");
      setType("phoning");
      setCommentaire("");
      setContactVu("");
      if (establishmentId) {
        setSelectedEstabId(establishmentId);
      } else {
        setSelectedEstabId("");
      }
      // reset création rapide
      setCreatingEstab(false);
      setNewEstabNom("");
      setNewEstabVille("");
      setNewEstabPostal("");
      setCitySuggestions([]);
      setShowCitySuggestions(false);
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

  // --- Appel direct à l'API Gouv pour CP / Ville (local) ---

  const fetchCitiesFromGeoApi = async (query: string): Promise<CitySuggestion[]> => {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    const isPostal = /^[0-9]+$/.test(q);
    const params = new URLSearchParams();

    if (isPostal) {
      params.set("codePostal", q);
    } else {
      params.set("nom", q);
    }

    params.set("fields", "codesPostaux,nom,codeDepartement");
    params.set("boost", "population");
    params.set("limit", "15");

    const url = `https://geo.api.gouv.fr/communes?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("geo.api.gouv.fr error", res.status);
        return [];
      }
      const data = (await res.json()) as any[];
      const suggestions: CitySuggestion[] = [];
      data.forEach((commune) => {
        const nom = commune.nom as string;
        const codeDep = commune.codeDepartement as string | undefined;
        const cps: string[] = commune.codesPostaux || [];
        cps.forEach((cp) => {
          suggestions.push({
            codePostal: cp,
            ville: nom,
            departement: codeDep,
          });
        });
      });
      return suggestions;
    } catch (e) {
      console.error("Erreur appel geo.api.gouv.fr", e);
      return [];
    }
  };

  const handleCitySearch = async (raw: string) => {
    const q = raw.trim();
    setShowCitySuggestions(false);
    setCitySuggestions([]);

    if (q.length < 2) return;

    lastCityQueryRef.current = q;
    const results = await fetchCitiesFromGeoApi(q);
    if (lastCityQueryRef.current !== q) {
      // saisie modifiée entre temps
      return;
    }
    setCitySuggestions(results);
    if (results.length > 0) {
      setShowCitySuggestions(true);
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

    setCreatingEstabLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const commercialIdToUse = overrideCommercialId || user?.id || null;

    const { data, error } = await supabase
      .from("establishments")
      .insert({
        nom: newEstabNom.trim(),
        ville: newEstabVille.trim() || null,
        code_postal: newEstabPostal.trim() || null,
        statut: newEstabStatut,
        commercial_id: commercialIdToUse,
      } as any)
      .select("id, nom, ville, code_postal")
      .single();

    setCreatingEstabLoading(false);

    if (error || !data) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'établissement.",
      });
      return;
    }

    // On ajoute dans la liste locale + on sélectionne
    setEstablishments((prev) => [
      ...prev,
      { id: data.id, nom: data.nom, ville: data.ville },
    ]);
    setSelectedEstabId(data.id);
    setCreatingEstab(false);
    setNewEstabNom("");
    setNewEstabVille("");
    setNewEstabPostal("");
    setCitySuggestions([]);
    setShowCitySuggestions(false);

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

    // Vérification de la personne vue si visite / rdv
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

  const renderTypeButton = (
    t: ActionType,
    label: string,
    icon: JSX.Element
  ) => {
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
          {/* Sélection établissement + création rapide */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">
                Établissement
              </label>
              {/* Bouton création rapide uniquement si on n'est pas dans une fiche client figée */}
              {!establishmentId && (
                <button
                  type="button"
                  onClick={() => setCreatingEstab((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs text-[#840404] hover:text-[#5c0404]"
                >
                  <Plus className="h-3 w-3" />
                  Nouveau rapide
                </button>
              )}
            </div>

            <Select
              value={selectedEstabId}
              onValueChange={setSelectedEstabId}
              disabled={!!establishmentId}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {establishments.map((estab) => (
                  <SelectItem key={estab.id} value={estab.id}>
                    {estab.nom} {estab.ville ? `(${estab.ville})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Bloc création rapide établissement */}
            {creatingEstab && !establishmentId && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Building2 className="h-4 w-4 text-[#840404]" />
                  Création rapide d&apos;établissement
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-700">
                      Nom *
                    </label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={newEstabNom}
                      onChange={(e) => setNewEstabNom(e.target.value)}
                      placeholder="Nom établissement"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Code postal
                    </label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={newEstabPostal}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setNewEstabPostal(v);
                        await handleCitySearch(v);
                      }}
                      placeholder="Ex : 69003"
                    />
                  </div>

                  <div className="relative">
                    <label className="text-xs font-medium text-slate-700">
                      Ville
                    </label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={newEstabVille}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setNewEstabVille(v);
                        await handleCitySearch(v);
                      }}
                      onFocus={() => {
                        if (citySuggestions.length > 0) {
                          setShowCitySuggestions(true);
                        }
                      }}
                      placeholder="Lyon, Bron..."
                    />
                    {showCitySuggestions && citySuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto text-xs">
                        {citySuggestions.map((s) => (
                          <button
                            type="button"
                            key={`${s.codePostal}-${s.ville}`}
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-100"
                            onClick={() => {
                              setNewEstabPostal(s.codePostal);
                              setNewEstabVille(s.ville);
                              setShowCitySuggestions(false);
                            }}
                          >
                            {s.ville} ({s.codePostal})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Statut
                    </label>
                    <Select
                      value={newEstabStatut}
                      onValueChange={(
                        value: "prospect" | "client" | "ancien_client"
                      ) => setNewEstabStatut(value)}
                    >
                      <SelectTrigger className="mt-1 h-9 text-sm">
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
                      setNewEstabPostal("");
                      setCitySuggestions([]);
                      setShowCitySuggestions(false);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateEstablishment}
                    disabled={creatingEstabLoading || !newEstabNom.trim()}
                  >
                    {creatingEstabLoading ? "Création..." : "Créer & sélectionner"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Type d'action */}
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

          {/* Personne vue pour visite / RDV */}
          {(type === "visite" || type === "rdv") && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Personne rencontrée / vue
              </label>
              <Input
                value={contactVu}
                onChange={(e) => setContactVu(e.target.value)}
                placeholder="Nom du contact (ex: M. Dupont / L'accueil)"
              />
            </div>
          )}

          {/* Date + statut */}
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

          {/* Commentaire */}
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
