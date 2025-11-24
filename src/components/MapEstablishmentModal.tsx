// src/components/MapEstablishmentModal.tsx

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EstablishmentTimeline } from "./EstablishmentTimeline";
import { Button } from "@/components/ui/button";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";

type QuickActionType = "phoning" | "mailing" | "visite" | "rdv";

interface Props {
  establishmentId: string | null;
  open: boolean;
  onClose: () => void;
}

export const MapEstablishmentModal = ({
  establishmentId,
  open,
  onClose,
}: Props) => {
  const [establishment, setEstablishment] = useState<any | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [externalEditActionId, setExternalEditActionId] =
    useState<string | null>(null);

  // Fermeture via ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const fetchActionsOnly = async (id: string) => {
    setActionsLoading(true);
    const { data: a } = await supabase
      .from("actions")
      .select(`*, user:user_id(nom, prenom)`)
      .eq("etablissement_id", id)
      .order("date_action", { ascending: false });
    setActions(a || []);
    setActionsLoading(false);
  };

  // Chargement données établissement + actions
  useEffect(() => {
    if (!open || !establishmentId) return;

    const fetchAll = async () => {
      setLoading(true);
      const [{ data: est }, { data: a }] = await Promise.all([
        supabase
          .from("establishments")
          .select(
            `id, nom, statut, adresse, code_postal, ville, commentaire,
             groupe:groupe_id(valeur),
             secteur:secteur_id(valeur),
             activite:activite_id(valeur)`
          )
          .eq("id", establishmentId)
          .single(),
        supabase
          .from("actions")
          .select(`*, user:user_id(nom, prenom)`)
          .eq("etablissement_id", establishmentId)
          .order("date_action", { ascending: false }),
      ]);

      setEstablishment(est || null);
      setActions(a || []);
      setLoading(false);
    };

    void fetchAll();
  }, [open, establishmentId]);

  const handleQuickAction = async (type: QuickActionType) => {
    if (!establishmentId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const payload = {
      etablissement_id: establishmentId,
      type,
      date_action: dateStr,
      statut_action: "a_venir" as const,
      commentaire: null,
      user_id: user.id,
      contact_vu: null,
    };

    const { data, error } = await supabase
      .from("actions")
      .insert(payload as any)
      .select("id");

    if (!error && data && data.length > 0) {
      const inserted = data[0];
      setExternalEditActionId(inserted.id);
    }

    await fetchActionsOnly(establishmentId);
  };

  const getStatusLabel = (statut: string | null | undefined) => {
    switch (statut) {
      case "client":
        return "Client actuel";
      case "prospect":
        return "Prospect";
      case "ancien_client":
        return "Ancien client";
      default:
        return "Statut non renseigné";
    }
  };

  const getStatusColor = (statut: string | null | undefined) => {
    switch (statut) {
      case "client":
        return "#16a34a"; // vert
      case "prospect":
        return "#f97316"; // orange
      case "ancien_client":
        return "#6b7280"; // gris
      default:
        return "#6b7280";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      {/* Overlay clicable */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Contenu modale */}
      <div className="relative z-[10000] w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#840404]/10 rounded-lg">
              <Building2 className="h-5 w-5 text-[#840404]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  {loading || !establishment ? "Établissement" : establishment.nom}
                </h2>
                {establishment && (
                  <span
                    className="px-2 py-0.5 rounded-md text-xs font-medium text-white"
                    style={{ backgroundColor: getStatusColor(establishment.statut) }}
                  >
                    {getStatusLabel(establishment.statut)}
                  </span>
                )}
              </div>
              {establishment && (
                <p className="text-xs text-slate-500">
                  Préparation prospection · timeline & actions rapides
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition text-sm"
          >
            Fermer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Bloc infos de base */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                Informations établissement
              </h3>
              {loading || !establishment ? (
                <div className="space-y-2 text-sm text-slate-400">
                  Chargement des informations...
                </div>
              ) : (
                <div className="space-y-1 text-sm text-slate-700">
                  <div className="font-medium">{establishment.nom}</div>
                  {(establishment.adresse ||
                    establishment.code_postal ||
                    establishment.ville) && (
                    <div className="text-slate-600">
                      {establishment.adresse && (
                        <>
                          {establishment.adresse}
                          <br />
                        </>
                      )}
                      {(establishment.code_postal || establishment.ville) && (
                        <>
                          {establishment.code_postal || ""}
                          {establishment.code_postal && establishment.ville
                            ? " "
                            : ""}
                          {establishment.ville || ""}
                        </>
                      )}
                    </div>
                  )}
                  {establishment.secteur?.valeur && (
                    <div className="text-xs text-slate-500 mt-1">
                      Secteur : {establishment.secteur.valeur}
                    </div>
                  )}
                  {establishment.activite?.valeur && (
                    <div className="text-xs text-slate-500">
                      Activité : {establishment.activite.valeur}
                    </div>
                  )}
                  {establishment.groupe?.valeur && (
                    <div className="text-xs text-slate-500">
                      Groupe : {establishment.groupe.valeur}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions rapides */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                Actions rapides
              </h3>
              <p className="text-xs text-slate-500">
                Crée une action directement depuis la carte pour planifier ta prospection.
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex items-center gap-1"
                  onClick={() => handleQuickAction("phoning")}
                >
                  <Phone className="h-3 w-3" />
                  Phoning
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex items-center gap-1"
                  onClick={() => handleQuickAction("mailing")}
                >
                  <Mail className="h-3 w-3" />
                  Mailing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex items-center gap-1"
                  onClick={() => handleQuickAction("visite")}
                >
                  <MapPin className="h-3 w-3" />
                  Visite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex items-center gap-1"
                  onClick={() => handleQuickAction("rdv")}
                >
                  <Calendar className="h-3 w-3" />
                  RDV
                </Button>
              </div>
              {actionsLoading && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Mise à jour de la timeline...
                </p>
              )}
            </div>
          </div>

          {/* Commentaire éventuel */}
          {establishment?.commentaire && (
            <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <p className="text-xs font-semibold text-slate-700 mb-1">
                Commentaire CRM
              </p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">
                {establishment.commentaire}
              </p>
            </div>
          )}

          {/* Timeline */}
          {establishmentId && (
            <div className="border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Timeline des actions
              </h3>
              <EstablishmentTimeline
                actions={actions}
                loading={loading || actionsLoading}
                establishmentId={establishmentId}
                onChanged={() => fetchActionsOnly(establishmentId)}
                externalEditActionId={externalEditActionId}
                onResetExternalEdit={() => setExternalEditActionId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEstablishmentModal;
