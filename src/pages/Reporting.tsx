// src/pages/Reporting.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  AlertCircle,
  UserX,
  UserCheck,
  MapPin,
  Activity,
  CalendarRange,
} from "lucide-react";
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
} from "recharts";
import {
  format,
  subWeeks,
  startOfWeek,
  endOfWeek,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";

interface Stats {
  totalProspects: number;
  inactiveProspects: number;
  anciensClients: number;
  triggeredClients: number;
}

type ActionType = "phoning" | "mailing" | "visite" | "rdv";

interface WeeklyPoint {
  name: string; // S45, S46...
  phoning: number;
  mailing: number;
  visite: number;
  rdv: number;
}

interface MonthlyPoint {
  name: string; // Nov, Déc...
  phoning: number;
  mailing: number;
  visite: number;
  rdv: number;
}

const Reporting = () => {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    inactiveProspects: 0,
    anciensClients: 0,
    triggeredClients: 0,
  });

  const [selectedAction, setSelectedAction] = useState<ActionType>("visite");

  const [weeklyActions, setWeeklyActions] = useState<WeeklyPoint[]>([]);
  const [weeklyOffset, setWeeklyOffset] = useState(0); // 0 = 4 dernières semaines, 1 = 4 semaines précédentes, etc.

  const [monthlyActions, setMonthlyActions] = useState<MonthlyPoint[]>([]);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = 12 derniers mois, 1 = 12 mois précédents

  const [establishmentsBySector, setEstablishmentsBySector] = useState<any[]>([]);
  const [establishmentsByCity, setEstablishmentsByCity] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchWeeklyActions(weeklyOffset);
  }, [weeklyOffset]);

  useEffect(() => {
    fetchMonthlyActions(monthOffset);
  }, [monthOffset]);

  useEffect(() => {
    fetchEstablishmentsBySector();
    fetchEstablishmentsByCity();
  }, []);

  // ---------- STATS GLOBAL ----------

  const fetchStats = async () => {
    const { data: establishments } = await supabase
      .from("establishments")
      .select("id, statut, created_at");

    if (!establishments) return;

    const prospects = establishments.filter((e) => e.statut === "prospect");
    const anciens = establishments.filter((e) => e.statut === "ancien_client");

    // Prospects inactifs = sans action depuis 90 jours
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recentActions } = await supabase
      .from("actions")
      .select("etablissement_id")
      .gte("date_action", ninetyDaysAgo.toISOString().split("T")[0]);

    const activeEstablishmentIds = new Set(
      recentActions?.map((a) => a.etablissement_id) || []
    );

    const inactive = prospects.filter((p) => !activeEstablishmentIds.has(p.id));

    // Clients déclenchés : pour l'instant 0 => on mettra un vrai calcul quand on aura un tracking dédié
    const triggeredClients = 0;

    setStats({
      totalProspects: prospects.length,
      inactiveProspects: inactive.length,
      anciensClients: anciens.length,
      triggeredClients,
    });
  };

  // ---------- ACTIONS HEBDO (4 semaines) ----------

  const fetchWeeklyActions = async (offset: number) => {
    // 4 semaines par vue, avec un décalage par "offset"
    const weeks: WeeklyPoint[] = [];
    for (let i = 3 + offset * 4; i >= offset * 4; i--) {
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
        visite: visiteCount,
        phoning: phoningCount,
        mailing: mailingCount,
        rdv: rdvCount,
      });
    }

    setWeeklyActions(weeks);
  };

  // ---------- ACTIONS MENSUELLES (12 mois) ----------

  const fetchMonthlyActions = async (offset: number) => {
    // 12 mois glissants, décalés par offset
    const endRef = endOfMonth(subMonths(new Date(), offset * 12));
    const startRef = startOfMonth(subMonths(endRef, 11));

    const { data } = await supabase
      .from("actions")
      .select("type, date_action")
      .gte("date_action", format(startRef, "yyyy-MM-dd"))
      .lte("date_action", format(endRef, "yyyy-MM-dd"));

    if (!data) {
      setMonthlyActions([]);
      return;
    }

    const map = new Map<string, MonthlyPoint>();

    // init sur 12 mois
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(endRef, i);
      const key = format(d, "yyyy-MM");
      map.set(key, {
        name: format(d, "MMM yy", { locale: fr }),
        phoning: 0,
        mailing: 0,
        visite: 0,
        rdv: 0,
      });
    }

    data.forEach((a) => {
      const d = new Date(a.date_action);
      const key = format(d, "yyyy-MM");
      const existing = map.get(key);
      if (!existing) return;
      if (a.type === "phoning") existing.phoning += 1;
      if (a.type === "mailing") existing.mailing += 1;
      if (a.type === "visite") existing.visite += 1;
      if (a.type === "rdv") existing.rdv += 1;
    });

    setMonthlyActions(Array.from(map.values()));
  };

  // ---------- ETABLISSEMENTS PAR SECTEUR / VILLE ----------

  const fetchEstablishmentsBySector = async () => {
    const { data } = await supabase
      .from("establishments")
      .select("secteur:secteur_id(valeur)");

    if (!data) return;

    const counts: Record<string, number> = {};
    data.forEach((e: any) => {
      const sector = e.secteur?.valeur || "Non défini";
      counts[sector] = (counts[sector] || 0) + 1;
    });

    setEstablishmentsBySector(
      Object.entries(counts).map(([name, value]) => ({ name, value }))
    );
  };

  const fetchEstablishmentsByCity = async () => {
    const { data } = await supabase.from("establishments").select("ville");

    if (!data) return;

    const counts: Record<string, number> = {};
    data.forEach((e) => {
      const city = e.ville || "Non défini";
      counts[city] = (counts[city] || 0) + 1;
    });

    setEstablishmentsByCity(
      Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 6)
    );
  };

  // ---------- HELPERS UI ----------

  const actionLabelMap: Record<ActionType, string> = {
    phoning: "Phoning",
    mailing: "Mailing",
    visite: "Visites terrain",
    rdv: "Rendez-vous",
  };

  const getActionKey = (type: ActionType) => {
    if (type === "phoning") return "phoning";
    if (type === "mailing") return "mailing";
    if (type === "visite") return "visite";
    return "rdv";
  };

  const weeklyDataForSelected = weeklyActions.map((w) => ({
    name: w.name,
    value: w[getActionKey(selectedAction) as keyof WeeklyPoint] as number,
  }));

  const monthlyDataForSelected = monthlyActions.map((m) => ({
    name: m.name,
    value: m[selectedAction],
  }));

  const canGoNextWeek = weeklyOffset > 0;
  const canGoNextMonth = monthOffset > 0;

  return (
    <div className="space-y-6">
      {/* Titre page */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold text-slate-900 flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#840404]" />
          Reporting commercial
        </h1>
        <p className="text-sm text-slate-500">
          Pilotage de l&apos;activité : portefeuille, prospection et visites.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">
              Prospects totaux
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {stats.totalProspects}
            </div>
            <p className="text-xs text-slate-500">
              Établissements en statut prospect
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">
              Prospects inactifs
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {stats.inactiveProspects}
            </div>
            <p className="text-xs text-slate-500">
              Sans action depuis 90&nbsp;jours
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">
              Anciens clients
            </CardTitle>
            <UserX className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {stats.anciensClients}
            </div>
            <p className="text-xs text-slate-500">
              Portefeuille à réactiver ou à analyser
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">
              Clients déclenchés
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {stats.triggeredClients}
            </div>
            <p className="text-xs text-slate-500">
              À alimenter dès qu&apos;on aura le suivi &quot;déclenché&quot;
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sélecteur d'action global */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-[#840404]" />
              Vue par action
            </CardTitle>
            <p className="text-xs text-slate-500">
              Choisissez l&apos;action à analyser : phoning, mailing, visites ou
              rendez-vous.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
            {(["phoning", "mailing", "visite", "rdv"] as ActionType[]).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedAction(type)}
                  className={`px-3 h-7 text-xs rounded-full transition ${
                    selectedAction === type
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {actionLabelMap[type]}
                </button>
              )
            )}
          </div>
        </CardHeader>
      </Card>

      {/* SECTION SEMAINE */}
      <Card className="border-slate-200">
        <CardHeader className="flex items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Vue hebdomadaire – {actionLabelMap[selectedAction]}
            </CardTitle>
            <p className="text-xs text-slate-500">
              Volume par semaine (fenêtre de 4 semaines, navigation avant / après).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeeklyOffset(weeklyOffset + 1)}
              className="h-8 px-2 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            >
              &lt; Semaines précédentes
            </button>
            <button
              type="button"
              disabled={!canGoNextWeek}
              onClick={() =>
                setWeeklyOffset((prev) => (prev > 0 ? prev - 1 : 0))
              }
              className={`h-8 px-2 text-xs rounded-md border ${
                canGoNextWeek
                  ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  : "border-slate-100 bg-slate-50 text-slate-300 cursor-default"
              }`}
            >
              Semaines suivantes &gt;
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyDataForSelected}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#840404"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* SECTION MOIS */}
      <Card className="border-slate-200">
        <CardHeader className="flex items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Vue mensuelle – {actionLabelMap[selectedAction]}
            </CardTitle>
            <p className="text-xs text-slate-500">
              Volume par mois sur 12 mois glissants. Navigation possible pour
              reculer dans le temps.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthOffset(monthOffset + 1)}
              className="h-8 px-2 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            >
              &lt; 12 mois précédents
            </button>
            <button
              type="button"
              disabled={!canGoNextMonth}
              onClick={() =>
                setMonthOffset((prev) => (prev > 0 ? prev - 1 : 0))
              }
              className={`h-8 px-2 text-xs rounded-md border ${
                canGoNextMonth
                  ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  : "border-slate-100 bg-slate-50 text-slate-300 cursor-default"
              }`}
            >
              12 mois suivants &gt;
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDataForSelected}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#840404" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* STRUCTURE PORTEFEUILLE (secteur / villes) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Répartition du portefeuille par secteur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={establishmentsBySector} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              Top villes du portefeuille
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={establishmentsByCity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#6b7280" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reporting;
