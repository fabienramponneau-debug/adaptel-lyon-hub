import { Phone, Mail, MapPin, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Action {
  type: "phoning" | "mailing" | "visite" | "rdv";
}

interface ActionStatsProps {
  actions: Action[];
}

export function ActionStats({ actions }: ActionStatsProps) {
  const stats = {
    phoning: actions.filter(a => a.type === "phoning").length,
    mailing: actions.filter(a => a.type === "mailing").length,
    visite: actions.filter(a => a.type === "visite").length,
    rdv: actions.filter(a => a.type === "rdv").length,
  };

  const statItems = [
    { label: "Phoning", count: stats.phoning, icon: Phone, color: "text-blue-600" },
    { label: "Mailing", count: stats.mailing, icon: Mail, color: "text-purple-600" },
    { label: "Visites", count: stats.visite, icon: MapPin, color: "text-green-600" },
    { label: "RDV", count: stats.rdv, icon: Calendar, color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statItems.map(({ label, count, icon: Icon, color }) => (
        <Card key={label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
