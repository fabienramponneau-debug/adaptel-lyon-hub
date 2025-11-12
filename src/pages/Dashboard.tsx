import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardStats } from "@/components/DashboardStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Phone, Mail, MapPin, Bell } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Stats {
  prospects: number;
  clients: number;
  anciensClients: number;
}

interface Action {
  id: string;
  type: string;
  date_action: string;
  etablissement: {
    nom: string;
  };
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    prospects: 0,
    clients: 0,
    anciensClients: 0,
  });
  const [upcomingActions, setUpcomingActions] = useState<Action[]>([]);

  useEffect(() => {
    fetchStats();
    fetchUpcomingActions();
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("statut");

    if (data) {
      const prospects = data.filter((e) => e.statut === "prospect").length;
      const clients = data.filter((e) => e.statut === "client").length;
      const anciensClients = data.filter((e) => e.statut === "ancien_client").length;

      setStats({ prospects, clients, anciensClients });
    }
  };

  const fetchUpcomingActions = async () => {
    const today = new Date().toISOString().split("T")[0];
    
    const { data } = await supabase
      .from("actions")
      .select("id, type, date_action, etablissement:establishments(nom)")
      .gte("date_action", today)
      .eq("statut_action", "a_venir")
      .order("date_action", { ascending: true })
      .limit(5);

    if (data) {
      setUpcomingActions(data as any);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "phoning":
        return <Phone className="h-4 w-4 text-primary" />;
      case "mailing":
        return <Mail className="h-4 w-4 text-primary" />;
      case "visite":
        return <MapPin className="h-4 w-4 text-primary" />;
      case "rdv":
        return <Calendar className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      phoning: "Appel téléphonique",
      mailing: "Envoi d'email",
      visite: "Visite terrain",
      rdv: "Rendez-vous",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre activité commerciale</p>
      </div>

      <DashboardStats
        prospects={stats.prospects}
        clients={stats.clients}
        anciensClients={stats.anciensClients}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Actions à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune action planifiée</p>
            ) : (
              <div className="space-y-3">
                {upcomingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {getActionIcon(action.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{action.etablissement.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {getActionLabel(action.type)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(action.date_action), "dd MMM", { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Rappels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Aucun rappel pour le moment</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
