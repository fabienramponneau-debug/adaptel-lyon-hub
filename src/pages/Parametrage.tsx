// src/pages/Parametrage.tsx - Finalisé (Header Uniforme, Objectifs)
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, Sliders } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";

interface Parametrage {
  id: string;
  categorie: "groupe" | "secteur" | "activite" | "concurrent";
  valeur: string;
}

type RoleType = "admin" | "commercial";
type ActionType = "visite" | "rdv" | "phoning" | "mailing";

interface UserOption {
  id: string;
  label: string;
}

const ACTION_LABELS: Record<ActionType, string> = {
  visite: "Visites terrain",
  rdv: "Rendez-vous",
  phoning: "Phoning",
  mailing: "Mailing",
};

// Mois : 12 passés, mois courant, 12 futurs (code period_code = yyyy-MM)
const MONTH_OPTIONS = (() => {
  const now = new Date();
  const res: { value: string; label: string }[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = addMonths(now, i);
    res.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MM/yyyy"),
    });
  }
  return res;
})();

// Client "non typé" pour la nouvelle table objectifs_actions
const sbAny = supabase as any;

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

  // Gestion profils / rôles / objectifs
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleType | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    MONTH_OPTIONS[MONTH_OPTIONS.length - 1]?.value
  );
  const [objectifs, setObjectifs] = useState<Record<ActionType, number>>({
    visite: 0,
    rdv: 0,
    phoning: 0,
    mailing: 0,
  });
  const [loadingObjectifs, setLoadingObjectifs] = useState(false);
  const [savingObjectifs, setSavingObjectifs] = useState(false);

  // Vue d'ensemble des objectifs (tous users / tous mois)
  const [allObjectifs, setAllObjectifs] = useState<
    {
      user_id: string;
      period_code: string;
      objectifs: Record<ActionType, number>;
    }[]
  >([]);

  useEffect(() => {
    fetchParametrages();
    initCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchUsers();
    }
  }, [currentUserId]);

  useEffect(() => {
    if (selectedUserId && selectedMonth) {
      fetchObjectifs(selectedUserId, selectedMonth);
    }
  }, [selectedUserId, selectedMonth]);

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

  const initCurrentUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Erreur getUser :", error.message);
      return;
    }
    const user = data.user;
    if (!user) return;

    setCurrentUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Erreur chargement profil :", profileError.message);
      return;
    }

    if (profile?.role) {
      setCurrentRole(profile.role as RoleType);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, prenom, nom, actif")
      .eq("actif", true)
      .order("prenom", { ascending: true });

    if (error) {
      console.error("Erreur chargement utilisateurs :", error.message);
      return;
    }

    const options: UserOption[] =
      data?.map((p: any) => ({
        id: p.id,
        label: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "Utilisateur",
      })) || [];

    setUsers(options);

    if (!selectedUserId && options.length > 0) {
      const current = options.find((o) => o.id === currentUserId);
      setSelectedUserId((current || options[0]).id);
    }

    // On charge aussi la vue d'ensemble des objectifs
    fetchAllObjectifs();
  };

  const fetchObjectifs = async (userId: string, month: string) => {
    setLoadingObjectifs(true);

    const { data, error } = await sbAny
      .from("objectifs_actions")
      .select("action_type, objectif")
      .eq("user_id", userId)
      .eq("period_type", "mois")
      .eq("period_code", month);

    if (error) {
      console.error("Erreur chargement objectifs :", error.message);
      setLoadingObjectifs(false);
      return;
    }

    const base: Record<ActionType, number> = {
      visite: 0,
      rdv: 0,
      phoning: 0,
      mailing: 0,
    };

    (data || []).forEach((row: any) => {
      const type = row.action_type as ActionType;
      if (type in base) {
        base[type] = row.objectif ?? 0;
      }
    });

    setObjectifs(base);
    setLoadingObjectifs(false);
  };

  const fetchAllObjectifs = async () => {
    const { data, error } = await sbAny
      .from("objectifs_actions")
      .select("user_id, action_type, objectif, period_code")
      .eq("period_type", "mois");

    if (error) {
      console.error("Erreur chargement tableau objectifs :", error.message);
      return;
    }

    const map = new Map<
      string,
      {
        user_id: string;
        period_code: string;
        objectifs: Record<ActionType, number>;
      }
    >();

    (data || []).forEach((row: any) => {
      const key = `${row.user_id}__${row.period_code}`;
      if (!map.has(key)) {
        map.set(key, {
          user_id: row.user_id,
          period_code: row.period_code,
          objectifs: {
            visite: 0,
            rdv: 0,
            phoning: 0,
            mailing: 0,
          },
        });
      }
      const entry = map.get(key)!;
      const type = row.action_type as ActionType;
      if (type in entry.objectifs) {
        entry.objectifs[type] = row.objectif ?? 0;
      }
    });

    setAllObjectifs(Array.from(map.values()));
  };

  const handleSaveObjectifs = async () => {
    if (!selectedUserId || !selectedMonth) return;

    setSavingObjectifs(true);
    try {
      const { error: delError } = await sbAny
        .from("objectifs_actions")
        .delete()
        .eq("user_id", selectedUserId)
        .eq("period_type", "mois")
        .eq("period_code", selectedMonth);

      if (delError) {
        console.error(
          "Erreur suppression anciens objectifs :",
          delError.message
        );
        toast.error("Erreur lors de l'enregistrement des objectifs");
        setSavingObjectifs(false);
        return;
      }

      const rows = (Object.keys(objectifs) as ActionType[]).map((type) => ({
        user_id: selectedUserId,
        action_type: type,
        period_type: "mois",
        period_code: selectedMonth,
        objectif: objectifs[type] ?? 0,
      }));

      const { error: insertError } = await sbAny
        .from("objectifs_actions")
        .insert(rows);

      if (insertError) {
        console.error(
          "Erreur insertion objectifs :",
          insertError.message
        );
        toast.error("Erreur lors de l'enregistrement des objectifs");
      } else {
        toast.success("Objectifs enregistrés");
        // Refresh de la vue d'ensemble
        await fetchAllObjectifs();
      }
    } finally {
      setSavingObjectifs(false);
    }
  };

  const handleAdd = async (
    categorie: "groupe" | "secteur" | "activite" | "concurrent"
  ) => {
    const valeur = newValues[categorie].trim();
    if (!valeur) return;

    const { error } = await supabase
      .from("parametrages")
      .insert({ categorie, valeur });

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
    const { error } = await supabase
      .from("parametrages")
      .delete()
      .eq("id", id);

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

          {/* Liste avec scroll interne */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={cancelEdit}
                    >
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
                      <Trash2 className="h-4 w-4 text-red-600" />
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

  // Lignes pour le tableau de synthèse des objectifs
  const objectifsTableRows =
    allObjectifs.length === 0
      ? []
      : allObjectifs
          .map((row) => {
            const user = users.find((u) => u.id === row.user_id);
            const userLabel = user?.label || "Utilisateur";
            let monthLabel = row.period_code;
            try {
              const [yearStr, monthStr] = row.period_code.split("-");
              const year = Number(yearStr);
              const month = Number(monthStr);
              if (!Number.isNaN(year) && !Number.isNaN(month)) {
                const d = new Date(year, month - 1, 1);
                monthLabel = format(d, "MM/yyyy");
              }
            } catch {
              // on laisse le code brut si problème
            }
            return {
              ...row,
              userLabel,
              monthLabel,
            };
          })
          .sort((a, b) => {
            if (a.userLabel < b.userLabel) return -1;
            if (a.userLabel > b.userLabel) return 1;
            return a.period_code.localeCompare(b.period_code);
          });

  return (
    <div className="space-y-6">
      {/* NOUVEL EN-TÊTE UNIFORMISÉ */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#840404]/10 rounded-lg">
            <Sliders className="h-6 w-6 text-[#840404]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Paramétrage & Objectifs
            </h1>
            <p className="text-slate-600">
              Configuration de l&apos;application
            </p>
          </div>
        </div>
      </div>
      {/* FIN DU NOUVEL EN-TÊTE */}

      {loading ? (
        <div className="text-center text-muted-foreground">Chargement...</div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {renderCategory("Groupes", "groupe")}
            {renderCategory("Secteurs", "secteur")}
            {renderCategory("Activités", "activite")}
            {renderCategory("Concurrents", "concurrent")}
          </div>

          {/* Section Objectifs – visible uniquement pour les admins */}
          {currentRole === "admin" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Objectifs commerciaux par utilisateur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Commercial
                    </span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedUserId || ""}
                      onChange={(e) =>
                        setSelectedUserId(
                          e.target.value ? e.target.value : null
                        )
                      }
                    >
                      {users.length === 0 && (
                        <option value="">Aucun utilisateur actif</option>
                      )}
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Mois
                    </span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      {MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ml-auto">
                    <Button
                      onClick={handleSaveObjectifs}
                      disabled={
                        !selectedUserId || savingObjectifs || loadingObjectifs
                      }
                    >
                      {savingObjectifs
                        ? "Enregistrement..."
                        : "Enregistrer les objectifs"}
                    </Button>
                  </div>
                </div>

                {loadingObjectifs ? (
                  <div className="text-sm text-muted-foreground">
                    Chargement des objectifs...
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {(Object.keys(objectifs) as ActionType[]).map((type) => (
                      <div
                        key={type}
                        className="flex flex-col gap-1 rounded-md border bg-card p-3"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {ACTION_LABELS[type]}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={objectifs[type]}
                          onChange={(e) =>
                            setObjectifs((prev) => ({
                              ...prev,
                              [type]: Number(e.target.value) || 0,
                            }))
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          Objectif mensuel
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tableau de synthèse des objectifs existants */}
                {objectifsTableRows.length > 0 && (
                  <div className="mt-6 border rounded-md overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                      Vue d&apos;ensemble des objectifs enregistrés
                    </div>
                    <div className="overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/60">
                            <th className="px-3 py-2 text-left font-medium">
                              Commercial
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Mois
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Visites
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Rdv
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Phoning
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Mailing
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {objectifsTableRows.map((row) => (
                            <tr
                              key={`${row.user_id}-${row.period_code}`}
                              className={`border-b cursor-pointer hover:bg-muted/60 ${
                                selectedUserId === row.user_id &&
                                selectedMonth === row.period_code
                                  ? "bg-muted"
                                  : "bg-background"
                              }`}
                              onClick={() => {
                                setSelectedUserId(row.user_id);
                                setSelectedMonth(row.period_code);
                              }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.userLabel}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.monthLabel}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.objectifs.visite}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.objectifs.rdv}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.objectifs.phoning}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.objectifs.mailing}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Parametrage;
