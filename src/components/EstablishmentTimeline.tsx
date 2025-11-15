// components/EstablishmentTimeline.tsx
import { MessageCircle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Action {
  id: string;
  type: "phoning" | "mailing" | "visite" | "rdv";
  date_action: string;
  statut_action: "effectue" | "a_venir" | "a_relancer";
  commentaire: string | null;
  user: { nom: string; prenom: string };
}

interface EstablishmentTimelineProps {
  actions: Action[];
}

const EstablishmentTimeline = ({ actions = [] }: EstablishmentTimelineProps) => {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'phoning': return '📞';
      case 'mailing': return '✉️';
      case 'visite': return '👥';
      case 'rdv': return '📅';
      default: return '📝';
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'phoning': return 'bg-blue-500';
      case 'mailing': return 'bg-purple-500';
      case 'visite': return 'bg-green-500';
      case 'rdv': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'phoning': return 'Appel téléphonique';
      case 'mailing': return 'Email';
      case 'visite': return 'Visite terrain';
      case 'rdv': return 'Rendez-vous';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'effectue': return 'bg-green-500 text-white';
      case 'a_venir': return 'bg-orange-500 text-white';
      case 'a_relancer': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="space-y-4">
      {actions && actions.map((action) => (
        <div key={action.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg ${getActionColor(action.type)}`}>
                {getActionIcon(action.type)}
              </div>
              <div>
                <Badge variant="secondary" className={`${getActionColor(action.type)} text-white border-0 text-sm`}>
                  {getActionLabel(action.type)}
                </Badge>
                <div className="text-sm text-slate-600 mt-1">
                  {new Date(action.date_action).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className={`${getStatusColor(action.statut_action)} border-0 text-xs`}>
                {action.statut_action === 'effectue' ? 'Effectué' : 
                 action.statut_action === 'a_venir' ? 'À venir' : 'À relancer'}
              </Badge>
            </div>
          </div>

          <div className="mb-3">
            <Textarea
              value={action.commentaire || ""}
              placeholder="Ajouter un commentaire..."
              className="resize-none text-sm min-h-[80px]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <User className="h-3 w-3" />
            <span>Par {action.user?.prenom || ''} {action.user?.nom || ''}</span>
          </div>
        </div>
      ))}
      
      {(!actions || actions.length === 0) && (
        <div className="text-center text-slate-500 py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <MessageCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p>Aucune action enregistrée</p>
        </div>
      )}
    </div>
  );
};

export default EstablishmentTimeline;