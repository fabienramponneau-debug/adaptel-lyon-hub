// src/pages/Reporting.tsx - Finalisé (Header avec icône)
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  AlertCircle,
  Target,
  TrendingUp,
  Activity,
  MapPin,
  Clock,
  Phone,
  Mail,
  ArrowUp,
  ArrowDown,
  ChartBar, // Icône pour le titre
  PieChart,
  Filter,
  BarChart3,
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
import {
  format,
  subWeeks,
  startOfWeek,
  endOfWeek,
  subMonths,
  startOfMonth,
  endOfMonth,
  getWeek,
  isSameYear,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useUserView } from "@/contexts/UserViewContext";

interface Stats {
  totalProspects: number;
  clientsDeclenches: number; // Maintenant compté via client_triggered_by
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

type LoadingState = {
  main: boolean;
  activity: boolean;
  city: boolean;
};

const COLORS = {
  primary: "#840404",
  secondary: "#1e293b",
  accent: "#dc2626",
  success: "#16a34a",
  warning: "#d97706",
  info: "#2563eb",
  phoning: "#3b82f6",
  mailing: "#8b5cf6",
  visite: "#840404",
  rdv: "#16a34a",
};

const ACTIVITY_COLORS = [
  "#840404",
  "#dc2626",
  "#f59e0b",
  "#2563eb",
  "#16a34a",
  "#8b5cf6",
];

const CURRENT_MONTH_CODE = format(new Date(), "yyyy-MM");
const sbAny = supabase as any;

const Reporting = () => {
  const { selectedUserId, loadingUserView } = useUserView() as any;
  const isGlobalView = selectedUserId === "tous";

  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    clientsDeclenches: 0,
    clientsAVoir: 0,
    anciensClients: 0,
    totalEstablishments: 0,
  });

  const [objectifsMensuels, setObjectifsMensuels] = useState<
    Record<ActionType, number>
  >({
    visite: 0,
    rdv: 0,
    phoning: 0,
    mailing: 0,
  });

  const [selectedAction, setSelectedAction] = useState<ActionType>("visite");
  const [timeRange, setTimeRange] = useState<TimeRange>("4weeks");
  const [activityFilter, setActivityFilter] =
    useState<EstablishmentFilter>("tout");
  const [cityFilter, setCityFilter] = useState<EstablishmentFilter>("tout");
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [cityData, setCityData] = useState<CityData[]>([]);
  const [allActionsData, setAllActionsData] = useState<WeeklyData[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<
    PerformanceMetric[]
  >([]);

  const [isLoading, setIsLoading] = useState<LoadingState>({
    main: true,
    activity: false,
    city: false,
  });

  // --- Fonctions de Fetch et Helpers ---
  const applyUserFilter = (query: any, isEstablishmentTable: boolean) => {
    if (isGlobalView) {
      return query;
    }
    const column = isEstablishmentTable ? "commercial_id" : "user_id";
    return query.eq(column, selectedUserId);
  };

  const fetchObjectifs = async (userId: string | null) => {
    if (isGlobalView || !userId || userId === "tous") {
      setObjectifsMensuels({
        visite: 0,
        rdv: 0,
        phoning: 0,
        mailing: 0,
      });
      return;
    }

    const { data } = await sbAny
      .from("objectifs_actions")
      .select("action_type, objectif")
      .eq("user_id", userId)
      .eq("period_type", "mois")
      .eq("period_code", CURRENT_MONTH_CODE);

    const base: Record<ActionType, number> = {
      visite: 0,
      rdv: 0,
      phoning: 0,
      mailing: 0,
    };

    (data || []).forEach((row: any) => {
      const type = row.action_type as ActionType;
      if (type in base) {
        base[type] = row.objectif ?? 0;
      }
    });

    setObjectifsMensuels(base);
  };

  const getWeeklyObjective = (actionType: ActionType) => {
    const monthly = objectifsMensuels[actionType] || 0;
    return monthly / 4;
  };

  const fetchStats = async () => {
    let query: any = (supabase as any)
      .from("establishments")
      .select("id, statut");
    // Filtre sur le créateur par défaut (commercial_id)
    query = applyUserFilter(query, true);
    const { data: establishments } = await query;
    if (!establishments) return;

    const prospects = establishments.filter((e: any) => e.statut === "prospect");
    const clients = establishments.filter((e: any) => e.statut === "client");
    const anciens = establishments.filter(
      (e: any) => e.statut === "ancien_client"
    );

    // Clients déclenchés (client_triggered_by non null)
    let triggeredClientsQuery: any = (supabase as any)
      .from("establishments")
      .select("id", { count: "exact", head: true })
      .not("client_triggered_by", "is", null);

    if (!isGlobalView) {
      triggeredClientsQuery = triggeredClientsQuery.eq(
        "client_triggered_by",
        selectedUserId
      );
    }
    const { count: triggeredCount } = await triggeredClientsQuery;

    // Clients à voir (pas d'action depuis 3 mois)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    let actionQuery: any = (supabase as any)
      .from("actions")
      .select("etablissement_id, date_action")
      .in(
        "etablissement_id",
        clients.map((c: any) => c.id)
      )
      .gte("date_action", format(threeMonthsAgo, "yyyy-MM-dd"));

    if (!isGlobalView && selectedUserId) {
      actionQuery = actionQuery.eq("user_id", selectedUserId);
    }

    const { data: recentClientActions } = await actionQuery;

    const clientsWithRecentActions = new Set(
      (recentClientActions || []).map((a: any) => a.etablissement_id)
    );

    const clientsAVoir = clients.filter(
      (client: any) => !clientsWithRecentActions.has(client.id)
    ).length;

    setStats({
      totalProspects: prospects.length,
      clientsDeclenches: triggeredCount || 0,
      clientsAVoir,
      anciensClients: anciens.length,
      totalEstablishments: establishments.length,
    });
  };

  const fetchWeeklyData = async () => {
    const weeks: WeeklyData[] = [];
    const weekCount = timeRange === "4weeks" ? 4 : 12;

    for (let i = weekCount - 1; i >= 0; i--) {
      const baseDate = subWeeks(new Date(), i);
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 1, locale: fr });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1, locale: fr });

      let query: any = (supabase as any)
        .from("actions")
        .select("type")
        .gte("date_action", format(weekStart, "yyyy-MM-dd"))
        .lte("date_action", format(weekEnd, "yyyy-MM-dd"));

      query = applyUserFilter(query, false);

      const { data } = await query;

      const visiteCount =
        data?.filter((a: any) => a.type === "visite").length || 0;
      const phoningCount =
        data?.filter((a: any) => a.type === "phoning").length || 0;
      const mailingCount =
        data?.filter((a: any) => a.type === "mailing").length || 0;
      const rdvCount =
        data?.filter((a: any) => a.type === "rdv").length || 0;

      weeks.push({
        name: `S${getWeek(weekStart, { weekStartsOn: 1 })}`,
        semaine: isSameYear(weekStart, new Date())
          ? format(weekStart, "dd MMM", { locale: fr })
          : format(weekStart, "dd MMM yyyy", { locale: fr }),
        visite: visiteCount,
        phoning: phoningCount,
        mailing: mailingCount,
        rdv: rdvCount,
        objectif: getWeeklyObjective(selectedAction),
      });
    }

    setWeeklyData(weeks);
  };

  const fetchDataForEstablishments = async (
    filter: EstablishmentFilter,
    isActivity: boolean
  ) => {
    const key: keyof LoadingState = isActivity ? "activity" : "city";
    setIsLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const supabaseAny = supabase as any;

      let query: any = supabaseAny
        .from("establishments")
        .select(
          isActivity
            ? "activite_id, statut, commercial_id"
            : "ville, statut, commercial_id"
        );

      query = applyUserFilter(query, true);

      if (filter !== "tout") {
        query = query.eq("statut", filter);
      }

      const { data: establishments } = await query;

      if (!establishments) {
        if (isActivity) setActivityData([]);
        else setCityData([]);
        return;
      }

      const finalEstablishments = establishments as any[];

      if (isActivity) {
        const { data: activites } = await supabaseAny
          .from("parametrages")
          .select("id, valeur")
          .eq("categorie", "activite");

        if (!activites) {
          setActivityData([]);
          return;
        }

        const activityCounts: { [key: string]: number } = {};
        finalEstablishments.forEach((est: any) => {
          if (est.activite_id) {
            const activityName =
              activites.find((a: any) => a.id === est.activite_id)?.valeur ||
              "Non renseigné";
            activityCounts[activityName] =
              (activityCounts[activityName] || 0) + 1;
          }
        });

        const total = finalEstablishments.length || 1;
        const resultData: ActivityData[] = activites
          .map((activite: any, index: number) => ({
            name: activite.valeur,
            value: activityCounts[activite.valeur] || 0,
            color: ACTIVITY_COLORS[index % ACTIVITY_COLORS.length],
            pourcentage: Math.round(
              ((activityCounts[activite.valeur] || 0) / total) * 100
            ),
          }))
          .filter((item) => item.value > 0);

        setActivityData(resultData);
      } else {
        const cityCounts: { [key: string]: number } = {};
        finalEstablishments.forEach((est: any) => {
          if (est.ville) {
            cityCounts[est.ville] = (cityCounts[est.ville] || 0) + 1;
          }
        });

        const total = finalEstablishments.length || 1;
        const resultData: CityData[] = Object.entries(cityCounts)
          .map(([name, count]) => ({
            name,
            count: count as number,
            pourcentage: Math.round(((count as number) / total) * 100),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        setCityData(resultData);
      }
    } catch (error) {
      console.error(
        `Erreur de chargement des données ${isActivity ? "activity" : "city"}:`,
        error
      );
      if (isActivity) setActivityData([]);
      else setCityData([]);
    } finally {
      setIsLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const fetchActivityData = () =>
    fetchDataForEstablishments(activityFilter, true);
  const fetchCityData = () => fetchDataForEstablishments(cityFilter, false);

  const fetchAllActionsData = async () => {
    const weeks: WeeklyData[] = [];
    const weekCount = timeRange === "4weeks" ? 4 : 12;

    for (let i = weekCount - 1; i >= 0; i--) {
      const baseDate = subWeeks(new Date(), i);
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 1, locale: fr });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1, locale: fr });

      let query: any = (supabase as any)
        .from("actions")
        .select("type")
        .gte("date_action", format(weekStart, "yyyy-MM-dd"))
        .lte("date_action", format(weekEnd, "yyyy-MM-dd"));

      query = applyUserFilter(query, false);

      const { data } = await query;

      const visiteCount =
        data?.filter((a: any) => a.type === "visite").length || 0;
      const phoningCount =
        data?.filter((a: any) => a.type === "phoning").length || 0;
      const mailingCount =
        data?.filter((a: any) => a.type === "mailing").length || 0;
      const rdvCount =
        data?.filter((a: any) => a.type === "rdv").length || 0;

      weeks.push({
        name: `S${getWeek(weekStart, { weekStartsOn: 1 })}`,
        semaine: isSameYear(weekStart, new Date())
          ? format(weekStart, "dd MMM", { locale: fr })
          : format(weekStart, "dd MMM yyyy", { locale: fr }),
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
    const currentMonthStart = startOfMonth(new Date());
    const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
    const currentMonthEnd = endOfMonth(new Date());

    let currentQuery: any = (supabase as any)
      .from("actions")
      .select("type")
      .gte("date_action", format(currentMonthStart, "yyyy-MM-dd"))
      .lte("date_action", format(currentMonthEnd, "yyyy-MM-dd"));

    currentQuery = applyUserFilter(currentQuery, false);
    const { data: currentMonthActions } = await currentQuery;

    const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));
    let previousQuery: any = (supabase as any)
      .from("actions")
      .select("type")
      .gte("date_action", format(previousMonthStart, "yyyy-MM-dd"))
      .lte("date_action", format(previousMonthEnd, "yyyy-MM-dd"));

    previousQuery = applyUserFilter(previousQuery, false);
    const { data: previousMonthActions } = await previousQuery;

    const calculateEvolution = (type: ActionType) => {
      const currentCount =
        currentMonthActions?.filter((a: any) => a.type === type).length || 0;
      const previousCount =
        previousMonthActions?.filter((a: any) => a.type === type).length || 0;

      if (previousCount === 0) return currentCount > 0 ? 100 : 0;
      return Math.round(
        ((currentCount - previousCount) / previousCount) * 100
      );
    };

    const metrics: PerformanceMetric[] = [
      {
        label: "Visites terrain",
        value:
          currentMonthActions?.filter((a: any) => a.type === "visite").length ||
          0,
        evolution: calculateEvolution("visite"),
        icon: MapPin,
        color: COLORS.primary,
      },
      {
        label: "Rendez-vous",
        value:
          currentMonthActions?.filter((a: any) => a.type === "rdv").length || 0,
        evolution: calculateEvolution("rdv"),
        icon: Clock,
        color: COLORS.success,
      },
      {
        label: "Appels effectués",
        value:
          currentMonthActions?.filter((a: any) => a.type === "phoning")
            .length || 0,
        evolution: calculateEvolution("phoning"),
        icon: Phone,
        color: COLORS.info,
      },
      {
        label: "Emails envoyés",
        value:
          currentMonthActions?.filter((a: any) => a.type === "mailing")
            .length || 0,
        evolution: calculateEvolution("mailing"),
        icon: Mail,
        color: COLORS.phoning,
      },
    ];

    setPerformanceMetrics(metrics);
  };

  const fetchInitialData = async () => {
    setIsLoading((prev) => ({ ...prev, main: true }));
    await Promise.all([
      fetchStats(),
      fetchActivityData(),
      fetchCityData(),
      fetchPerformanceMetrics(),
    ]);
    setIsLoading((prev) => ({ ...prev, main: false }));
  };

  // --- useEffects de Rechargement ---

  useEffect(() => {
    if (!loadingUserView && selectedUserId) {
      fetchObjectifs(selectedUserId === "tous" ? null : selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, loadingUserView]);

  useEffect(() => {
    if (!loadingUserView && selectedUserId) {
      fetchInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, selectedUserId, loadingUserView]);

  useEffect(() => {
    if (!loadingUserView && selectedUserId) {
      fetchWeeklyData();
      fetchAllActionsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    timeRange,
    selectedUserId,
    selectedAction,
    loadingUserView,
    objectifsMensuels,
  ]);

  useEffect(() => {
    if (!isLoading.main && selectedUserId) {
      fetchActivityData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFilter, selectedUserId, isLoading.main]);

  useEffect(() => {
    if (!isLoading.main && selectedUserId) {
      fetchCityData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter, selectedUserId, isLoading.main]);

  // --- Helpers UI ---
  const getFilterLabel = (filter: EstablishmentFilter): string => {
    const labels = {
      tout: "Tout le portefeuille",
      prospect: "Prospects uniquement",
      client: "Clients uniquement",
      ancien_client: "Anciens clients uniquement",
    };
    return labels[filter];
  };

  const integerTickFormatter = (value: number) => {
    return Math.round(value).toString();
  };

  const ActionTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const actionPayload = payload.find(
        (p: any) => p.dataKey === selectedAction
      );
      const objectifPayload = payload.find(
        (p: any) => p.dataKey === "objectif"
      );

      if (!actionPayload) return null;

      const actionValue = Math.round(actionPayload.value);
      const objectifValue = Math.round(objectifPayload?.value || 0);

      const actionLabelText =
        selectedAction === "visite"
          ? "visites"
          : selectedAction === "rdv"
          ? "rendez-vous"
          : selectedAction + "s";

      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-600">
            <span style={{ color: COLORS[selectedAction] }}>
              {actionValue} {actionLabelText}
            </span>
          </p>
          {objectifValue > 0 && !isGlobalView && (
            <p className="text-sm text-amber-600">Objectif: {objectifValue}</p>
          )}
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
          {payload.map((entry: any, index: number) => {
            if (entry.dataKey === "objectif") return null;
            return (
              <p
                key={index}
                className="text-sm"
                style={{ color: entry.color }}
              >
                {entry.dataKey === "phoning" && "Phoning"}
                {entry.dataKey === "mailing" && "Mailing"}
                {entry.dataKey === "visite" && "Visites"}
                {entry.dataKey === "rdv" && "Rendez-vous"}:{" "}
                {Math.round(entry.value)}
              </p>
            );
          })}
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

  if (loadingUserView || !selectedUserId || isLoading.main) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin text-[#840404] mx-auto mb-4" />
          <p className="text-slate-600">
            {loadingUserView || !selectedUserId
              ? "Chargement de la vue utilisateur..."
              : "Chargement des données du tableau de bord..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* EN-TÊTE */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#840404]/10 rounded-lg">
            <ChartBar className="h-6 w-6 text-[#840404]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Tableau de Bord Commercial
            </h1>
            <p className="text-slate-600">
              Analyse et pilotage de l&apos;activité commerciale
            </p>
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
                  <p className="text-sm font-medium text-slate-600">
                    Portefeuille Total
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stats.totalEstablishments}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.totalProspects} prospects •{" "}
                    {stats.totalEstablishments -
                      stats.totalProspects -
                      stats.anciensClients}{" "}
                    clients
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
                  <p className="text-sm font-medium text-slate-600">
                    Clients Déclenchés
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stats.clientsDeclenches}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Attribués à la vue courante
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
                  <p className="text-sm font-medium text-slate-600">
                    Clients à Voir
                  </p>
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
                  <p className="text-sm font-medium text-slate-600">
                    Anciens Clients
                  </p>
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
                    onChange={(e) =>
                      setSelectedAction(e.target.value as ActionType)
                    }
                    className="text-sm border border-slate-200 rounded-md px-3 py-1 bg-white"
                  >
                    <option value="visite">Visites Terrain</option>
                    <option value="rdv">Rendez-vous</option>
                    <option value="phoning">Phoning</option>
                    <option value="mailing">Mailing</option>
                  </select>
                  <select
                    value={timeRange}
                    onChange={(e) =>
                      setTimeRange(e.target.value as TimeRange)
                    }
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
                      dataKey="semaine"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      domain={[0, "dataMax + 2"]}
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
                    {getWeeklyObjective(selectedAction) > 0 && !isGlobalView && (
                      <Line
                        type="monotone"
                        dataKey="objectif"
                        stroke={COLORS.warning}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    )}
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
                Volume d&apos;Activité Commerciale
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
                      dataKey="semaine"
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
                    <Legend iconType="square" verticalAlign="top" height={36} />
                    <Bar
                      dataKey="phoning"
                      name="Phoning"
                      fill={COLORS.phoning}
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="mailing"
                      name="Mailing"
                      fill={COLORS.mailing}
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="visite"
                      name="Visites"
                      fill={COLORS.visite}
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="rdv"
                      name="Rendez-vous"
                      fill={COLORS.rdv}
                      radius={[2, 2, 0, 0]}
                    />
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
                    Répartition par Secteur d&apos;Activité
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {getFilterLabel(activityFilter)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <select
                    value={activityFilter}
                    onChange={(e) =>
                      setActivityFilter(e.target.value as EstablishmentFilter)
                    }
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
                      labelLine={false}
                      label={({ name, pourcentage }) =>
                        pourcentage > 5 ? `${name} (${pourcentage}%)` : ""
                      }
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
                <div className="text-center text-slate-500 text-sm">
                  Chargement...
                </div>
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
                    onChange={(e) =>
                      setCityFilter(e.target.value as EstablishmentFilter)
                    }
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
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickFormatter={integerTickFormatter}
                      allowDecimals={false}
                    />
                    {/* Ville : largeur YAxis augmentée + police réduite */}
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      width={150}
                      tickLine={false}
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
                <div className="text-center text-slate-500 text-sm">
                  Chargement...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 4: INDICATEURS DE PERFORMANCE */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-6">
          Évolution Mensuelle des Actions
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {performanceMetrics.map((metric, index) => {
            const Icon = metric.icon;
            const isPositive = metric.evolution >= 0;

            return (
              <Card key={index} className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify_between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${metric.color}20` }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: metric.color }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {metric.label}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1 ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      <span className="text-sm font-semibold">
                        {metric.evolution}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-slate-900">
                        {metric.value}
                      </span>
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
