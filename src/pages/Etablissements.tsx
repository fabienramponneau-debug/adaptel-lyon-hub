// pages/Etablissements.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Filter, 
  Building2, 
  Layers, 
  Briefcase, 
  MapPin,
  Download,
  MoreHorizontal,
  Target,
  Bell,
  Check,
  X
} from "lucide-react";
import { EstablishmentDrawer } from "@/components/EstablishmentDrawer";
import { EstablishmentForm } from "@/components/EstablishmentForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const Etablissements = () => {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [parametrages, setParametrages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [quickCreateMode, setQuickCreateMode] = useState(false);
  const [newEstablishment, setNewEstablishment] = useState({
    nom: "",
    ville: "",
    statut: "prospect" as "prospect" | "client" | "ancien_client",
    groupe_id: "none",
    secteur_id: "none",
    activite_id: "none"
  });

  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterGroupe, setFilterGroupe] = useState<string>("all");
  const [filterSecteur, setFilterSecteur] = useState<string>("all");
  const [filterActivite, setFilterActivite] = useState<string>("all");
  const [filterVille, setFilterVille] = useState<string>("all");

  useEffect(() => {
    fetchEstablishments();
    fetchParametrages();
  }, []);

  const fetchEstablishments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("establishments")
      .select(
        `
        id,
        nom,
        ville,
        statut,
        groupe:groupe_id(valeur),
        secteur:secteur_id(valeur),
        activite:activite_id(valeur)
      `
      )
      .order("nom", { ascending: true });

    if (error) {
      console.error("Error fetching establishments:", error);
    } else {
      setEstablishments(data as any);
    }
    setLoading(false);
  };

  const fetchParametrages = async () => {
    const { data, error } = await supabase
      .from("parametrages")
      .select("*")
      .order("valeur", { ascending: true });

    if (error) {
      console.error("Error fetching parametrages:", error);
    } else {
      setParametrages(data || []);
    }
  };

  const uniqueValues = useMemo(() => {
    const groupes = new Set<string>();
    const secteurs = new Set<string>();
    const activites = new Set<string>();
    const villes = new Set<string>();

    establishments.forEach((e) => {
      if (e.groupe?.valeur) groupes.add(e.groupe.valeur);
      if (e.secteur?.valeur) secteurs.add(e.secteur.valeur);
      if (e.activite?.valeur) activites.add(e.activite.valeur);
      if (e.ville) villes.add(e.ville);
    });

    return {
      groupes: Array.from(groupes).sort(),
      secteurs: Array.from(secteurs).sort(),
      activites: Array.from(activites).sort(),
      villes: Array.from(villes).sort(),
    };
  }, [establishments]);

  const handleQuickCreate = async () => {
    if (!newEstablishment.nom.trim()) return;

    const establishmentData: any = {
      nom: newEstablishment.nom,
      ville: newEstablishment.ville || null,
      statut: newEstablishment.statut,
    };

    // Only add the IDs if they are not "none"
    if (newEstablishment.groupe_id !== "none") {
      establishmentData.groupe_id = newEstablishment.groupe_id;
    }
    if (newEstablishment.secteur_id !== "none") {
      establishmentData.secteur_id = newEstablishment.secteur_id;
    }
    if (newEstablishment.activite_id !== "none") {
      establishmentData.activite_id = newEstablishment.activite_id;
    }

    const { data, error } = await supabase
      .from("establishments")
      .insert([establishmentData])
      .select();

    if (error) {
      console.error("Error creating establishment:", error);
    } else {
      setEstablishments(prev => [...prev, data[0] as any]);
      setQuickCreateMode(false);
      setNewEstablishment({
        nom: "",
        ville: "",
        statut: "prospect",
        groupe_id: "none",
        secteur_id: "none",
        activite_id: "none"
      });
    }
  };

  const cancelQuickCreate = () => {
    setQuickCreateMode(false);
    setNewEstablishment({
      nom: "",
      ville: "",
      statut: "prospect",
      groupe_id: "none",
      secteur_id: "none",
      activite_id: "none"
    });
  };

  const filteredEstablishments = useMemo(() => {
    return establishments.filter((e) => {
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        e.nom.toLowerCase().includes(q) ||
        e.ville?.toLowerCase().includes(q) ||
        e.groupe?.valeur.toLowerCase().includes(q) ||
        e.secteur?.valeur.toLowerCase().includes(q) ||
        e.activite?.valeur.toLowerCase().includes(q);

      const matchesStatut =
        filterStatut === "all" ? true : e.statut === filterStatut;

      const matchesGroupe =
        filterGroupe === "all" ? true : e.groupe?.valeur === filterGroupe;

      const matchesSecteur =
        filterSecteur === "all" ? true : e.secteur?.valeur === filterSecteur;

      const matchesActivite =
        filterActivite === "all"
          ? true
          : e.activite?.valeur === filterActivite;

      const matchesVille =
        filterVille === "all" ? true : e.ville === filterVille;

      return (
        matchesSearch &&
        matchesStatut &&
        matchesGroupe &&
        matchesSecteur &&
        matchesActivite &&
        matchesVille
      );
    });
  }, [
    establishments,
    searchQuery,
    filterStatut,
    filterGroupe,
    filterSecteur,
    filterActivite,
    filterVille,
  ]);

  const handleRowClick = (id: string) => {
    setSelectedEstablishmentId(id);
    setDrawerOpen(true);
  };

  const resetFilters = () => {
    setFilterStatut("all");
    setFilterGroupe("all");
    setFilterSecteur("all");
    setFilterActivite("all");
    setFilterVille("all");
  };

  const activeFiltersCount = [
    filterStatut, 
    filterGroupe, 
    filterSecteur, 
    filterActivite, 
    filterVille
  ].filter(f => f !== "all").length;

  // Données simulées pour les notifications
  const notificationData = {
    rappels: 3,
    actions: 5,
    suggestions: 2
  };

  // Filtrer les paramétrages par catégorie
  const groupes = parametrages.filter(p => p.categorie === 'groupe');
  const secteurs = parametrages.filter(p => p.categorie === 'secteur');
  const activites = parametrages.filter(p => p.categorie === 'activite');

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Portefeuille Clients
          </h1>
          <p className="text-slate-600 text-lg">
            Gestion activité commerciale clients et prospects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 border-slate-300 hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
          <Button 
            className="gap-2 bg-gradient-to-r from-[#840404] to-[#a00606] hover:from-[#730303] hover:to-[#900505] shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nouvel établissement
          </Button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/60">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un établissement, ville, groupe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl border-slate-300 focus:border-[#840404] transition-colors"
              />
            </div>
          </div>

          {/* Bouton filtres avec badge */}
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="gap-2 border-slate-300 hover:bg-slate-50 relative"
              onClick={resetFilters}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {activeFiltersCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-[#840404] text-white text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Filtres détaillés */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              <SelectItem value="ancien_client">Anciens clients</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterGroupe} onValueChange={setFilterGroupe}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300">
              <SelectValue placeholder="Groupe" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Tous groupes</SelectItem>
              {uniqueValues.groupes.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSecteur} onValueChange={setFilterSecteur}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300">
              <SelectValue placeholder="Secteur" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Tous secteurs</SelectItem>
              {uniqueValues.secteurs.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterActivite} onValueChange={setFilterActivite}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300">
              <SelectValue placeholder="Activité" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Toutes activités</SelectItem>
              {uniqueValues.activites.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterVille} onValueChange={setFilterVille}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300">
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Toutes villes</SelectItem>
              {uniqueValues.villes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cartes de statistiques et notifications */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 border border-blue-200/50">
          <div className="text-2xl font-bold text-blue-900">{establishments.length}</div>
          <div className="text-sm text-blue-700 font-medium">Total établissements</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 p-4 border border-orange-200/50">
          <div className="text-2xl font-bold text-orange-900">
            {establishments.filter(e => e.statut === 'prospect').length}
          </div>
          <div className="text-sm text-orange-700 font-medium">Prospects</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 p-4 border border-green-200/50">
          <div className="text-2xl font-bold text-green-900">
            {establishments.filter(e => e.statut === 'client').length}
          </div>
          <div className="text-sm text-green-700 font-medium">Clients actifs</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 border border-purple-200/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-900">
                {notificationData.rappels + notificationData.actions + notificationData.suggestions}
              </div>
              <div className="text-sm text-purple-700 font-medium">Alertes</div>
            </div>
            <div className="relative">
              <Bell className="h-7 w-7 text-purple-600" />
              <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white">
                {notificationData.rappels + notificationData.actions + notificationData.suggestions}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-purple-600">
            {notificationData.rappels} rappels • {notificationData.actions} actions • {notificationData.suggestions} prospects
          </div>
        </div>
      </div>

      {/* Tableau avec saisie rapide */}
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              Établissements ({filteredEstablishments.length})
            </h3>
            <div className="flex items-center gap-2">
              {!quickCreateMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setQuickCreateMode(true)}
                >
                  <Plus className="h-4 w-4" />
                  Saisie rapide
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200/60">
              <TableHead className="w-[280px] py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <Building2 className="h-4 w-4" />
                  <span>Établissement</span>
                </div>
              </TableHead>
              <TableHead className="py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <Layers className="h-4 w-4" />
                  <span>Groupe</span>
                </div>
              </TableHead>
              <TableHead className="py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <Briefcase className="h-4 w-4" />
                  <span>Secteur</span>
                </div>
              </TableHead>
              <TableHead className="py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <Target className="h-4 w-4" />
                  <span>Activité</span>
                </div>
              </TableHead>
              <TableHead className="py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <MapPin className="h-4 w-4" />
                  <span>Ville</span>
                </div>
              </TableHead>
              <TableHead className="py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <span>Statut</span>
                </div>
              </TableHead>
              <TableHead className="w-[60px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Ligne de saisie rapide */}
            {quickCreateMode && (
              <TableRow className="bg-blue-50/50 border-b border-blue-200">
                <TableCell className="py-3">
                  <Input
                    placeholder="Nom de l'établissement"
                    value={newEstablishment.nom}
                    onChange={(e) => setNewEstablishment(prev => ({...prev, nom: e.target.value}))}
                    className="border-slate-300 focus:border-[#840404]"
                    autoFocus
                  />
                </TableCell>
                <TableCell className="py-3">
                  <Select
                    value={newEstablishment.groupe_id}
                    onValueChange={(value) => setNewEstablishment(prev => ({...prev, groupe_id: value}))}
                  >
                    <SelectTrigger className="border-slate-300 focus:border-[#840404]">
                      <SelectValue placeholder="Sélectionner un groupe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun groupe</SelectItem>
                      {groupes.map((groupe) => (
                        <SelectItem key={groupe.id} value={groupe.id}>
                          {groupe.valeur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <Select
                    value={newEstablishment.secteur_id}
                    onValueChange={(value) => setNewEstablishment(prev => ({...prev, secteur_id: value}))}
                  >
                    <SelectTrigger className="border-slate-300 focus:border-[#840404]">
                      <SelectValue placeholder="Sélectionner un secteur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun secteur</SelectItem>
                      {secteurs.map((secteur) => (
                        <SelectItem key={secteur.id} value={secteur.id}>
                          {secteur.valeur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <Select
                    value={newEstablishment.activite_id}
                    onValueChange={(value) => setNewEstablishment(prev => ({...prev, activite_id: value}))}
                  >
                    <SelectTrigger className="border-slate-300 focus:border-[#840404]">
                      <SelectValue placeholder="Sélectionner une activité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune activité</SelectItem>
                      {activites.map((activite) => (
                        <SelectItem key={activite.id} value={activite.id}>
                          {activite.valeur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <Input
                    placeholder="Ville"
                    value={newEstablishment.ville}
                    onChange={(e) => setNewEstablishment(prev => ({...prev, ville: e.target.value}))}
                    className="border-slate-300 focus:border-[#840404]"
                  />
                </TableCell>
                <TableCell className="py-3">
                  <Select 
                    value={newEstablishment.statut} 
                    onValueChange={(value: "prospect" | "client" | "ancien_client") => 
                      setNewEstablishment(prev => ({...prev, statut: value}))
                    }
                  >
                    <SelectTrigger className="border-slate-300 focus:border-[#840404]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="ancien_client">Ancien client</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-green-500 hover:bg-green-600"
                      onClick={handleQuickCreate}
                      disabled={!newEstablishment.nom.trim()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={cancelQuickCreate}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#840404] border-t-transparent"></div>
                  </div>
                  <p className="text-slate-500 mt-2">Chargement des établissements...</p>
                </TableCell>
              </TableRow>
            ) : filteredEstablishments.length === 0 && !quickCreateMode ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="text-slate-400 mb-2">🏢</div>
                  <p className="text-slate-500 font-medium">Aucun établissement trouvé</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Essayez de modifier vos critères de recherche ou créez un nouvel établissement
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEstablishments.map((establishment) => (
                <TableRow
                  key={establishment.id}
                  className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleRowClick(establishment.id)}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-[#840404] transition-colors">
                          {establishment.nom}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-slate-700">{establishment.groupe?.valeur || "-"}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-slate-700">{establishment.secteur?.valeur || "-"}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-slate-700">{establishment.activite?.valeur || "-"}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="h-3 w-3" />
                      {establishment.ville || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <StatusBadge status={establishment.statut} />
                  </TableCell>
                  <TableCell className="py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48">
                        <DropdownMenuItem>Voir détails</DropdownMenuItem>
                        <DropdownMenuItem>Modifier</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Archiver</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EstablishmentDrawer
        establishmentId={selectedEstablishmentId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdate={fetchEstablishments}
      />

      <EstablishmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchEstablishments}
      />
    </div>
  );
};

export default Etablissements;