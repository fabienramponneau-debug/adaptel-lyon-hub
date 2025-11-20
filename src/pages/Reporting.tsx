// src/pages/Reporting.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  AlertCircle,
  Target,
  TrendingUp,
  Calendar,
  BarChart3,
  Activity,
  MapPin,
  Building,
  Utensils,
  Coffee,
  ChartBar,
  PieChart,
  Filter,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Legend,
} from "recharts";
import { format, subWeeks, startOfWeek, endOfWeek, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface Stats {
  totalProspects: number;
  clientsDeclenches: number;
  clientsAVoir: number;
  anciensClients: number;
  totalEstablishments: number;
}

type ActionType = "phoning" | "mailing" | "visite" | "rdv";
type EstablishmentFilter = "tout" | "prospect" | "client" | "ancien_client";
type TimeRange = "4weeks" | "3months";

interface WeeklyData {
  name: string;
  semaine: string;
  phoning: number;
  mailing: number;
  visite: number;
  rdv: number;
  objectif: number;
}

interface ActivityData {
  name: string;
  value: number;
  color: string;
  pourcentage: number;
}

interface CityData {
  name: string;
  count: number;
  pourcentage: number;
}

interface PerformanceMetric {
  label: string;
  value: number;
  evolution: number;
  icon: any;
  color: string;
}

const COLORS = {
  primary: '#840404',
  secondary: '#1e293b',
  accent: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  info: '#2563eb',
  
  // Couleurs pour les activités
  hotellerie: '#840404',
  restauration: '#dc2626',
  restauration_collective: '#f59e0b',
  
  // Couleurs pour les actions
  phoning: '#3b82f6',
  mailing: '#8b5cf6',
  visite: '#840404',
  rdv: '#16a34a',
};

const ACTIVITY_COLORS = ['#840404', '#dc2626', '#f59e0b', '#2563eb', '#16a34a', '#8b5cf6'];

const Reporting = () => {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    clientsDeclenches: 0,
    clientsAVoir: 0,
    anciensClients: 0,
    totalEstablishments: 0,
  });

  const [selectedAction, setSelectedAction] = useState<ActionType>("visite");
  const [timeRange, setTimeRange] = useState<TimeRange>("4weeks");
  const [activityFilter, setActivityFilter] = useState<EstablishmentFilter>("tout");
  const [cityFilter, setCityFilter] = useState<EstablishmentFilter>("tout");
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [cityData, setCityData] = useState<CityData[]>([]);
  const [allActionsData, setAllActionsData] = useState<WeeklyData[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState({
    main: true,
    activity: false,
    city: false
  });

  useEffect(() => {
    fetchInitialData();
  }, [timeRange]);

  useEffect(() => {
    if (!isLoading.main) {
      fetchActivityData();
    }
  }, [activityFilter]);

  useEffect(() => {
    if (!isLoading.main) {
      fetchCityData();
    }
  }, [cityFilter]);

  const fetchInitialData = async () => {
    setIsLoading(prev => ({ ...prev, main: true }));
    await Promise.all([
      fetchStats(),
      fetchWeeklyData(),
      fetchAllActionsData(),
      fetchActivityData(),
      fetchCityData(),
      fetchPerformanceMetrics(),
    ]);
    setIsLoading(prev => ({ ...prev, main: false }));
  };

  const fetchStats = async () => {
    // Récupérer tous les établissements
    const { data: establishments } = await supabase
      .from("establishments")
      .select("id, statut, created_at");

    if (!establishments) return;

    const prospects = establishments.filter((e) => e.statut === "prospect");
    const clients = establishments.filter((e) => e.statut === "client");
    const anciens = establishments.filter((e) => e.statut === "ancien_client");

    // Clients déclenchés (prospects convertis en clients ce mois-ci)
    const currentMonthStart = startOfMonth(new Date());
    const clientsDeclenches = clients.filter(client => 
      new Date(client.created_at) >= currentMonthStart
    ).length;

    // Clients à voir (clients sans action depuis 3 mois)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: recentClientActions } = await supabase
      .from("actions")
      .select("etablissement_id, date_action")
      .in("etablissement_id", clients.map(c => c.id))
      .gte("date_action", threeMonthsAgo.toISOString().split("T")[0]);

    const clientsWithRecentActions = new Set(
      recentClientActions?.map(a => a.etablissement_id) || []
    );

    const clientsAVoir = clients.filter(client => 
      !clientsWithRecentActions.has(client.id)
    ).length;

    setStats({
      totalProspects: prospects.length,
      clientsDeclenches: clientsDeclenches,
      clientsAVoir: clientsAVoir,
      anciensClients: anciens.length,
      totalEstablishments: establishments.length,
    });
  };

  const fetchWeeklyData = async () => {
    const weeks: WeeklyData[] = [];
    const weekCount = timeRange === "4weeks" ? 4 : 12;

    for (let i = weekCount - 1; i >= 0; i--) {
      const baseDate = subWeeks(new Date(), i);
      const weekStart = startOfWeek(baseDate, { locale: fr });
      const weekEnd = endOfWeek(baseDate, { locale: fr });

      const { data } = await supabase
        .from("actions")
        .select("type")
        .gte("date_action", format(weekStart, "yyyy-MM-dd"))
        .lte("date_action", format(weekEnd, "yyyy-MM-dd"));

      const visiteCount = data?.filter((a) => a.type === "visite").length || 0;
      const phoningCount = data?.filter((a) => a.type === "phoning").length || 0;
      const mailingCount = data?.filter((a) => a.type === "mailing").length || 0;
      const rdvCount = data?.filter((a) => a.type === "rdv").length || 0;

      const objectifs = {
        phoning: 20,
        mailing: 15,
        visite: 4,
        rdv: 8,
      };

      weeks.push({
        name: `S${format(weekStart, "w", { locale: fr })}`,
        semaine: format(weekStart, "dd MMM", { locale: fr }),
        visite: visiteCount,
        phoning: phoningCount,
        mailing: mailingCount,
        rdv: rdvCount,
        objectif: objectifs[selectedAction],
      });
    }

    setWeeklyData(weeks);
  };

  const fetchActivityData = async () => {
    setIsLoading(prev => ({ ...prev, activity: true }));
    
    const { data: activites } = await supabase
      .from("parametrages")
      .select("id, valeur")
      .eq("categorie", "activite");

    if (!activites) return;

    let query = supabase.from("establishments").select("activite_id, statut");
    
    if (activityFilter !== "tout") {
      query = query.eq("statut", activityFilter);
    }

    const { data: establishments } = await query;

    const activityCounts: { [key: string]: number } = {};
    
    establishments?.forEach(est => {
      if (est.activite_id) {
        const activityName = activites.find(a => a.id === est.activite_id)?.valeur || 'Non renseigné';
        activityCounts[activityName] = (activityCounts[activityName] || 0) + 1;
      }
    });

    const total = establishments?.length || 1;
    const activityData: ActivityData[] = activites.map((activite, index) => ({
      name: activite.valeur,
      value: activityCounts[activite.valeur] || 0,
      color: ACTIVITY_COLORS[index % ACTIVITY_COLORS.length],
      pourcentage: Math.round(((activityCounts[activite.valeur] || 0) / total) * 100)
    })).filter(item => item.value > 0);

    setActivityData(activityData);
    setIsLoading(prev => ({ ...prev, activity: false }));
  };

  const fetchCityData = async () => {
    setIsLoading(prev => ({ ...prev, city: true }));
    
    let query = supabase.from("establishments").select("ville, statut");
    
    if (cityFilter !== "tout") {
      query = query.eq("statut", cityFilter);
    }

    const { data: establishments } = await query;

    const cityCounts: { [key: string]: number } = {};
    
    establishments?.forEach(est => {
      if (est.ville) {
        cityCounts[est.ville] = (cityCounts[est.ville] || 0) + 1;
      }
    });

    const total = establishments?.length || 1;
    const cityData: CityData[] = Object.entries(cityCounts)
      .map(([name, count]) => ({
        name,
        count,
        pourcentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    setCityData(cityData);
    setIsLoading(prev => ({ ...prev, city: false }));
  };

  const fetchAllActionsData = async () => {
    const weeks: WeeklyData[] = [];
    const weekCount = timeRange === "4weeks" ? 4 : 12;

    for (let i = weekCount - 1; i >= 0; i--) {
      const baseDate = subWeeks(new Date(), i);
      const weekStart = startOfWeek(baseDate, { locale: fr });
      const weekEnd = endOfWeek(baseDate, { locale: fr });

      const { data } = await supabase
        .from("actions")
        .select("type")
        .gte("date_action", format(weekStart, "yyyy-MM-dd"))
        .lte("date_action", format(weekEnd, "yyyy-MM-dd"));

      const visiteCount = data?.filter((a) => a.type === "visite").length || 0;
      const phoningCount = data?.filter((a) => a.type === "phoning").length || 0;
      const mailingCount = data?.filter((a) => a.type === "mailing").length || 0;
      const rdvCount = data?.filter((a) => a.type === "rdv").length || 0;

      weeks.push({
        name: `S${format(weekStart, "w", { locale: fr })}`,
        semaine: format(weekStart, "dd MMM", { locale: fr }),
        visite: visiteCount,
        phoning: phoningCount,
        mailing: mailingCount,
        rdv: rdvCount,
        objectif: 0,
      });
    }

    setAllActionsData(weeks);
  };

  const fetchPerformanceMetrics = async () => {
    // Calculer l'évolution mois précédent vs mois actuel pour chaque type d'action
    const currentMonthStart = startOfMonth(new Date());
    const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
    const currentMonthEnd = endOfMonth(new Date());
    const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));

    // Actions du mois actuel
    const { data: currentMonthActions } = await supabase
      .from("actions")
      .select("type")
      .gte("date_action", format(currentMonthStart, "yyyy-MM-dd"))
      .lte("date_action", format(currentMonthEnd, "yyyy-MM-dd"));

    // Actions du mois précédent
    const { data: previousMonthActions } = await supabase
      .from("actions")
      .select("type")
      .gte("date_action", format(previousMonthStart, "yyyy-MM-dd"))
      .lte("date_action", format(previousMonthEnd, "yyyy-MM-dd"));

    const calculateEvolution = (type: ActionType) => {
      const currentCount = currentMonthActions?.filter(a => a.type === type).length || 0;
      const previousCount = previousMonthActions?.filter(a => a.type === type).length || 0;
      
      if (previousCount === 0) return currentCount > 0 ? 100 : 0;
      return Math.round(((currentCount - previousCount) / previousCount) * 100);
    };

    const metrics: PerformanceMetric[] = [
      {
        label: "Visites terrain",
        value: currentMonthActions?.filter(a => a.type === 'visite').length || 0,
        evolution: calculateEvolution('visite'),
        icon: MapPin,
        color: COLORS.primary
      },
      {
        label: "Rendez-vous",
        value: currentMonthActions?.filter(a => a.type === 'rdv').length || 0,
        evolution: calculateEvolution('rdv'),
        icon: Clock,
        color: COLORS.success
      },
      {
        label: "Appels effectués",
        value: currentMonthActions?.filter(a => a.type === 'phoning').length || 0,
        evolution: calculateEvolution('phoning'),
        icon: Phone,
        color: COLORS.info
      },
      {
        label: "Emails envoyés",
        value: currentMonthActions?.filter(a => a.type === 'mailing').length || 0,
        evolution: calculateEvolution('mailing'),
        icon: Mail,
        color: COLORS.phoning
      }
    ];

    setPerformanceMetrics(metrics);
  };

  const getFilterLabel = (filter: EstablishmentFilter): string => {
    const labels = {
      tout: "Tout le portefeuille",
      prospect: "Prospects uniquement",
      client: "Clients uniquement",
      ancien_client: "Anciens clients uniquement"
    };
    return labels[filter];
  };

  const getActivityIcon = (activity: string) => {
    const icons: { [key: string]: any } = {
      'Hôtellerie': Building,
      'Restauration': Utensils,
      'Restauration collective': Coffee,
    };
    return icons[activity] || Building;
  };

  // Custom YAxis tick formatter pour entiers uniquement
  const integerTickFormatter = (value: number) => {
    return Math.round(value).toString();
  };

  // Custom tooltips
  const ActionTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-600">
            <span style={{ color: COLORS[selectedAction] }}>
              {Math.round(payload[0].value)} {selectedAction === 'visite' ? 'visites' : selectedAction === 'rdv' ? 'rendez-vous' : selectedAction + 's'}
            </span>
          </p>
          <p className="text-sm text-amber-600">
            Objectif: {Math.round(payload[1]?.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const AllActionsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm min-w-[200px]">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'phoning' && 'Phoning'}
              {entry.name === 'mailing' && 'Mailing'}
              {entry.name === 'visite' && 'Visites'}
              {entry.name === 'rdv' && 'Rendez-vous'}: {Math.round(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const ActivityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-600">
            {Math.round(payload[0].value)} établissements
          </p>
          <p className="text-sm text-slate-500">
            {payload[0].payload.pourcentage}% du portefeuille
          </p>
        </div>
      );
    }
    return null;
  };

  const CityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-600">
            {Math.round(payload[0].value)} établissements
          </p>
          <p className="text-sm text-slate-500">
            {payload[0].payload.pourcentage}% du portefeuille
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading.main) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin text-[#840404] mx-auto mb-4" />
          <p className="text-slate-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* En-tête */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#840404]/10 rounded-lg">
              <ChartBar className="h-6 w-6 text-[#840404]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord Commercial</h1>
              <p className="text-slate-600">Analyse et pilotage de l'activité commerciale</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white">
              <Calendar className="h-3 w-3 mr-1" />
              {timeRange === "4weeks" ? "4 semaines" : "3 mois"}
            </Badge>
          </div>
        </div>
      </div>

      {/* SECTION 1: KPIs PRINCIPAUX */}
      <section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Portefeuille Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stats.totalEstablishments}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.totalProspects} prospects • {stats.totalEstablishments - stats.totalProspects - stats.anciensClients} clients
                  </p>
                </div>
                <div className="p-3 bg-[#840404]/10 rounded-lg">
                  <Users className="h-6 w-6 text-[#840404]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Clients Déclenchés</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stats.clientsDeclenches}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Ce mois-ci
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Clients à Voir</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stats.clientsAVoir}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Sans action depuis 3 mois
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Anciens Clients</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stats.anciensClients}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Potentiel de reconquête
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 2: ACTIVITÉ COMMERCIALE */}
      <section>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Graphique Principal - Suivi d'Action avec Objectif */}
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#840404]" />
                    Suivi des Actions vs Objectifs
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Progression des actions commerciales avec objectifs
                  </p>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value as ActionType)}
                    className="text-sm border border-slate-200 rounded-md px-3 py-1 bg-white"
                  >
                    <option value="visite">Visites Terrain</option>
                    <option value="rdv">Rendez-vous</option>
                    <option value="phoning">Phoning</option>
                    <option value="mailing">Mailing</option>
                  </select>
                  <select 
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                    className="text-sm border border-slate-200 rounded-md px-3 py-1 bg-white"
                  >
                    <option value="4weeks">4 semaines</option>
                    <option value="3months">3 mois</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      domain={[0, 'dataMax + 2']}
                      tickFormatter={integerTickFormatter}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ActionTooltip />} />
                    <Bar 
                      dataKey={selectedAction} 
                      fill={COLORS[selectedAction]}
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="objectif" 
                      stroke={COLORS.warning}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Toutes les Actions Commerciales */}
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#840404]" />
                Volume d'Activité Commerciale
              </CardTitle>
              <p className="text-sm text-slate-500">
                Comparaison du volume de toutes les actions
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allActionsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickFormatter={integerTickFormatter}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AllActionsTooltip />} />
                    <Bar dataKey="phoning" fill={COLORS.phoning} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="mailing" fill={COLORS.mailing} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="visite" fill={COLORS.visite} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="rdv" fill={COLORS.rdv} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 3: ANALYSE DU PORTEFEUILLE */}
      <section>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Répartition par Activité */}
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-[#840404]" />
                    Répartition par Secteur d'Activité
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {getFilterLabel(activityFilter)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <select 
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as EstablishmentFilter)}
                    className="text-sm border border-slate-200 rounded-md px-3 py-1 bg-white"
                  >
                    <option value="tout">Tout</option>
                    <option value="prospect">Prospects</option>
                    <option value="client">Clients</option>
                    <option value="ancien_client">Anciens clients</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={activityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, pourcentage }) => `${name} (${pourcentage}%)`}
                    >
                      {activityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ActivityTooltip />} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              {isLoading.activity && (
                <div className="text-center text-slate-500 text-sm">Chargement...</div>
              )}
            </CardContent>
          </Card>

          {/* Répartition Géographique */}
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#840404]" />
                    Répartition Géographique
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {getFilterLabel(cityFilter)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <select 
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value as EstablishmentFilter)}
                    className="text-sm border border-slate-200 rounded-md px-3 py-1 bg-white"
                  >
                    <option value="tout">Tout</option>
                    <option value="prospect">Prospects</option>
                    <option value="client">Clients</option>
                    <option value="ancien_client">Anciens clients</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis 
                      type="number" 
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickFormatter={integerTickFormatter}
                      allowDecimals={false}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip content={<CityTooltip />} />
                    <Bar 
                      dataKey="count" 
                      fill={COLORS.primary}
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {isLoading.city && (
                <div className="text-center text-slate-500 text-sm">Chargement...</div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 4: INDICATEURS DE PERFORMANCE */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Évolution Mensuelle des Actions</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {performanceMetrics.map((metric, index) => {
            const Icon = metric.icon;
            const isPositive = metric.evolution >= 0;
            
            return (
              <Card key={index} className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div 
                        className="p-2 rounded-lg" 
                        style={{ backgroundColor: `${metric.color}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: metric.color }} />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{metric.label}</span>
                    </div>
                    <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      <span className="text-sm font-semibold">
                        {metric.evolution}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-slate-900">{metric.value}</span>
                      <span className="text-sm text-slate-500">ce mois</span>
                    </div>
                    
                    <div className="text-xs text-slate-500">
                      vs mois précédent
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Reporting;