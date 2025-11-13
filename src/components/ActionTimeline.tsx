import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Phone, Mail, MapPin, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Action {
  id: string;
  type: "phoning" | "mailing" | "visite" | "rdv";
  date_action: string;
  statut_action: "effectue" | "a_venir" | "a_relancer";
  commentaire: string | null;
  relance_date: string | null;
}

interface ActionTimelineProps {
  actions: Action[];
  onActionClick?: (action: Action) => void;
}

const getActionIcon = (type: string) => {
  switch (type) {
    case "phoning": return <Phone className="h-4 w-4" />;
    case "mailing": return <Mail className="h-4 w-4" />;
    case "visite": return <MapPin className="h-4 w-4" />;
    case "rdv": return <Calendar className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getActionColor = (type: string) => {
  switch (type) {
    case "phoning": return "bg-blue-500/10 text-blue-700 border-blue-200";
    case "mailing": return "bg-purple-500/10 text-purple-700 border-purple-200";
    case "visite": return "bg-green-500/10 text-green-700 border-green-200";
    case "rdv": return "bg-orange-500/10 text-orange-700 border-orange-200";
    default: return "bg-muted text-muted-foreground";
  }
};

const getActionLabel = (type: string) => {
  switch (type) {
    case "phoning": return "Phoning";
    case "mailing": return "Mailing";
    case "visite": return "Visite";
    case "rdv": return "Rendez-vous";
    default: return type;
  }
};

export function ActionTimeline({ actions, onActionClick }: ActionTimelineProps) {
  const now = new Date();
  const futureActions = actions.filter(a => new Date(a.date_action) >= now).sort((a, b) => 
    new Date(a.date_action).getTime() - new Date(b.date_action).getTime()
  );
  const pastActions = actions.filter(a => new Date(a.date_action) < now).sort((a, b) => 
    new Date(b.date_action).getTime() - new Date(a.date_action).getTime()
  );

  const renderAction = (action: Action, isPast: boolean) => (
    <div 
      key={action.id} 
      className="relative pl-8 pb-6 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
      onClick={() => onActionClick?.(action)}
    >
      <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${getActionColor(action.type)} ${isPast ? 'opacity-60' : ''}`}>
        {getActionIcon(action.type)}
      </div>
      <div className={`absolute left-3 top-8 w-0.5 h-full ${isPast ? 'bg-muted' : 'bg-primary/20'}`} />
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={getActionColor(action.type)}>
            {getActionLabel(action.type)}
          </Badge>
          <span className={`text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
            {format(new Date(action.date_action), "d MMMM yyyy", { locale: fr })}
          </span>
          {action.statut_action === "a_relancer" && action.relance_date && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
              Relance: {format(new Date(action.relance_date), "d MMM", { locale: fr })}
            </Badge>
          )}
        </div>
        {action.commentaire && (
          <p className={`text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
            {action.commentaire}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {futureActions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Actions à venir ({futureActions.length})
          </h4>
          <div className="space-y-2">
            {futureActions.map(action => renderAction(action, false))}
          </div>
        </div>
      )}

      {pastActions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-4">
            Actions passées ({pastActions.length})
          </h4>
          <div className="space-y-2">
            {pastActions.map(action => renderAction(action, true))}
          </div>
        </div>
      )}

      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucune action enregistrée
        </p>
      )}
    </div>
  );
}
