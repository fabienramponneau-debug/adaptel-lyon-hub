import { differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, MapPin } from "lucide-react";

interface EstablishmentIndicatorsProps {
  createdAt: string;
  lastActionDate: string | null;
  lastVisitDate: string | null;
}

export function EstablishmentIndicators({
  createdAt,
  lastActionDate,
  lastVisitDate,
}: EstablishmentIndicatorsProps) {
  const now = new Date();

  const daysSinceCreated = differenceInDays(now, new Date(createdAt));
  const weeksSinceCreated = differenceInWeeks(now, new Date(createdAt));
  const monthsSinceCreated = differenceInMonths(now, new Date(createdAt));

  let prospectDuration = "";
  if (monthsSinceCreated > 0) {
    prospectDuration = `${monthsSinceCreated} mois`;
  } else if (weeksSinceCreated > 0) {
    prospectDuration = `${weeksSinceCreated} semaine${weeksSinceCreated > 1 ? 's' : ''}`;
  } else {
    prospectDuration = `${daysSinceCreated} jour${daysSinceCreated > 1 ? 's' : ''}`;
  }

  let lastActionText = "";
  if (lastActionDate) {
    const daysSinceAction = differenceInDays(now, new Date(lastActionDate));
    if (daysSinceAction === 0) {
      lastActionText = "Aujourd'hui";
    } else if (daysSinceAction === 1) {
      lastActionText = "Hier";
    } else if (daysSinceAction < 30) {
      lastActionText = `${daysSinceAction} jours`;
    } else {
      const monthsSinceAction = differenceInMonths(now, new Date(lastActionDate));
      lastActionText = `${monthsSinceAction} mois`;
    }
  }

  let lastVisitText = "";
  if (lastVisitDate) {
    const daysSinceVisit = differenceInDays(now, new Date(lastVisitDate));
    const monthsSinceVisit = differenceInMonths(now, new Date(lastVisitDate));
    if (monthsSinceVisit > 0) {
      lastVisitText = `${monthsSinceVisit} mois`;
    } else {
      lastVisitText = `${daysSinceVisit} jour${daysSinceVisit > 1 ? 's' : ''}`;
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className="gap-1.5">
        <Clock className="h-3 w-3" />
        Prospect depuis {prospectDuration}
      </Badge>
      
      {lastActionText && (
        <Badge variant="outline" className="gap-1.5">
          <Calendar className="h-3 w-3" />
          Dernière action il y a {lastActionText}
        </Badge>
      )}
      
      {lastVisitText && (
        <Badge 
          variant="outline" 
          className={`gap-1.5 ${differenceInMonths(now, new Date(lastVisitDate!)) > 3 ? 'border-orange-500 text-orange-700' : ''}`}
        >
          <MapPin className="h-3 w-3" />
          Dernière visite il y a {lastVisitText}
        </Badge>
      )}
    </div>
  );
}
