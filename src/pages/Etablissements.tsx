// @ts-nocheck
// src/pages/Etablissements.tsx

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Download,
  Users,
  Layers,
  Briefcase,
  MapPin,
  CheckCircle2,
  X,
} from "lucide-react";
import { EstablishmentSheet } from "@/components/EstablishmentSheet";
import StatsCards from "@/components/StatsCards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useUserView } from "@/contexts/UserViewContext";
import {
  searchCitySuggestions,
  CitySuggestion,
} from "@/utils/geoApi";

interface ParamValue {
  valeur: string;
}

interface Establishment {
  id: string;
  nom: string;
  ville: string | null;
  code_postal: string | null;
  statut: "prospect" | "client" | "ancien_client";
  actif: boolean;
  groupe: ParamValue | null;
  secteur: ParamValue | null;
  activite: ParamValue | null;
}

interface Parametrage {
  id: string;
  categorie: string;
  valeur: string;
}

const NONE_VALUE = "none";

type StatutFilter =
  | "all"
  | "prospect"
  | "client"
  | "ancien_client"
  | "archived";
type ActionType = "phoning" | "mailing" | "visite" | "rdv";
type ActionStatut = "a_venir" | "effectue";

export default function Etablissements() {
  // On garde le contexte (utile ailleurs) mais on NE FILTRE PLUS par user
  const { selectedUserId, loadingUserView } = useUserView() as any;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [params, setParams] = useState<{
    groupes: Parametrage[];
    secteurs: Parametrage[];
    activites: Parametrage[];
  }>({
    groupes: [],
    secteurs: [],
    activites: [],
  });

  // Filtres
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [fStatut, setFStatut] = useState<StatutFilter>("all");
  const [fGroupe, setFGroupe] = useState("all");
  const [fSecteur, setFSecteur] = useState("all");
  const [fActivite, setFActivite] = useState("all");
  const [fVille, setFVille] = useState("all");

  // Création rapide
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickForm, setQuickForm] = useState<{
    nom: string;
    statut: "prospect" | "client" | "ancien_client";
    groupeId: string;
    secteurId: string;
    activiteId: string;
    ville: string;
    code_postal: string;
  }>({
    nom: "",
    statut: "prospect",
    groupeId: NONE_VALUE,
    secteurId: NONE_VALUE,
    activiteId: NONE_VALUE,
    ville: "",
    code_postal: "",
  });

  // Suggestions ville / CP pour la création rapide
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityTimeoutRef = useRef<number | null>(null);

  const [quickActionEnabled, setQuickActionEnabled] = useState(false);
  const [quickAction, setQuickAction] = useState<{
    type: ActionType;
    statut: ActionStatut;
    date: string;
  }>({
    type: "visite",
    statut: "a_venir",
    date: new Date().toISOString().split("T")[0],
  });

  // debounce recherche globale portefeuille
  const tRef = useRef<number | null>(null);
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(
      () => setQDeb(q.trim().toLowerCase()),
      220
    );
  }, [q]);

  // Fetch data
  useEffect(() => {
    if (!loadingUserView) {
      fetchRows();
    }
    fetchParametrages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUserView, fStatut]);

  async function fetchRows() {
    setLoading(true);

    let query = supabase
      .from("establishments")
      .select(
        `
        id, nom, ville, code_postal, statut, actif,
        groupe:groupe_id(valeur),
        secteur:secteur_id(valeur),
        activite:activite_id(valeur)
      `
      )
      .order("nom", { ascending: true });

    // ❌ SUPPRESSION du filtrage par commercial_id
    // Tous les users voient tous les établissements

    // Filtrage actif / archivé
    if (fStatut === "archived") {
      query = query.eq("actif", false);
    } else {
      query = query.eq("actif", true);
      if (fStatut !== "all") {
        query = query.eq("statut", fStatut);
      }
    }

    const { data, error } = await query;

    if (!error && data) {
      setRows(data as any[]);
    } else {
      setRows([]);
    }
    setLoading(false);
  }

  async function fetchParametrages() {
    const { data, error } = await supabase
      .from("parametrages")
      .select("id, categorie, valeur");

    if (!error && data) {
      setParams({
        groupes: data.filter((p) => p.categorie === "groupe"),
        secteurs: data.filter((p) => p.categorie === "secteur"),
        activites: data.filter((p) => p.categorie === "activite"),
      });
    }
  }

  // --- DÉRIVÉS ---

  const uniq = (() => {
    const activeRows = rows.filter((r: any) => r.actif);

    const g = new Set<string>(),
      s = new Set<string>(),
      a = new Set<string>(),
      v = new Set<string>();

    activeRows.forEach((r: any) => {
      if (r.groupe?.valeur) g.add(r.groupe.valeur);
      if (r.secteur?.valeur) s.add(r.secteur.valeur);
      if (r.activite?.valeur) a.add(r.activite.valeur);
      if (r.ville) v.add(r.ville);
    });

    return {
      groupes: [...g].sort(),
      secteurs: [...s].sort(),
      activites: [...a].sort(),
      villes: [...v].sort(),
    };
  })();

  const filtered = rows.filter((r: any) => {
    const hit =
      !qDeb ||
      r.nom.toLowerCase().includes(qDeb) ||
      r.ville?.toLowerCase().includes(qDeb) ||
      r.groupe?.valeur.toLowerCase().includes(qDeb) ||
      r.secteur?.valeur.toLowerCase().includes(qDeb) ||
      r.activite?.valeur.toLowerCase().includes(qDeb);

    const g = fGroupe === "all" || r.groupe?.valeur === fGroupe;
    const se = fSecteur === "all" || r.secteur?.valeur === fSecteur;
    const a = fActivite === "all" || r.activite?.valeur === fActivite;
    const v = fVille === "all" || r.ville === fVille;

    return hit && g && se && a && v;
  });

  // --- UI handlers ---

  function openSheet(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  function openNewSheet() {
    setSelectedId(null);
    setSheetOpen(true);
  }

  function resetFilters() {
    setQ("");
    setFStatut("all");
    setFGroupe("all");
    setFSecteur("all");
    setFActivite("all");
    setFVille("all");
  }

  const activeFilters =
    (fStatut !== "all" ? 1 : 0) +
    [fGroupe, fSecteur, fActivite, fVille].filter((x) => x !== "all").length;

  function resetQuick() {
    setQuickForm({
      nom: "",
      statut: "prospect",
      groupeId: NONE_VALUE,
      secteurId: NONE_VALUE,
      activiteId: NONE_VALUE,
      ville: "",
      code_postal: "",
    });
    setQuickActionEnabled(false);
    setQuickAction({
      type: "visite",
      statut: "a_venir",
      date: new Date().toISOString().split("T")[0],
    });
    setCitySuggestions([]);
  }

  // Recherche ville/CP (création rapide)
  const handleCityInputChange = (value: string) => {
    setQuickForm((prev) => ({
      ...prev,
      ville: value,
      code_postal: "",
    }));

    if (cityTimeoutRef.current) {
      window.clearTimeout(cityTimeoutRef.current);
    }

    if (!value || value.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }

    cityTimeoutRef.current = window.setTimeout(async () => {
      setCityLoading(true);
      const res = await searchCitySuggestions(value);
      setCitySuggestions(res);
      setCityLoading(false);
    }, 250);
  };

  const handleSelectCitySuggestion = (s: CitySuggestion) => {
    setQuickForm((prev) => ({
      ...prev,
      ville: s.nom,
      code_postal: s.code_postal,
    }));
    setCitySuggestions([]);
  };

  async function handleQuickSave() {
    if (!quickForm.nom.trim()) {
      toast.error("Le nom de l'établissement est obligatoire");
      return;
    }

    setQuickLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id || null;

    const isDuplicate = rows.some(
      (r: any) =>
        r.nom.toLowerCase() === quickForm.nom.trim().toLowerCase() &&
        (r.ville || "").toLowerCase() ===
          quickForm.ville.trim().toLowerCase() &&
        r.actif === true
    );

    if (isDuplicate) {
      toast.error(
        "Un établissement portant ce nom et cette ville existe déjà dans votre portefeuille actif."
      );
      setQuickLoading(false);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("establishments")
      .insert({
        nom: quickForm.nom.trim(),
        statut: quickForm.statut,
        groupe_id:
          quickForm.groupeId === NONE_VALUE ? null : quickForm.groupeId,
        secteur_id:
          quickForm.secteurId === NONE_VALUE ? null : quickForm.secteurId,
        activite_id:
          quickForm.activiteId === NONE_VALUE ? null : quickForm.activiteId,
        ville: quickForm.ville || null,
        code_postal: quickForm.code_postal || null,
        commercial_id: userId, // toujours l'utilisateur connecté
        actif: true,
      } as any)
      .select("id")
      .single();

    if (error || !inserted) {
      toast.error("Erreur lors de la création rapide");
      setQuickLoading(false);
      return;
    }

    if (quickActionEnabled) {
      try {
        if (userId) {
          await supabase.from("actions").insert({
            etablissement_id: inserted.id,
            type: quickAction.type,
            statut_action: quickAction.statut,
            date_action: quickAction.date,
            commentaire: null,
            relance_date: null,
            user_id: userId,
          });
        }
      } catch {
        // on ne bloque pas la création pour un échec d'action
      }
    }

    toast.success("Établissement créé");
    resetQuick();
    setQuickOpen(false);
    setQuickLoading(false);
    fetchRows();
  }

  function handleQuickCancel() {
    resetQuick();
    setQuickOpen(false);
  }

  const handleArchiveDelete = async (
    id: string,
    action: "archive" | "delete" | "reactivate"
  ) => {
    const row = rows.find((r: Establishment) => r.id === id) as
      | Establishment
      | undefined;
    if (!row) return;

    if (action === "delete") {
      toast.warning(`Supprimer définitivement "${row.nom}" ?`, {
        description: "Cette action est irréversible.",
        action: {
          label: "Confirmer",
          onClick: async () => {
            const { error } = await supabase
              .from("establishments")
              .delete()
              .eq("id", id);

            if (error) {
              toast.error("Erreur lors de la suppression.");
            } else {
              toast.success("Établissement supprimé définitivement.");
              await fetchRows();
              if (selectedId === id) setSheetOpen(false);
            }
          },
        },
      });
      return;
    }

    if (action === "archive") {
      const newStatut =
        row.statut === "client" ? "ancien_client" : row.statut;

      const { error } = await supabase
        .from("establishments")
        .update({ actif: false, statut: newStatut } as any)
        .eq("id", id);

      if (error) {
        toast.error("Erreur lors de l'archivage.");
      } else {
        toast.success("Établissement archivé (Inactif).");
        await fetchRows();
      }
    }

    if (action === "reactivate") {
      if (row.actif) return;

      const { error } = await supabase
        .from("establishments")
        .update({ actif: true } as any)
        .eq("id", id);

      if (error) {
        toast.error("Erreur lors de la réactivation.");
      } else {
        toast.success("Établissement réactivé.");
        await fetchRows();
      }
    }

    if (selectedId === id) setSheetOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-6 space-y-5">
      {/* Header uniforme */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#840404]/10 rounded-lg">
            <Briefcase className="h-6 w-6 text-[#840404]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Portefeuille Clients & Prospects
            </h1>
            <p className="text-slate-600">
              Gestion de la base d&apos;établissements
            </p>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm h-9"
            onClick={openNewSheet}
          >
            <Plus className="h-4 w-4" />
            <span>Nouvel établissement</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-gray-300 bg-white hover:bg-gray-50 shadow-sm h-9"
          >
            <Download className="h-4 w-4" />
            <span>Exporter</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards establishments={rows} />

      {/* Filtres */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100">
                <Filter className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-900 text-sm">
                Filtres & recherche
              </span>
              {activeFilters > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 text-[11px]"
                >
                  {activeFilters} filtre
                  {activeFilters > 1 ? "s" : ""} actif
                  {activeFilters > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 gap-1 text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                <X className="h-3 w-3" />
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Ligne 1 : recherche + boutons statut */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 md:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Recherche (nom, ville, groupe, secteur...)"
                  className="pl-9 h-9 rounded-md border-gray-300 bg-white text-sm focus:border-blue-300"
                />
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto md:flex-1">
              <Button
                type="button"
                size="sm"
                variant={fStatut === "prospect" ? "default" : "outline"}
                className={`h-9 flex-1 px-3 text-xs ${
                  fStatut === "prospect"
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setFStatut("prospect")}
              >
                Prospects
              </Button>
              <Button
                type="button"
                size="sm"
                variant={fStatut === "client" ? "default" : "outline"}
                className={`h-9 flex-1 px-3 text-xs ${
                  fStatut === "client"
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setFStatut("client")}
              >
                Clients
              </Button>
              <Button
                type="button"
                size="sm"
                variant={fStatut === "ancien_client" ? "default" : "outline"}
                className={`h-9 flex-1 px-3 text-xs ${
                  fStatut === "ancien_client"
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setFStatut("ancien_client")}
              >
                Anciens clients
              </Button>
              <Button
                type="button"
                size="sm"
                variant={fStatut === "archived" ? "default" : "outline"}
                className={`h-9 flex-1 px-3 text-xs ${
                  fStatut === "archived"
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setFStatut("archived")}
              >
                Archivés
              </Button>
            </div>
          </div>

          {/* Ligne 2 : filtres complémentaires */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Groupe */}
            <div>
              <label className="text-[11px] font-medium text-gray-700 mb-1 block">
                Groupe
              </label>
              <Select value={fGroupe} onValueChange={setFGroupe}>
                <SelectTrigger className="h-9 rounded-md border-gray-300 bg-white text-sm">
                  <SelectValue placeholder="Tous groupes" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Tous groupes</SelectItem>
                  {uniq.groupes.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secteur */}
            <div>
              <label className="text-[11px] font-medium text-gray-700 mb-1 block">
                Secteur
              </label>
              <Select value={fSecteur} onValueChange={setFSecteur}>
                <SelectTrigger className="h-9 rounded-md border-gray-300 bg-white text-sm">
                  <SelectValue placeholder="Tous secteurs" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Tous secteurs</SelectItem>
                  {uniq.secteurs.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activité */}
            <div>
              <label className="text-[11px] font-medium text-gray-700 mb-1 block">
                Activité
              </label>
              <Select value={fActivite} onValueChange={setFActivite}>
                <SelectTrigger className="h-9 rounded-md border-gray-300 bg-white text-sm">
                  <SelectValue placeholder="Toutes activités" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Toutes activités</SelectItem>
                  {uniq.activites.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ville */}
            <div>
              <label className="text-[11px] font-medium text-gray-700 mb-1 block">
                Ville
              </label>
              <Select value={fVille} onValueChange={setFVille}>
                <SelectTrigger className="h-9 rounded-md border-gray-300 bg-white text-sm">
                  <SelectValue placeholder="Toutes les villes" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Toutes les villes</SelectItem>
                  {uniq.villes.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bouton Ajout rapide */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 shadow-sm"
          onClick={() => setQuickOpen((prev) => !prev)}
        >
          <Plus className="h-4 w-4 text-blue-600" />
          <span className="text-sm">Ajout rapide</span>
        </Button>
      </div>

      {/* Bloc création rapide */}
      {quickOpen && (
        <Card className="border border-blue-200 bg-blue-50/30 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* En-tête */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100">
                  <Plus className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-semibold text-gray-900 text-sm">
                  Création rapide d'établissement
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleQuickCancel}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Infos établissement */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                {/* Nom */}
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Nom *
                  </label>
                  <Input
                    value={quickForm.nom}
                    onChange={(e) =>
                      setQuickForm((prev) => ({
                        ...prev,
                        nom: e.target.value,
                      }))
                    }
                    placeholder="Nom établissement"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Statut */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Statut
                  </label>
                  <Select
                    value={quickForm.statut}
                    onValueChange={(
                      value: "prospect" | "client" | "ancien_client"
                    ) =>
                      setQuickForm((prev) => ({ ...prev, statut: value }))
                    }
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

                {/* Groupe */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Groupe
                  </label>
                  <Select
                    value={quickForm.groupeId}
                    onValueChange={(value) =>
                      setQuickForm((prev) => ({ ...prev, groupeId: value }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE_VALUE}>Aucun</SelectItem>
                      {params.groupes.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.valeur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Secteur */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Secteur
                  </label>
                  <Select
                    value={quickForm.secteurId}
                    onValueChange={(value) =>
                      setQuickForm((prev) => ({ ...prev, secteurId: value }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE_VALUE}>Aucun</SelectItem>
                      {params.secteurs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.valeur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Activité */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Activité
                  </label>
                  <Select
                    value={quickForm.activiteId}
                    onValueChange={(value) =>
                      setQuickForm((prev) => ({ ...prev, activiteId: value }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE_VALUE}>Aucune</SelectItem>
                      {params.activites.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.valeur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ville / CP (recherche) */}
                <div className="md:col-span-1">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Ville / Code postal
                  </label>
                  <Input
                    value={quickForm.ville}
                    onChange={(e) => handleCityInputChange(e.target.value)}
                    placeholder="Ville ou code postal"
                    className="h-9 text-sm"
                  />
                  {/* Suggestions */}
                  {cityLoading && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Recherche...
                    </p>
                  )}
                  {!cityLoading && citySuggestions.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm text-xs">
                      {citySuggestions.map((s) => (
                        <button
                          key={`${s.nom}-${s.code_postal}`}
                          type="button"
                          onClick={() => handleSelectCitySuggestion(s)}
                          className="w-full px-2 py-1 text-left hover:bg-blue-50 flex justify-between"
                        >
                          <span>{s.nom}</span>
                          <span className="text-gray-500">{s.code_postal}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {quickForm.code_postal && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Code postal sélectionné :{" "}
                      <span className="font-semibold">
                        {quickForm.code_postal}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section action rapide */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={quickActionEnabled ? "default" : "outline"}
                    size="sm"
                    className={`h-8 gap-2 text-xs ${
                      quickActionEnabled
                        ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                        : "bg-white border-gray-300"
                    }`}
                    onClick={() => setQuickActionEnabled((prev) => !prev)}
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une action
                  </Button>
                  {quickActionEnabled && (
                    <span className="text-xs text-gray-500">
                      Action liée au nouvel établissement
                    </span>
                  )}
                </div>
              </div>

              {quickActionEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  {/* Type d'action */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Type d'action
                    </label>
                    <Select
                      value={quickAction.type}
                      onValueChange={(value: ActionType) =>
                        setQuickAction((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visite">Visite terrain</SelectItem>
                        <SelectItem value="phoning">Phoning</SelectItem>
                        <SelectItem value="mailing">Mailing</SelectItem>
                        <SelectItem value="rdv">Rendez-vous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Statut */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Statut
                    </label>
                    <Select
                      value={quickAction.statut}
                      onValueChange={(value: ActionStatut) =>
                        setQuickAction((prev) => ({
                          ...prev,
                          statut: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_venir">Planifié</SelectItem>
                        <SelectItem value="effectue">Effectué</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Date
                    </label>
                    <Input
                      type="date"
                      value={quickAction.date}
                      onChange={(e) =>
                        setQuickAction((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleQuickCancel}
                      className="h-9 flex-1"
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleQuickSave}
                      disabled={quickLoading || !quickForm.nom.trim()}
                      className="h-9 flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {quickLoading ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Boutons si action désactivée */}
            {!quickActionEnabled && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQuickCancel}
                  className="h-9"
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleQuickSave}
                  disabled={quickLoading || !quickForm.nom.trim()}
                  className="h-9 flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {quickLoading ? "Création..." : "Créer l'établissement"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tableau */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <div className="min-w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow className="border-b border-gray-200">
                  <TableHead className="w-[300px] py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50 sticky left-0 z-20">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span>Nom</span>
                    </div>
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>Groupe</span>
                    </div>
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-gray-500" />
                      <span>Secteur</span>
                    </div>
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <span>Activité</span>
                    </div>
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>Ville</span>
                    </div>
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gray-500" />
                      <span>Statut</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px] py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50 sticky right-0 z-20">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || loadingUserView ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                        <p className="text-gray-500 text-sm">Chargement...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Building2 className="h-10 w-10 mb-3 opacity-50" />
                        <p className="font-medium mb-1">
                          Aucun établissement trouvé
                        </p>
                        <p className="text-sm mb-4">
                          Ajustez vos critères de recherche
                        </p>
                        <Button
                          variant="outline"
                          onClick={resetFilters}
                          className="gap-2 h-8"
                        >
                          <X className="h-3 w-3" />
                          Réinitialiser les filtres
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r: any) => {
                    const selected = selectedId === r.id;
                    return (
                      <TableRow
                        key={r.id}
                        onClick={() => openSheet(r.id)}
                        className={`group border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors ${
                          selected ? "bg-blue-50 border-blue-200" : ""
                        }`}
                      >
                        <TableCell className="py-3 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <div
                              className={`font-semibold text-sm ${
                                selected
                                  ? "text-blue-700"
                                  : "text-gray-900 group-hover:text-blue-600"
                              } transition-colors`}
                            >
                              {r.nom}
                              {!r.actif && (
                                <Badge
                                  variant="destructive"
                                  className="ml-2 text-[10px] h-4 px-2"
                                >
                                  Archivé
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-sm text-gray-700">
                            {r.groupe?.valeur || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-sm text-gray-700">
                            {r.secteur?.valeur || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-sm text-gray-700">
                            {r.activite?.valeur || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-sm text-gray-700 font-medium">
                            {r.ville || "-"}
                            {r.code_postal ? ` (${r.code_postal})` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <StatusBadge status={r.statut} size="sm" />
                        </TableCell>
                        <TableCell
                          className="py-3 pr-4 sticky right-0 bg-white z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-70 group-hover:opacity-100 hover:bg-white"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44 rounded-lg"
                            >
                              <DropdownMenuItem onClick={() => openSheet(r.id)}>
                                Voir détails
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {r.actif ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleArchiveDelete(r.id, "archive")
                                    }
                                    className="text-orange-600"
                                  >
                                    Archiver
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleArchiveDelete(r.id, "delete")
                                    }
                                    className="text-red-600"
                                  >
                                    Supprimer (définitif)
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleArchiveDelete(r.id, "reactivate")
                                  }
                                  className="text-green-600"
                                >
                                  Réactiver
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <EstablishmentSheet
        establishmentId={selectedId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpdate={fetchRows}
      />
    </div>
  );
}
