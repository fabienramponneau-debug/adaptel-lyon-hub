import { useEffect, useState } from "react";
import {
  Clock,
  MessageCircle,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";

type StatutAction = "effectue" | "a_venir" | "a_relancer";

interface Action {
  id: string;
  type: "phoning" | "mailing" | "visite" | "rdv" | string;
  date_action: string;
  commentaire: string | null;
  statut_action: StatutAction;
  user: {
    nom: string;
    prenom: string;
  } | null;
}

interface EstablishmentTimelineProps {
  actions: Action[];
  loading: boolean;
  establishmentId: string;
  onChanged: () => Promise<void>;
  externalEditActionId?: string | null;
  onResetExternalEdit?: () => void;
}

export const EstablishmentTimeline = ({
  actions,
  loading,
  establishmentId,
  onChanged,
  externalEditActionId,
  onResetExternalEdit,
}: EstablishmentTimelineProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState("");
  const [editingStatus, setEditingStatus] =
    useState<StatutAction>("a_venir");
  const [editingDate, setEditingDate] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Ouverture auto en édition pour les actions rapides
  useEffect(() => {
    if (!externalEditActionId) return;
    const action = actions.find((a) => a.id === externalEditActionId);
    if (!action) return;

    setEditingId(action.id);
    setEditingComment(action.commentaire ?? "");
    setEditingStatus(action.statut_action ?? "a_venir");
    setEditingDate(action.date_action ?? "");

    // On consomme l'ID externe une fois utilisé
    if (onResetExternalEdit) {
      onResetExternalEdit();
    }
  }, [externalEditActionId, actions, onResetExternalEdit]);

  const getActionConfig = (type: string) => {
    const configs = {
      phoning: {
        icon: Phone,
        label: "Phoning",
      },
      mailing: {
        icon: Mail,
        label: "Mailing",
      },
      visite: {
        icon: MapPin,
        label: "Visite", // au lieu de "Visite terrain"
      },
      rdv: {
        icon: Calendar,
        label: "Rdv", // au lieu de "Rendez-vous"
      },
    } as const;

    return (
      configs[type as keyof typeof configs] || {
        icon: MessageCircle,
        label: type,
      }
    );
  };

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      effectue: {
        label: "Effectué",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      },
      a_venir: {
        label: "Planifié",
        className: "bg-sky-50 text-sky-800 border-sky-200",
      },
      a_relancer: {
        label: "À relancer",
        className: "bg-amber-50 text-amber-800 border-amber-200",
      },
    };

    return (
      map[status] || {
        label: status,
        className: "bg-slate-50 text-slate-700 border-slate-200",
      }
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const startEdit = (action: Action) => {
    setEditingId(action.id);
    setEditingComment(action.commentaire ?? "");
    setEditingStatus(action.statut_action ?? "a_venir");
    setEditingDate(action.date_action ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingComment("");
    setEditingStatus("a_venir");
    setEditingDate("");
  };

  const handleUpdate = async (id: string) => {
    setSavingId(id);
    await supabase
      .from("actions")
      .update({
        commentaire:
          editingComment.trim() === "" ? null : editingComment.trim(),
        statut_action: editingStatus,
        date_action: editingDate || null,
      } as any)
      .eq("id", id)
      .eq("etablissement_id", establishmentId);

    setSavingId(null);
    cancelEdit(); // on ferme les champs
    await onChanged(); // refresh propre
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase
      .from("actions")
      .delete()
      .eq("id", id)
      .eq("etablissement_id", establishmentId);
    setDeletingId(null);
    await onChanged();
  };

  if (loading) {
    return (
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                Suivi des actions
              </h3>
              <p className="text-slate-500 text-sm">Chargement...</p>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="flex flex-col items-center pt-2">
                  <div className="w-2 h-2 rounded-full bg-slate-200" />
                  <div className="w-px flex-1 bg-slate-100 mt-1" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-10 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
      <CardContent className="p-6 space-y-6">
        {/* Titre de section */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] flex items-center justify-center shadow-sm">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                Suivi des actions
              </h3>
              <p className="text-slate-500 text-sm">
                {actions.length} action(s) enregistrée(s)
              </p>
            </div>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Clock className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium">
              Aucune action enregistrée
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Les appels, mails, visites et rendez-vous apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action, index) => {
              const { icon: IconComponent, label } = getActionConfig(
                action.type
              );
              const statusCfg = getStatusConfig(action.statut_action);
              const dateLabel = formatDate(action.date_action);
              const prenom = action.user?.prenom ?? "";
              const isEditing = editingId === action.id;

              return (
                <div key={action.id} className="flex gap-4 items-stretch">
                  {/* Colonne timeline : ligne continue + point centré */}
                  <div className="relative flex flex-col items-center w-6">
                    <div className="absolute top-0 bottom-0 w-px bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-400 relative z-10" />
                  </div>

                  {/* Vignette action */}
                  <div className="flex-1">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 space-y-3">
                      {/* Ligne haute : type d'action + statut + actions (edit/delete) */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-50">
                            <IconComponent className="h-3.5 w-3.5" />
                          </span>
                          <span>{label}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <select
                              className="h-7 min-w-[120px] rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-700"
                              value={editingStatus}
                              onChange={(e) =>
                                setEditingStatus(
                                  e.target.value as StatutAction
                                )
                              }
                            >
                              <option value="a_venir">Planifié</option>
                              <option value="effectue">Effectué</option>
                              <option value="a_relancer">À relancer</option>
                            </select>
                          ) : (
                            <div
                              className={[
                                "inline-flex items-center justify-center h-7 min-w-[96px] px-3 text-[13px] rounded-md border font-medium",
                                statusCfg.className,
                              ].join(" ")}
                            >
                              {statusCfg.label}
                            </div>
                          )}

                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                            onClick={() =>
                              isEditing ? cancelEdit() : startEdit(action)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-100 bg-white text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(action.id)}
                            disabled={deletingId === action.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Ligne date / user (avec date éditable) */}
                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        {isEditing ? (
                          <input
                            type="date"
                            className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800"
                            value={editingDate || ""}
                            onChange={(e) =>
                              setEditingDate(e.target.value)
                            }
                          />
                        ) : (
                          <span className="font-medium capitalize">
                            {dateLabel}
                          </span>
                        )}

                        {prenom && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{prenom}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Commentaire / édition */}
                      {isEditing ? (
                        <div className="flex gap-2 text-sm text-slate-700">
                          <MessageCircle className="h-4 w-4 mt-1 text-slate-400 flex-shrink-0" />
                          <textarea
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 resize-none"
                            rows={3}
                            value={editingComment}
                            onChange={(e) =>
                              setEditingComment(e.target.value)
                            }
                            placeholder="Commentaire..."
                          />
                        </div>
                      ) : (
                        action.commentaire && (
                          <div className="flex gap-2 text-sm text-slate-700">
                            <MessageCircle className="h-4 w-4 mt-0.5 text-slate-400 flex-shrink-0" />
                            <p className="leading-relaxed">
                              {action.commentaire}
                            </p>
                          </div>
                        )
                      )}

                      {/* Actions de validation en mode édition */}
                      {isEditing && (
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 h-7 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdate(action.id)}
                            disabled={savingId === action.id}
                            className="px-3 h-7 rounded-md bg-[#840404] text-xs text-white hover:bg-[#6f0303]"
                          >
                            {savingId === action.id
                              ? "Enregistrement..."
                              : "Enregistrer"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
