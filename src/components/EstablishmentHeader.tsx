// components/EstablishmentHeader.tsx
import { Building2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface EstablishmentHeaderProps {
  establishment: any;
  loading: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onEstablishmentChange: (updates: any) => void;
}

const EstablishmentHeader = ({ 
  establishment, 
  loading, 
  saving, 
  onSave, 
  onClose, 
  onEstablishmentChange 
}: EstablishmentHeaderProps) => {
  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'prospect': 
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Prospect</Badge>;
      case 'client': 
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Client</Badge>;
      case 'ancien_client': 
        return <Badge variant="secondary" className="bg-slate-100 text-slate-800 border-slate-200">Ancien client</Badge>;
      default: 
        return null;
    }
  };

  return (
    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[#840404] to-[#a00606] flex items-center justify-center shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          
          <div className="flex-1">
            {loading ? (
              <div className="h-8 w-64 bg-slate-200 rounded animate-pulse"></div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Input
                    value={establishment?.nom || ""}
                    onChange={(e) => onEstablishmentChange({ nom: e.target.value })}
                    className="text-3xl font-bold border-none p-0 h-auto focus:ring-0 font-semibold bg-transparent w-auto min-w-[300px]"
                    placeholder="Nom de l'établissement"
                  />
                  {establishment?.statut && getStatusBadge(establishment.statut)}
                </div>
                
                <div className="flex items-center gap-4">
                  <Select
                    value={establishment?.statut || "prospect"}
                    onValueChange={(value: "prospect" | "client" | "ancien_client") => 
                      onEstablishmentChange({ statut: value })
                    }
                  >
                    <SelectTrigger className="h-8 w-40 border-slate-300 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="ancien_client">Ancien client</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="text-sm text-slate-500">
                    Modifié le {new Date().toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={onSave}
            disabled={saving}
            className="gap-2 bg-[#840404] hover:bg-[#730303] shadow-lg"
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
  );
};

export default EstablishmentHeader;