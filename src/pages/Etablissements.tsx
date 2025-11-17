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
} from "lucide-react";
import { EstablishmentSheet } from "@/components/EstablishmentSheet";
import StatsCards from "@/components/StatsCards";

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
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <h1 className="text-[28px] leading-8 font-semibold text-slate-900">
          Portefeuille prospects & clients
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            <span>Exporter</span>
          </Button>
          <Button
            className="gap-2 bg-[#840404] hover:bg-[#6f0303]"
            onClick={openNewSheet}
          >
            <Plus className="h-4 w-4" />
            <span>Nouvel établissement</span>
          </Button>
        </div>
      </div>

      {/* recherche + filtres */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200/70">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher établissement, ville, groupe…"
                className="pl-10 h-11 rounded-md border-slate-300"
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 hover:bg-slate-50 relative"
            onClick={resetFilters}
            title="Réinitialiser"
          >
            <Filter className="h-4 w-4" />
            <span>Filtres</span>
            {activeFilters > 0 && (
              <span className="ml-2 h-5 min-w-[20px] px-1 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <Select value={fStatut} onValueChange={setFStatut}>
            <SelectTrigger className="h-10 rounded-md border-slate-300">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              <SelectItem value="ancien_client">
                Anciens clients
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={fGroupe} onValueChange={setFGroupe}>
            <SelectTrigger className="h-10 rounded-md border-slate-300">
              <SelectValue placeholder="Groupe" />
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
          <Select value={fSecteur} onValueChange={setFSecteur}>
            <SelectTrigger className="h-10 rounded-md border-slate-300">
              <SelectValue placeholder="Secteur" />
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
          <Select value={fActivite} onValueChange={setFActivite}>
            <SelectTrigger className="h-10 rounded-md border-slate-300">
              <SelectValue placeholder="Activité" />
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
          <Select value={fVille} onValueChange={setFVille}>
            <SelectTrigger className="h-10 rounded-md border-slate-300">
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Toutes villes</SelectItem>
              {uniq.villes.map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StatsCards establishments={rows} />

      {/* tableau */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200/70 overflow-hidden">
        <div className="p-4 border-b border-slate-200/70 bg-slate-100">
          <h3 className="font-semibold text-[15px] text-slate-900">
            Établissements ({filtered.length})
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 border-b border-slate-300">
              <TableHead className="w-[320px] py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>Établissement</span>
                </div>
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Groupe</span>
                </div>
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>Secteur</span>
                </div>
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span>Activité</span>
                </div>
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Ville</span>
                </div>
              </TableHead>
              <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Statut</span>
                </div>
              </TableHead>
              <TableHead className="w-[56px] py-3.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10"
                >
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#840404] border-t-transparent" />
                  </div>
                  <p className="text-slate-500 mt-2">Chargement…</p>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-slate-600"
                >
                  Aucun établissement
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const selected = selectedId === r.id;
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => openSheet(r.id)}
                    className={`group border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                      selected ? "bg-slate-50" : ""
                    }`}
                  >
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-slate-600" />
                        </div>
                        <div
                          className={`font-medium ${
                            selected
                              ? "text-[#840404]"
                              : "text-slate-900"
                          }`}
                        >
                          {r.nom}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {r.groupe?.valeur || "-"}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {r.secteur?.valeur || "-"}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {r.activite?.valeur || "-"}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {r.ville || "-"}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusBadge status={r.statut} size="sm" />
                    </TableCell>
                    <TableCell
                      className="py-3.5 pr-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="rounded-md w-44"
                        >
                          <DropdownMenuItem
                            onClick={() => openSheet(r.id)}
                          >
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openSheet(r.id)}
                          >
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

      <EstablishmentSheet
        establishmentId={selectedId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpdate={fetchRows}
      />
    </div>
  );
}
