// src/pages/Etablissements.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  Target,
  X,
} from "lucide-react";
import { EstablishmentSheet } from "@/components/EstablishmentSheet";
import StatsCards from "@/components/StatsCards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface ParamValue {
  valeur: string;
}

interface Establishment {
  id: string;
  nom: string;
  ville: string | null;
  statut: "prospect" | "client" | "ancien_client";
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

type StatutFilter = "all" | "prospect" | "client" | "ancien_client";
type ActionType = "phoning" | "mailing" | "visite" | "rdv";
type ActionStatut = "a_venir" | "effectue";

export default function Etablissements() {
  const [rows, setRows] = useState<Establishment[]>([]);
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
  }>({
    nom: "",
    statut: "prospect",
    groupeId: NONE_VALUE,
    secteurId: NONE_VALUE,
    activiteId: NONE_VALUE,
    ville: "",
  });

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

  // debounce recherche
  const tRef = useRef<number | null>(null);
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(
      () => setQDeb(q.trim().toLowerCase()),
      220
    );
  }, [q]);

  useEffect(() => {
    fetchRows();
    fetchParametrages();
  }, []);

  async function fetchRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("establishments")
      .select(
        `
        id, nom, ville, statut,
        groupe:groupe_id(valeur),
        secteur:secteur_id(valeur),
        activite:activite_id(valeur)
      `
      )
      .order("nom", { ascending: true });

    if (!error) setRows((data || []) as any);
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

  const uniq = useMemo(() => {
    const g = new Set<string>(),
      s = new Set<string>(),
      a = new Set<string>(),
      v = new Set<string>();

    rows.forEach((r) => {
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
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const hit =
          !qDeb ||
          r.nom.toLowerCase().includes(qDeb) ||
          r.ville?.toLowerCase().includes(qDeb) ||
          r.groupe?.valeur.toLowerCase().includes(qDeb) ||
          r.secteur?.valeur.toLowerCase().includes(qDeb) ||
          r.activite?.valeur.toLowerCase().includes(qDeb);

        const s =
          fStatut === "all" ||
          r.statut === fStatut;

        const g = fGroupe === "all" || r.groupe?.valeur === fGroupe;
        const se = fSecteur === "all" || r.secteur?.valeur === fSecteur;
        const a = fActivite === "all" || r.activite?.valeur === fActivite;
        const v = fVille === "all" || r.ville === fVille;

        return hit && s && g && se && a && v;
      }),
    [rows, qDeb, fStatut, fGroupe, fSecteur, fActivite, fVille]
  );

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

  function toggleStatut(value: Exclude<StatutFilter, "all">) {
    setFStatut((current) => (current === value ? "all" : value));
  }

  function resetQuick() {
    setQuickForm({
      nom: "",
      statut: "prospect",
      groupeId: NONE_VALUE,
      secteurId: NONE_VALUE,
      activiteId: NONE_VALUE,
      ville: "",
    });
    setQuickActionEnabled(false);
    setQuickAction({
      type: "visite",
      statut: "a_venir",
      date: new Date().toISOString().split("T")[0],
    });
  }

  async function handleQuickSave() {
    if (!quickForm.nom.trim()) {
      toast.error("Le nom de l'établissement est obligatoire");
      return;
    }

    setQuickLoading(true);

    const { data: inserted, error } = await supabase
      .from("establishments")
      .insert({
        nom: quickForm.nom.trim(),
        statut: quickForm.statut,
        groupe_id: quickForm.groupeId === NONE_VALUE ? null : quickForm.groupeId,
        secteur_id:
          quickForm.secteurId === NONE_VALUE ? null : quickForm.secteurId,
        activite_id:
          quickForm.activiteId === NONE_VALUE ? null : quickForm.activiteId,
        ville: quickForm.ville || null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      toast.error("Erreur lors de la création rapide");
      setQuickLoading(false);
      return;
    }

    if (quickActionEnabled) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white shadow-sm border border-gray-200">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Portefeuille Clients
              </h1>
              <p className="text-gray-600 text-sm">
                Gestion des prospects et clients
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 border-gray-300 bg-white hover:bg-gray-50 shadow-sm h-9"
            >
              <Download className="h-4 w-4" />
              <span>Exporter</span>
            </Button>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm h-9"
              onClick={openNewSheet}
            >
              <Plus className="h-4 w-4" />
              <span>Nouvel établissement</span>
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

            {/* Ligne 1 : recherche + 3 boutons statut alignés */}
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
                  onClick={() => toggleStatut("prospect")}
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
                  onClick={() => toggleStatut("client")}
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
                  onClick={() => toggleStatut("ancien_client")}
                >
                  Anciens clients
                </Button>
              </div>
            </div>

            {/* Ligne 2 : autres filtres */}
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

        {/* Bloc création rapide - VERSION CORRIGÉE */}
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

              {/* Informations établissement */}
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
                        setQuickForm((prev) => ({ ...prev, nom: e.target.value }))
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
                        <SelectItem value="ancien_client">Ancien client</SelectItem>
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

                  {/* Ville */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Ville
                    </label>
                    <Input
                      value={quickForm.ville}
                      onChange={(e) =>
                        setQuickForm((prev) => ({ ...prev, ville: e.target.value }))
                      }
                      placeholder="Ville"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Section action rapide - SANS ICÔNES */}
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
                    {/* Type d'action - SANS ICÔNE */}
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

                    {/* Bouton de création */}
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

              {/* Boutons de validation quand action désactivée */}
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
                    className="h-9 bg-blue-600 hover:bg-blue-700"
                  >
                    {quickLoading ? "Création..." : "Créer l'établissement"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tableau avec header fixe - VERSION CORRIGÉE */}
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
                  {loading ? (
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
                    filtered.map((r) => {
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
                                <DropdownMenuItem onClick={() => openSheet(r.id)}>
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  Archiver
                                </DropdownMenuItem>
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
    </div>
  );
}