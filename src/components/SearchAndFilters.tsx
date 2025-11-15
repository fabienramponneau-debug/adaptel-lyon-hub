// components/SearchAndFilters.tsx
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: {
    statut: string;
    groupe: string;
    secteur: string;
    activite: string;
    ville: string;
  };
  onFilterChange: {
    statut: (value: string) => void;
    groupe: (value: string) => void;
    secteur: (value: string) => void;
    activite: (value: string) => void;
    ville: (value: string) => void;
  };
  uniqueValues: {
    groupes: string[];
    secteurs: string[];
    activites: string[];
    villes: string[];
  };
}

const SearchAndFilters = ({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  uniqueValues
}: SearchAndFiltersProps) => {
  const activeFiltersCount = Object.values(filters).filter(f => f !== "all").length;

  const resetFilters = () => {
    onFilterChange.statut("all");
    onFilterChange.groupe("all");
    onFilterChange.secteur("all");
    onFilterChange.activite("all");
    onFilterChange.ville("all");
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/60">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher un établissement, ville, groupe..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-11 rounded-xl border-slate-300 focus:border-[#840404] transition-colors"
            />
          </div>
        </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
        <Select value={filters.statut} onValueChange={onFilterChange.statut}>
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

        <Select value={filters.groupe} onValueChange={onFilterChange.groupe}>
          <SelectTrigger className="h-11 rounded-xl border-slate-300">
            <SelectValue placeholder="Groupe" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Tous groupes</SelectItem>
            {uniqueValues.groupes?.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.secteur} onValueChange={onFilterChange.secteur}>
          <SelectTrigger className="h-11 rounded-xl border-slate-300">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Tous secteurs</SelectItem>
            {uniqueValues.secteurs?.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.activite} onValueChange={onFilterChange.activite}>
          <SelectTrigger className="h-11 rounded-xl border-slate-300">
            <SelectValue placeholder="Activité" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Toutes activités</SelectItem>
            {uniqueValues.activites?.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.ville} onValueChange={onFilterChange.ville}>
          <SelectTrigger className="h-11 rounded-xl border-slate-300">
            <SelectValue placeholder="Ville" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Toutes villes</SelectItem>
            {uniqueValues.villes?.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SearchAndFilters;