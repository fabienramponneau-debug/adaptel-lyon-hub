import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, UserMinus } from "lucide-react";

interface DashboardStatsProps {
  prospects: number;
  clients: number;
  anciensClients: number;
}

export const DashboardStats = ({ prospects, clients, anciensClients }: DashboardStatsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Prospects suivis</CardTitle>
          <Building2 className="h-4 w-4 text-prospect" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-prospect">{prospects}</div>
          <p className="text-xs text-muted-foreground">prospects actifs du portefeuille</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clients déclenchés</CardTitle>
          <Users className="h-4 w-4 text-client" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-client">{clients}</div>
          <p className="text-xs text-muted-foreground">clients réellement apportés</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Anciens clients</CardTitle>
          <UserMinus className="h-4 w-4 text-ancien-client" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-ancien-client">{anciensClients}</div>
          <p className="text-xs text-muted-foreground">potentiel de réactivation</p>
        </CardContent>
      </Card>
    </div>
  );
};
