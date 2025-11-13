import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, MapPin } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

interface Stats {
  totalProspects: number;
  inactiveProspects: number;
  convertedToClients: number;
}

const Reporting = () => {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    inactiveProspects: 0,
    convertedToClients: 0,
  });
  const [weeklyActions, setWeeklyActions] = useState<any[]>([]);
  const [actionsByType, setActionsByType] = useState<any[]>([]);
  const [establishmentsBySector, setEstablishmentsBySector] = useState<any[]>([]);
  const [establishmentsByActivity, setEstablishmentsByActivity] = useState<any[]>([]);
  const [establishmentsByCity, setEstablishmentsByCity] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchWeeklyActions();
    fetchActionsByType();
    fetchEstablishmentsBySector();
    fetchEstablishmentsByActivity();
    fetchEstablishmentsByCity();
  }, []);

  const fetchStats = async () => {
    const { data: establishments } = await supabase
      .from("establishments")
      .select("id, statut, created_at");

    if (establishments) {
      const prospects = establishments.filter(e => e.statut === "prospect");
      
      // Prospects inactifs (sans action depuis 90 jours)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { data: recentActions } = await supabase
        .from("actions")
        .select("etablissement_id")
        .gte("date_action", ninetyDaysAgo.toISOString().split("T")[0]);

      const activeEstablishmentIds = new Set(recentActions?.map(a => a.etablissement_id) || []);
      const inactive = prospects.filter(p => !activeEstablishmentIds.has(p.id));

      setStats({
        totalProspects: prospects.length,
        inactiveProspects: inactive.length,
        convertedToClients: establishments.filter(e => e.statut === "client").length,
      });
    }
  };

  const fetchWeeklyActions = async () => {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { locale: fr });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { locale: fr });

      const { data } = await supabase
        .from("actions")
        .select("type")
        .gte("date_action", format(weekStart, "yyyy-MM-dd"))
        .lte("date_action", format(weekEnd, "yyyy-MM-dd"));

      weeks.push({
        name: `S${format(weekStart, "w", { locale: fr })}`,
        visites: data?.filter(a => a.type === "visite").length || 0,
        phoning: data?.filter(a => a.type === "phoning").length || 0,
        mailing: data?.filter(a => a.type === "mailing").length || 0,
        rdv: data?.filter(a => a.type === "rdv").length || 0,
      });
    }
    setWeeklyActions(weeks);
  };

  const fetchActionsByType = async () => {
    const { data } = await supabase
      .from("actions")
      .select("type");

    if (data) {
      const counts = {
        phoning: data.filter(a => a.type === "phoning").length,
        mailing: data.filter(a => a.type === "mailing").length,
        visite: data.filter(a => a.type === "visite").length,
        rdv: data.filter(a => a.type === "rdv").length,
      };

      setActionsByType([
        { name: "Phoning", value: counts.phoning, color: "#3b82f6" },
        { name: "Mailing", value: counts.mailing, color: "#a855f7" },
        { name: "Visites", value: counts.visite, color: "#22c55e" },
        { name: "RDV", value: counts.rdv, color: "#f97316" },
      ]);
    }
  };

  const fetchEstablishmentsBySector = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("secteur:secteur_id(valeur)");

    if (data) {
      const counts: any = {};
      data.forEach((e: any) => {
        const sector = e.secteur?.valeur || "Non défini";
        counts[sector] = (counts[sector] || 0) + 1;
      });

      setEstablishmentsBySector(
        Object.entries(counts).map(([name, value]) => ({ name, value }))
      );
    }
  };

  const fetchEstablishmentsByActivity = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("activite:activite_id(valeur)");

    if (data) {
      const counts: any = {};
      data.forEach((e: any) => {
        const activity = e.activite?.valeur || "Non défini";
        counts[activity] = (counts[activity] || 0) + 1;
      });

      setEstablishmentsByActivity(
        Object.entries(counts)
          .map(([name, value]) => ({ name, value }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 6)
      );
    }
  };

  const fetchEstablishmentsByCity = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("ville");

    if (data) {
      const counts: any = {};
      data.forEach(e => {
        const city = e.ville || "Non défini";
        counts[city] = (counts[city] || 0) + 1;
      });

      setEstablishmentsByCity(
        Object.entries(counts)
          .map(([name, value]) => ({ name, value }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 6)
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reporting</h1>
        <p className="text-muted-foreground">Analysez votre activité commerciale</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects totaux</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalProspects}</div>
            <p className="text-xs text-muted-foreground">Dans le portefeuille</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects inactifs</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.inactiveProspects}</div>
            <p className="text-xs text-muted-foreground">+90 jours sans action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients actifs</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.convertedToClients}</div>
            <p className="text-xs text-muted-foreground">Prospects convertis</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Actions Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activité commerciale (4 dernières semaines)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyActions}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))", 
                  border: "1px solid hsl(var(--border))" 
                }} 
              />
              <Bar dataKey="visites" fill="#22c55e" name="Visites" />
              <Bar dataKey="phoning" fill="#3b82f6" name="Phoning" />
              <Bar dataKey="mailing" fill="#a855f7" name="Mailing" />
              <Bar dataKey="rdv" fill="#f97316" name="RDV" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Actions by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={actionsByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {actionsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Establishments by Sector */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par secteur</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={establishmentsBySector} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))" 
                  }} 
                />
                <Bar dataKey="value" fill="#840404" name="Établissements" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Establishments by Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Top activités</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={establishmentsByActivity}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))" 
                  }} 
                />
                <Bar dataKey="value" fill="#3b82f6" name="Établissements" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Establishments by City */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Top villes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={establishmentsByCity}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))" 
                  }} 
                />
                <Bar dataKey="value" fill="#22c55e" name="Établissements" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reporting;
