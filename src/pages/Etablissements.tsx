import { useEffect, useState } from "react";
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
import { Search, Plus } from "lucide-react";
import { EstablishmentDrawer } from "@/components/EstablishmentDrawer";
import { EstablishmentForm } from "@/components/EstablishmentForm";

interface Establishment {
  id: string;
  nom: string;
  ville: string | null;
  statut: "prospect" | "client" | "ancien_client";
  groupe: { valeur: string } | null;
  secteur: { valeur: string } | null;
  activite: { valeur: string } | null;
}

const Etablissements = () => {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    fetchEstablishments();
  }, []);

  const fetchEstablishments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("establishments")
      .select(`
        id,
        nom,
        ville,
        statut,
        groupe:groupe_id(valeur),
        secteur:secteur_id(valeur),
        activite:activite_id(valeur)
      `)
      .order("nom", { ascending: true });

    if (error) {
      console.error("Error fetching establishments:", error);
    } else {
      setEstablishments(data as any);
    }
    setLoading(false);
  };

  const filteredEstablishments = establishments.filter((e) =>
    e.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.ville?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (id: string) => {
    setSelectedEstablishmentId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Établissements</h1>
          <p className="text-muted-foreground">Gérez votre portefeuille de prospects et clients</p>
        </div>
        <Button className="gap-2" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvel établissement
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un établissement..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Groupe</TableHead>
              <TableHead>Secteur</TableHead>
              <TableHead>Activité</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredEstablishments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun établissement trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredEstablishments.map((establishment) => (
                <TableRow
                  key={establishment.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(establishment.id)}
                >
                  <TableCell className="font-medium">{establishment.nom}</TableCell>
                  <TableCell>{establishment.groupe?.valeur || "-"}</TableCell>
                  <TableCell>{establishment.secteur?.valeur || "-"}</TableCell>
                  <TableCell>{establishment.activite?.valeur || "-"}</TableCell>
                  <TableCell>{establishment.ville || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={establishment.statut} />
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
