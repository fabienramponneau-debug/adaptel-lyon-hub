import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Phone, User, Pencil, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EstablishmentContactsProps {
  contacts: any[];
  establishmentId: string | null;
  onContactsUpdate: () => Promise<void> | void;
}

export default function EstablishmentContacts({
  contacts,
  establishmentId,
  onContactsUpdate,
}: EstablishmentContactsProps) {
  const [creating, setCreating] = useState(false);
  const [newContact, setNewContact] = useState({
    nom: "",
    prenom: "",
    fonction: "",
    telephone: "",
    email: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!establishmentId) return;
    if (!newContact.nom.trim()) return;

    setSavingId("new");
    await supabase.from("contacts").insert({
      etablissement_id: establishmentId,
      nom: newContact.nom.trim(),
      prenom: newContact.prenom.trim(),
      fonction: newContact.fonction.trim() || null,
      telephone: newContact.telephone.trim() || null,
      email: newContact.email.trim() || null,
      actif: true,
    } as any);
    setSavingId(null);
    setNewContact({
      nom: "",
      prenom: "",
      fonction: "",
      telephone: "",
      email: "",
    });
    setCreating(false);
    await onContactsUpdate();
  };

  const startEdit = (contact: any) => {
    setEditingId(contact.id);
    setEditingContact({
      nom: contact.nom || "",
      prenom: contact.prenom || "",
      fonction: contact.fonction || "",
      telephone: contact.telephone || "",
      email: contact.email || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContact(null);
  };

  const handleUpdate = async (id: string) => {
    if (!editingContact) return;
    setSavingId(id);
    await supabase
      .from("contacts")
      .update({
        nom: editingContact.nom.trim(),
        prenom: editingContact.prenom.trim(),
        fonction: editingContact.fonction.trim() || null,
        telephone: editingContact.telephone.trim() || null,
        email: editingContact.email.trim() || null,
      } as any)
      .eq("id", id);
    setSavingId(null);
    cancelEdit();
    await onContactsUpdate();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("contacts").delete().eq("id", id);
    setDeletingId(null);
    await onContactsUpdate();
  };

  return (
    <Card className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-[15px]">
              Contacts
            </h3>
            <p className="text-slate-500 text-xs">
              {contacts.length} contact(s) associé(s)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 text-xs border-slate-300"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? "Annuler" : "Ajouter"}
          </Button>
        </div>

        {/* Formulaire ajout */}
        {creating && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-700">
                  Nom *
                </label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={newContact.nom}
                  onChange={(e) =>
                    setNewContact((c) => ({ ...c, nom: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Prénom
                </label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={newContact.prenom}
                  onChange={(e) =>
                    setNewContact((c) => ({
                      ...c,
                      prenom: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Fonction
                </label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={newContact.fonction}
                  onChange={(e) =>
                    setNewContact((c) => ({
                      ...c,
                      fonction: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Téléphone
                </label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={newContact.telephone}
                  onChange={(e) =>
                    setNewContact((c) => ({
                      ...c,
                      telephone: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Email
                </label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact((c) => ({
                      ...c,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setCreating(false);
                  setNewContact({
                    nom: "",
                    prenom: "",
                    fonction: "",
                    telephone: "",
                    email: "",
                  });
                }}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-[#840404] hover:bg-[#6f0303]"
                onClick={handleCreate}
                disabled={savingId === "new"}
              >
                {savingId === "new" ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}

        {/* Liste contacts */}
        <div className="space-y-3">
          {contacts.map((c) => {
            const isEditing = editingId === c.id;

            return (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 space-y-1.5">
                  {isEditing ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          className="h-8 text-sm"
                          placeholder="Nom"
                          value={editingContact?.nom ?? ""}
                          onChange={(e) =>
                            setEditingContact((prev: any) => ({
                              ...prev,
                              nom: e.target.value,
                            }))
                          }
                        />
                        <Input
                          className="h-8 text-sm"
                          placeholder="Prénom"
                          value={editingContact?.prenom ?? ""}
                          onChange={(e) =>
                            setEditingContact((prev: any) => ({
                              ...prev,
                              prenom: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Fonction"
                          value={editingContact?.fonction ?? ""}
                          onChange={(e) =>
                            setEditingContact((prev: any) => ({
                              ...prev,
                              fonction: e.target.value,
                            }))
                          }
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="Téléphone"
                          value={editingContact?.telephone ?? ""}
                          onChange={(e) =>
                            setEditingContact((prev: any) => ({
                              ...prev,
                              telephone: e.target.value,
                            }))
                          }
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="Email"
                          value={editingContact?.email ?? ""}
                          onChange={(e) =>
                            setEditingContact((prev: any) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-medium text-sm text-slate-900">
                          {c.prenom} {c.nom}
                        </span>
                        {c.fonction && (
                          <span className="text-xs text-slate-500">
                            • {c.fonction}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        {c.telephone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{c.telephone}</span>
                          </span>
                        )}
                        {c.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{c.email}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-white">
                          {c.actif ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    </>
                  )}

                  {isEditing && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={cancelEdit}
                      >
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] bg-[#840404] hover:bg-[#6f0303]"
                        onClick={() => handleUpdate(c.id)}
                        disabled={savingId === c.id}
                      >
                        {savingId === c.id
                          ? "Enregistrement..."
                          : "Enregistrer"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Icônes modifier / supprimer */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                    onClick={() =>
                      isEditing ? cancelEdit() : startEdit(c)
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-100 bg-white text-red-500 hover:bg-red-50"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
