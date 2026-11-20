import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Pencil, Plus, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserView } from "@/contexts/UserViewContext";
import {
  createCrmUser,
  fetchCrmUsers,
  updateCrmUser,
  type CrmUser,
  type CrmUserRole,
} from "@/services/crmUsers.service";

type EditorMode = "create" | "edit";

const emptyForm = {
  email: "",
  password: "",
  prenom: "",
  nom: "",
  role: "commercial" as CrmUserRole,
  actif: true,
};

export function CrmUsersManager() {
  const { currentUserId } = useUserView();
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await fetchCrmUsers());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les utilisateurs.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: CrmUser) => {
    setMode("edit");
    setEditingId(user.id);
    setForm({
      email: user.email,
      password: "",
      prenom: user.prenom,
      nom: user.nom,
      role: user.role,
      actif: user.actif,
    });
    setDialogOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.prenom.trim() || !form.nom.trim()) {
      toast.error("Le prénom et le nom sont obligatoires.");
      return;
    }
    if (mode === "create" && (!form.email.trim() || form.password.length < 8)) {
      toast.error("Renseignez un email et un mot de passe d'au moins 8 caractères.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await createCrmUser({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          role: form.role,
          actif: form.actif,
        });
        toast.success("Utilisateur CRM créé.");
      } else if (editingId) {
        await updateCrmUser({
          id: editingId,
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          role: form.role,
          actif: form.actif,
        });
        toast.success("Utilisateur CRM mis à jour.");
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: CrmUser) => {
    if (user.id === currentUserId) return;
    try {
      await updateCrmUser({
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
        actif: !user.actif,
      });
      toast.success(user.actif ? "Compte désactivé." : "Compte réactivé.");
      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Modification impossible.",
      );
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#840404]" />
              Utilisateurs CRM
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez les accès du commercial et conservez l’historique des comptes inactifs.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement des utilisateurs…</p>
          ) : loadError ? (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <span>{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => void loadUsers()}>
                Réessayer
              </Button>
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun utilisateur CRM.</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#840404]/10 font-semibold text-[#840404]">
                      {(user.prenom[0] ?? user.email[0] ?? "U").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {user.prenom} {user.nom}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {user.role === "admin" ? "Administrateur" : "Commercial"}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            user.actif
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {user.actif ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <p className="truncate text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                    {user.id !== currentUserId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleActive(user)}
                      >
                        {user.actif ? (
                          <UserX className="mr-2 h-4 w-4 text-red-600" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                        )}
                        {user.actif ? "Désactiver" : "Réactiver"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Nouvel utilisateur CRM" : "Modifier l’utilisateur"}
            </DialogTitle>
            <DialogDescription>
              Un compte désactivé conserve toutes ses actions et son historique.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="crm-user-prenom">Prénom</Label>
                <Input
                  id="crm-user-prenom"
                  value={form.prenom}
                  onChange={(event) => setForm({ ...form, prenom: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-user-nom">Nom</Label>
                <Input
                  id="crm-user-nom"
                  value={form.nom}
                  onChange={(event) => setForm({ ...form, nom: event.target.value })}
                  required
                />
              </div>
            </div>
            {mode === "create" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="crm-user-email">Email</Label>
                  <Input
                    id="crm-user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crm-user-password">Mot de passe temporaire</Label>
                  <Input
                    id="crm-user-password"
                    type="password"
                    minLength={8}
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="crm-user-role">Rôle</Label>
                <select
                  id="crm-user-role"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value as CrmUserRole,
                    })
                  }
                >
                  <option value="commercial">Commercial</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-user-active">Statut</Label>
                <select
                  id="crm-user-active"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.actif ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm({ ...form, actif: event.target.value === "active" })
                  }
                  disabled={editingId === currentUserId}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

