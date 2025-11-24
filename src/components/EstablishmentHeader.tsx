// src/components/EstablishmentHeader.tsx
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Building2,
  Save,
  X,
  Phone,
  Mail,
  Calendar,
  MapPin,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";

type QuickActionType = "phoning" | "mailing" | "visite" | "rdv";

interface EstablishmentHeaderProps {
  establishment: any;
  loading: boolean;
  saving: boolean;
  onEstablishmentChange: (updates: any) => void;
  onSave: () => void;
  onClose: () => void;
  onQuickAction?: (type: QuickActionType) => void;
}

export const EstablishmentHeader = ({
  establishment,
  loading,
  saving,
  onEstablishmentChange,
  onSave,
  onClose,
  onQuickAction,
}: EstablishmentHeaderProps) => {
  if (loading) {
    return (
      <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-slate-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-9 w-9 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!establishment) return null;

  return (
    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
      <div className="flex items-start justify-between gap-4">
        {/* Bloc gauche : avatar + nom + statut dessous */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] flex items-center justify-center shadow-lg flex-shrink-0">
            <Building2 className="h-8 w-8 text-white" />
          </div>

          <div className="flex flex-col flex-1 min-w-0 space-y-2">
            {/* Nom établissement */}
            <Input
              value={establishment.nom || ""}
              onChange={(e) => onEstablishmentChange({ nom: e.target.value })}
              className="border-none p-0 h-auto text-[26px] md:text-[30px] leading-tight font-semibold tracking-tight bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0"
              placeholder="Nom de l'établissement"
            />

            {/* Statut sous le nom */}
            {establishment.statut && (
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={
                    establishment.statut as
                      | "prospect"
                      | "client"
                      | "ancien_client"
                  }
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Bloc droit : actions + sauvegarde */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Actions rapides */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                title="Phoning"
                onClick={() => onQuickAction && onQuickAction("phoning")}
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                title="Mailing"
                onClick={() => onQuickAction && onQuickAction("mailing")}
              >
                <Mail className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                title="Visite terrain"
                onClick={() => onQuickAction && onQuickAction("visite")}
              >
                <MapPin className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                title="Rendez-vous"
                onClick={() => onQuickAction && onQuickAction("rdv")}
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>

            <Button
              onClick={onSave}
              disabled={saving}
              className="gap-2 bg-[#840404] hover:bg-[#730303] shadow-sm"
            >
              <Save className="h-4 w-4" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="border-slate-300 shadow-sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
