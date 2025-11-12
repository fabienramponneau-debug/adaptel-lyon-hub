import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Parametrage {
  id: string;
  categorie: "groupe" | "secteur" | "activite" | "concurrent";
  valeur: string;
}

const Parametrage = () => {
  const [parametrages, setParametrages] = useState<Parametrage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValues, setNewValues] = useState({
    groupe: "",
    secteur: "",
    activite: "",
    concurrent: "",
  });

  useEffect(() => {
    fetchParametrages();
  }, []);

  const fetchParametrages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parametrages")
      .select("*")
      .order("valeur");

    if (error) {
      toast.error("Erreur lors du chargement");
    } else {
      setParametrages(data as Parametrage[]);
    }
    setLoading(false);
  };

  const handleAdd = async (categorie: "groupe" | "secteur" | "activite" | "concurrent") => {
    const valeur = newValues[categorie].trim();
    if (!valeur) return;

    const { error } = await supabase.from("parametrages").insert({ categorie, valeur });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      toast.success("Élément ajouté");
      setNewValues({ ...newValues, [categorie]: "" });
      fetchParametrages();
    }
  };

  const handleEdit = async (id: string) => {
    const valeur = editValue.trim();
    if (!valeur) return;

    const { error } = await supabase
      .from("parametrages")
      .update({ valeur })
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la modification");
    } else {
      toast.success("Élément modifié");
      setEditingId(null);
      setEditValue("");
      fetchParametrages();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("parametrages").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Élément supprimé");
      fetchParametrages();
    }
  };

  const startEdit = (item: Parametrage) => {
    setEditingId(item.id);
    setEditValue(item.valeur);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const renderCategory = (
    title: string,
    categorie: "groupe" | "secteur" | "activite" | "concurrent"
  ) => {
    const items = parametrages.filter((p) => p.categorie === categorie);

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={`Nouveau ${title.toLowerCase()}`}
              value={newValues[categorie]}
              onChange={(e) =>
                setNewValues({ ...newValues, [categorie]: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd(categorie);
              }}
            />
            <Button
              size="icon"
              onClick={() => handleAdd(categorie)}
              disabled={!newValues[categorie].trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50"
              >
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEdit(item.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(item.id)}
                    >
                      <Check className="h-4 w-4 text-client" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{item.valeur}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                Aucun élément
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramétrage</h1>
        <p className="text-muted-foreground">Gérez les listes et paramètres de l'application</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Chargement...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {renderCategory("Groupes", "groupe")}
          {renderCategory("Secteurs", "secteur")}
          {renderCategory("Activités", "activite")}
          {renderCategory("Concurrents", "concurrent")}
        </div>
      )}
    </div>
  );
};

export default Parametrage;
