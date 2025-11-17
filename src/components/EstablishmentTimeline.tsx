// src/components/EstablishmentTimeline.tsx
import { useState } from "react";
import {
  Clock,
  MessageCircle,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Action {
  id: string;
  type: string;
  date_action: string;
  commentaire: string | null;
  statut_action: string;
  user: {
    nom: string;
    prenom: string;
  };
}

interface EstablishmentTimelineProps {
  actions: Action[];
  loading: boolean;
  /** Pour créer des actions depuis la fiche établissement */
  establishmentId?: string | null;
  /** Callback pour recharger les données après création */
  onChanged?: () => Promise<void> | void;
}

type ActionType = "phoning" | "mailing" | "visite" | "rdv";
type ActionStatus = "effectue" | "a_venir" | "a_relancer";

export const EstablishmentTimeline = ({
  actions,
  loading,
  establishmentId,
  onChanged,
}: EstablishmentTimelineProps) => {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newType, setNewType] = useState<ActionType>("phoning");
  const [newStatus, setNewStatus] = useState<ActionStatus>("a_venir");
  const [newDate, setNewDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [newTime, setNewTime] = useState<string>("09:00");
  const [newComment, setNewComment] = useState("");

  const getActionConfig = (type: string) => {
    const configs = {
      phoning: {
        icon: Phone,
        label: "Phoning",
        chipClass:
          "bg-sky-50 text-sky-800 border border-sky-200",
      },
      mailing: {
        icon: Mail,
        label: "Mailing",
        chipClass:
          "bg-indigo-50 text-indigo-800 border border-indigo-200",
      },
      visite: {
        icon: MapPin,
        label: "Visite terrain",
        chipClass:
          "bg-emerald-50 text-emerald-800 border border-emerald-200",
      },
      rdv: {
        icon: Calendar,
        label: "Rendez-vous",
        chipClass:
          "bg-amber-50 text-amber-800 border border-amber-200",
      },
    };

    return (
      configs[type as keyof typeof configs] || {
        icon: MessageCircle,
        label: type,
        chipClass:
          "bg-slate-50 text-slate-800 border border-slate-200",
      }
    );
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      effectue: {
        label: "Terminé",
        className:
          "bg-emerald-50 text-emerald-800 border border-emerald-200",
      },
      a_venir: {
        label: "Planifié",
        className:
          "bg-sky-50 text-sky-800 border border-sky-200",
      },
      a_relancer: {
        label: "À relancer",
        className:
          "bg-amber-50 text-amber-800 border border-amber-200",
      },
    };

    return (
      configs[status as keyof typeof configs] || {
        label: status,
        className:
          "bg-slate-50 text-slate-800 border border-slate-200",
      }
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    const datePartRaw = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });

    const datePart =
      datePartRaw.charAt(0).toUpperCase() + datePartRaw.slice(1);

    const timePart = date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${datePart} · ${timePart}`;
  };

  const quickSetType = (type: ActionType) => {
    setCreating(true);
    setNewType(type);
  };

  const handleCreate = async (e: any) => {
    e.preventDefault();
    if (!establishmentId) {
      toast.error("Établissement introuvable pour cette action.");
      return;
    }

    try {
      setSaving(true);

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;

      if (!userId) {
        toast.error("Vous devez être connecté pour enregistrer une action.");
        return;
      }

      const combinedDate = new Date(`${newDate}T${newTime}:00`);

      const { error } = await supabase.from("actions").insert({
        etablissement_id: establishmentId,
        user_id: userId,
        type: newType,
        statut_action: newStatus,
        date_action: combinedDate.toISOString(),
        commentaire: newComment || null,
      });

      if (error) {
        console.error(error);
        toast.error("Erreur lors de l’enregistrement de l’action.");
        return;
      }

      toast.success("Action enregistrée.");
      setCreating(false);
      setNewComment("");
      setNewStatus("a_venir");

      if (onChanged) {
        await onChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                Historique des actions
              </h3>
              <p className="text-slate-500 text-sm">Chargement…</p>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-slate-200" />
                  <div className="w-px h-full bg-slate-100 mt-1" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 rounded" />
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
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                Historique des actions
              </h3>
              <p className="text-slate-500 text-xs">
                {actions.length} action(s) enregistrée(s)
              </p>
            </div>
          </div>

          {establishmentId && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden sm:inline">
                Saisie rapide
              </span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full border-slate-200"
                  onClick={() => quickSetType("phoning")}
                  title="Phoning"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full border-slate-200"
                  onClick={() => quickSetType("mailing")}
                  title="Mailing"
                >
                  <Mail className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full border-slate-200"
                  onClick={() => quickSetType("visite")}
                  title="Visite terrain"
                >
                  <MapPin className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full border-slate-200"
                  onClick={() => quickSetType("rdv")}
                  title="Rendez-vous"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bloc création d’action */}
        {establishmentId && creating && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-medium text-slate-700">
                  Type
                </span>
                <Select
                  value={newType}
                  onValueChange={(v) => setNewType(v as ActionType)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phoning">Phoning</SelectItem>
                    <SelectItem value="mailing">Mailing</SelectItem>
                    <SelectItem value="visite">Visite terrain</SelectItem>
                    <SelectItem value="rdv">Rendez-vous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-700">
                  Statut
                </span>
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as ActionStatus)}
                >
                  <SelectTrigger className="h-9 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="effectue">Terminé</SelectItem>
                    <SelectItem value="a_venir">Planifié</SelectItem>
                    <SelectItem value="a_relancer">À relancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-700">
                  Date
                </span>
                <Input
                  type="date"
                  className="h-9 text-xs w-[140px]"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-700">
                  Heure
                </span>
                <Input
                  type="time"
                  className="h-9 text-xs w-[100px]"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-700">
                Commentaire
              </span>
              <Textarea
                rows={2}
                className="text-xs resize-none"
                placeholder="Détail de l’action (optionnel)…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCreating(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs"
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Enregistrer l’action"}
              </Button>
            </div>
          </form>
        )}

        {/* Aucune action */}
        {actions.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium text-sm mb-1">
              Aucune action enregistrée
            </p>
            <p className="text-slate-400 text-xs">
              Les appels, mails, visites et rendez-vous apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {actions.map((action, index) => {
              const config = getActionConfig(action.type);
              const statusConfig = getStatusConfig(action.statut_action);
              const IconComponent = config.icon;

              return (
                <div key={action.id} className="group relative">
                  {index < actions.length - 1 && (
                    <div className="absolute left-5 top-11 w-px h-[calc(100%-2.75rem)] bg-slate-100" />
                  )}

                  <div className="relative flex gap-3 p-4 rounded-xl hover:bg-slate-50/80 transition-colors border border-transparent group-hover:border-slate-200">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                        <IconComponent className="h-4 w-4 text-slate-700" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium ${config.chipClass}`}
                            >
                              {config.label}
                            </span>
                          </div>
                          <p className="text-slate-500 text-xs font-medium">
                            {formatDate(action.date_action)}
                          </p>
                        </div>
                        <div
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </div>
                      </div>

                      {action.commentaire && (
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="flex items-start gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                            <p className="text-slate-700 text-xs leading-relaxed">
                              {action.commentaire}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="h-3 w-3 text-slate-600" />
                        </div>
                        <span className="font-medium">
                          {action.user?.prenom} {action.user?.nom}
                        </span>
                      </div>
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
