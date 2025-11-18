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

export default function Etablissements() {
  const [rows, setRows] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filtres
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [fStatut, setFStatut] = useState("all");
  const [fGroupe, setFGroupe] = useState("all");
  const [fSecteur, setFSecteur] = useState("all");
  const [fActivite, setFActivite] = useState("all");
  const [fVille, setFVille] = useState("all");

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
        const s = fStatut === "all" || r.statut === fStatut;
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

  const activeFilters = [
    fStatut,
    fGroupe,
    fSecteur,
    fActivite,
    fVille,
  ].filter((x) => x !== "all").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header compact */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white shadow-sm border border-gray-200">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Portefeuille Clients</h1>
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
              <span>Nouveau</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards en premier */}
        <StatsCards establishments={rows} />

        {/* Section Filtres harmonieuse */}
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100">
                  <Filter className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-semibold text-gray-900">Filtres et recherche</span>
                {activeFilters > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {activeFilters} filtre{activeFilters > 1 ? 's' : ''} actif{activeFilters > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 gap-2 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                  Réinitialiser
                </Button>
              )}
            </div>

            {/* Grille de filtres équilibrée */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Recherche - prend 2 colonnes */}
              <div className="lg:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Recherche
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Nom, ville, groupe, secteur..."
                    className="pl-10 h-10 rounded-lg border-gray-300 bg-white focus:border-blue-300"
                  />
                </div>
              </div>

              {/* Statut */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Statut
                </label>
                <Select value={fStatut} onValueChange={setFStatut}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-300 bg-white">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="prospect">Prospects</SelectItem>
                    <SelectItem value="client">Clients</SelectItem>
                    <SelectItem value="ancien_client">Anciens clients</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Groupe */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Groupe
                </label>
                <Select value={fGroupe} onValueChange={setFGroupe}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-300 bg-white">
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
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Secteur
                </label>
                <Select value={fSecteur} onValueChange={setFSecteur}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-300 bg-white">
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
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Activité
                </label>
                <Select value={fActivite} onValueChange={setFActivite}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-300 bg-white">
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
            </div>

            {/* Ville - pleine largeur en dessous */}
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Ville
              </label>
              <Select value={fVille} onValueChange={setFVille}>
                <SelectTrigger className="h-10 rounded-lg border-gray-300 bg-white w-full">
                  <SelectValue placeholder="Toutes les villes" />
                </SelectTrigger>
                <SelectContent className="max-h-72 w-full">
                  <SelectItem value="all">Toutes les villes</SelectItem>
                  {uniq.villes.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tableau avec header fixe */}
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          <div className="relative overflow-auto max-h-[calc(100vh-400px)]">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow className="border-b border-gray-200 hover:bg-gray-50">
                  <TableHead className="w-[300px] py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
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
                  <TableHead className="w-[80px] py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-50">
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
                        <p className="font-medium mb-1">Aucun établissement trouvé</p>
                        <p className="text-sm mb-4">Ajustez vos critères de recherche</p>
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
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className={`font-semibold text-sm ${
                              selected ? "text-blue-700" : "text-gray-900 group-hover:text-blue-600"
                            } transition-colors`}>
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
                          className="py-3 pr-4"
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
                            <DropdownMenuContent align="end" className="w-44 rounded-lg">
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