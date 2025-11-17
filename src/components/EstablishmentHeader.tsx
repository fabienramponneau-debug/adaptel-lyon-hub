import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Calendar, Mail, MapPin, Phone, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { useState } from "react";

interface Props {
  establishment: any; loading: boolean; saving: boolean;
  onEstablishmentChange: (patch:any)=>void;
  onClose: () => void;
}

export const EstablishmentHeader = ({ establishment, loading, saving, onEstablishmentChange, onClose }: Props) => {
  const [hover, setHover] = useState(false);

  if (loading) return (
    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
      <div className="h-7 w-56 bg-slate-200 rounded animate-pulse"/>
    </div>
  );

  return (
    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] flex items-center justify-center shadow">
            <Building2 className="h-7 w-7 text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <Input
              value={establishment?.nom || ""}
              onChange={(e)=>onEstablishmentChange({ nom: e.target.value })}
              className="text-3xl font-semibold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
              placeholder="Nom de l'établissement"
            />
            <div className="mt-2 flex items-center gap-3">
              <Select value={establishment?.statut || "prospect"} onValueChange={(v:any)=>onEstablishmentChange({ statut: v })}>
                <SelectTrigger className="h-8 w-40 border-slate-300 bg-white"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="ancien_client">Ancien client</SelectItem>
                </SelectContent>
              </Select>
              {establishment?.statut && <StatusBadge status={establishment.statut} size="sm" />}
              {saving && <span className="text-xs text-slate-500">Sauvegarde…</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* actions rapides (sobre dans cercles) */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            <div title="Phoning" className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <Phone className="h-4 w-4 text-slate-700"/>
            </div>
            <div title="Mailing" className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <Mail className="h-4 w-4 text-slate-700"/>
            </div>
            <div title="Visite terrain" className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <MapPin className="h-4 w-4 text-slate-700"/>
            </div>
            <div title="Rendez-vous" className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <Calendar className="h-4 w-4 text-slate-700"/>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-md border border-slate-300 flex items-center justify-center hover:bg-slate-50" aria-label="Fermer">
            <X className="h-4 w-4"/>
          </button>
        </div>
      </div>
    </div>
  );
};
