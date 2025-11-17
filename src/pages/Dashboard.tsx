import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardStats } from "@/components/DashboardStats";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  Phone,
  Mail,
  MapPin,
  Bell,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  BarChart3,
  Activity,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SuggestionForm } from "@/components/SuggestionForm";
import { EstablishmentSheet } from "@/components/EstablishmentSheet";
import { Badge } from "@/components/ui/badge";

interface Stats {
  prospects: number;
  clients: number;
  anciensClients: number;
}

interface Action {
  id: string;
  type: string;
  date_action: string;
  relance_date?: string | null;
  commentaire?: string | null;
  etablissement_id?: string | null;
  etablissement: {
    nom: string;
  } | null;
}

interface Suggestion {
  id: string;
  titre: string;
  description: string | null;
  type: "suggestion" | "idee" | "prospect_a_verifier" | "info_commerciale";
  statut: "a_traiter" | "en_cours" | "traite";
  priorite: "basse" | "normale" | "haute";
  created_at: string;
  etablissement_id: string | null;
}

type WeekKey = "-1" | "0" | "1";

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    prospects: 0,
    clients: 0,
    anciensClients: 0,
  });

  const [upcomingActions, setUpcomingActions] = useState<Action[]>([]);
  const [reminders, setReminders] = useState<Action[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [periodOffset, setPeriodOffset] = useState(0);

  const [weeklyActions, setWeeklyActions] = useState<
    Record<WeekKey, Action[]>
  >({
    "-1": [],
    "0": [],
    "1": [],
  });

  const [selectedEstablishmentId, setSelectedEstablishmentId] =
    useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchActionsAndReminders();
  }, [viewMode, periodOffset]);

  useEffect(() => {
    fetchSuggestions();
    fetchWeeklyActivity();
  }, []);

  const activeSuggestionsCount = suggestions.filter(
    (s) => s.statut !== "traite"
  ).length;

  const fetchStats = async () => {
    const { data } = await supabase.from("establishments").select("statut");
    if (data) {
      const prospects = data.filter((e) => e.statut === "prospect").length;
      const clients = data.filter((e) => e.statut === "client").length;
      const anciensClients = data.filter(
        (e) => e.statut === "ancien_client"
      ).length;
      setStats({ prospects, clients, anciensClients });
    }
  };

  const getRangeForView = () => {
    const today = new Date();
    if (viewMode === "week") {
      const base = addWeeks(
        startOfWeek(today, { weekStartsOn: 1 }),
        periodOffset
      );
      const start = base;
      const end = endOfWeek(base, { weekStartsOn: 1 });
      return { start, end };
    } else {
      const base = addMonths(today, periodOffset);
      const start = startOfMonth(base);
      const end = endOfMonth(base);
      return { start, end };
    }
  };

  const getRangeLabel = () => {
    const { start, end } = getRangeForView();
    if (viewMode === "week") {
      const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const diff =
        (start.getTime() - thisWeekStart.getTime()) / (7 * 24 * 3600 * 1000);
      if (diff === 0) return "Semaine en cours";
      if (diff === -1) return "Semaine dernière";
      if (diff === 1) return "Semaine prochaine";
      return `Semaine du ${format(start, "dd/MM", {
        locale: fr,
      })} au ${format(end, "dd/MM", { locale: fr })}`;
    } else {
      const thisMonth = new Date().getMonth();
      const targetMonth = addMonths(new Date(), periodOffset).getMonth();
      if (targetMonth === thisMonth && periodOffset === 0)
        return "Mois en cours";
      return format(start, "MMMM yyyy", { locale: fr });
    }
  };

  const fetchActionsAndReminders = async () => {
    const { start, end } = getRangeForView();
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");

    // Actions à venir = statut_action = 'a_venir'
    const { data: actionsData } = await supabase
      .from("actions")
      .select(
        "id, type, date_action, commentaire, etablissement_id, etablissement:establishments(nom)"
      )
      .eq("statut_action", "a_venir")
      .gte("date_action", startStr)
      .lte("date_action", endStr)
      .order("date_action", { ascending: true });

    setUpcomingActions((actionsData as any) || []);

    // Rappels = statut_action = 'a_relancer' avec relance_date
    const { data: reminderData } = await supabase
      .from("actions")
      .select(
        "id, type, date_action, relance_date, commentaire, etablissement_id, etablissement:establishments(nom)"
      )
      .eq("statut_action", "a_relancer")
      .gte("relance_date", startStr)
      .lte("relance_date", endStr)
      .order("relance_date", { ascending: true });

    setReminders((reminderData as any) || []);
  };

  const fetchSuggestions = async () => {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    setSuggestions((data as any) || []);
  };

  const fetchWeeklyActivity = async () => {
    const today = new Date();
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekMinus1Start = addWeeks(thisWeekStart, -1);
    const weekPlus1End = endOfWeek(addWeeks(thisWeekStart, 1), {
      weekStartsOn: 1,
    });

    const startStr = format(weekMinus1Start, "yyyy-MM-dd");
    const endStr = format(weekPlus1End, "yyyy-MM-dd");

    const { data } = await supabase
      .from("actions")
      .select(
        "id, type, date_action, commentaire, etablissement_id, etablissement:establishments(nom)"
      )
      .gte("date_action", startStr)
      .lte("date_action", endStr)
      .order("date_action", { ascending: true });

    const buckets: Record<WeekKey, Action[]> = {
      "-1": [],
      "0": [],
      "1": [],
    };

    (data as any[] | null)?.forEach((a) => {
      const d = parseISO(a.date_action);
      const diffDays = Math.floor(
        (d.getTime() - thisWeekStart.getTime()) / (24 * 3600 * 1000)
      );
      const weekOffset = diffDays < 0 ? -1 : diffDays > 6 ? 1 : 0;
      const key = String(weekOffset) as WeekKey;
      if (buckets[key]) {
        buckets[key].push(a as any);
      }
    });

    setWeeklyActions(buckets);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "phoning":
        return <Phone className="h-4 w-4 text-blue-600" />;
      case "mailing":
        return <Mail className="h-4 w-4 text-green-600" />;
      case "visite":
        return <MapPin className="h-4 w-4 text-purple-600" />;
      case "rdv":
        return <Calendar className="h-4 w-4 text-orange-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      phoning: "Phoning",
      mailing: "Mailing",
      visite: "Visite",
      rdv: "Rdv",
    };
    return labels[type] || type;
  };

  const openEstablishment = (establishmentId?: string | null) => {
    if (!establishmentId) return;
    setSelectedEstablishmentId(establishmentId);
    setSheetOpen(true);
  };

  const refreshAll = () => {
    fetchStats();
    fetchActionsAndReminders();
    fetchWeeklyActivity();
    fetchSuggestions();
  };

  const renderActionRow = (action: Action) => {
    const dateLabel = format(new Date(action.date_action), "dd MMM", {
      locale: fr,
    });
    const label = getActionLabel(action.type);
    const nom = action.etablissement?.nom || "Établissement inconnu";
    const icon = getActionIcon(action.type);

    return (
      <div
        key={action.id}
        className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-200 cursor-pointer group"
        onClick={() => openEstablishment(action.etablissement_id)}
      >
        <div className="mt-0.5 p-1.5 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate text-gray-900 group-hover:text-blue-700 transition-colors">
              {nom}
            </p>
            <span className="text-xs text-gray-500 whitespace-nowrap bg-gray-50 px-2 py-1 rounded-full">
              {dateLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium">
              {label}
            </Badge>
          </div>
          {action.commentaire && (
            <p className="text-xs text-gray-600 line-clamp-2 mt-1">
              {action.commentaire}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderReminderRow = (action: Action) => {
    const baseDate = action.relance_date || action.date_action || "";
    const dateLabel = baseDate
      ? format(new Date(baseDate), "dd MMM", { locale: fr })
      : "";
    const label = getActionLabel(action.type);
    const nom = action.etablissement?.nom || "Établissement inconnu";
    const icon = getActionIcon(action.type);

    return (
      <div
        key={action.id}
        className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm transition-all duration-200 cursor-pointer group"
        onClick={() => openEstablishment(action.etablissement_id)}
      >
        <div className="mt-0.5 p-1.5 rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate text-gray-900 group-hover:text-orange-700 transition-colors">
              {nom}
            </p>
            <span className="text-xs text-gray-500 whitespace-nowrap bg-gray-50 px-2 py-1 rounded-full">
              {dateLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium bg-orange-100 text-orange-800">
              Rappel · {label}
            </Badge>
          </div>
          {action.commentaire && (
            <p className="text-xs text-gray-600 line-clamp-2 mt-1">
              {action.commentaire}
            </p>
          )}
        </div>
      </div>
    );
  };

  const getProspectionDaysLabel = (list: Action[]) => {
    const byDayIndex = new Set<number>();
    list.forEach((a) => {
      if (a.type !== "visite" && a.type !== "rdv") return;
      const d = parseISO(a.date_action);
      const idx = d.getDay();
      byDayIndex.add(idx);
    });

    const labels = [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ];

    const ordered: string[] = [];
    for (let i = 1; i <= 6; i++) {
      if (byDayIndex.has(i)) ordered.push(labels[i]);
    }
    if (byDayIndex.has(0)) ordered.push(labels[0]);

    if (ordered.length === 0) return "Aucune";
    return ordered.join(" - ");
  };

  const renderWeeklyColumn = (weekKey: WeekKey, title: string) => {
    const list = weeklyActions[weekKey] || [];
    const visites = list.filter((a) => a.type === "visite").length;
    const rdv = list.filter((a) => a.type === "rdv").length;

    const byType: Record<string, Action[]> = {
      phoning: [],
      mailing: [],
      visite: [],
      rdv: [],
    };
    list.forEach((a) => {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(a);
    });

    const prospectionDaysLabel = getProspectionDaysLabel(list);

    return (
      <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <span>{title}</span>
            </CardTitle>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 rounded-lg bg-purple-50">
                  <MapPin className="h-3 w-3 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-gray-600">Visites</span>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {visites}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 rounded-lg bg-orange-50">
                  <Calendar className="h-3 w-3 text-orange-600" />
                </div>
                <span className="text-xs font-medium text-gray-600">RDV</span>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {rdv}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-700 mb-2">Journées de prospection</div>
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {prospectionDaysLabel}
            </div>
          </div>

          <div className="space-y-3">
            {["phoning", "mailing", "visite", "rdv"].map((type) => {
              const arr = byType[type] || [];
              if (arr.length === 0) return null;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    {getActionIcon(type)}
                    <span>{getActionLabel(type)}</span>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {arr.length}
                    </Badge>
                  </div>
                  <ul className="space-y-1">
                    {arr.map((a) => (
                      <li
                        key={a.id}
                        className="text-xs text-gray-600 truncate cursor-pointer hover:text-blue-600 hover:font-medium transition-all duration-150 pl-4"
                        onClick={() =>
                          openEstablishment(a.etablissement_id)
                        }
                      >
                        {a.etablissement?.nom ||
                          "Établissement inconnu"}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {list.length === 0 && (
            <div className="text-center py-6">
              <div className="text-gray-400 mb-2">📅</div>
              <p className="text-xs text-gray-500">
                Aucune action planifiée
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header moderne */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white shadow-sm border border-gray-200">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
                <p className="text-gray-600 mt-1">
                  Vue d&apos;ensemble de l&apos;activité commerciale
                </p>
              </div>
            </div>
          </div>
          
          {/* Contrôles période */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm">
                <Button
                  type="button"
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3 text-xs font-medium"
                  onClick={() => setViewMode("week")}
                >
                  Semaine
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3 text-xs font-medium"
                  onClick={() => setViewMode("month")}
                >
                  Mois
                </Button>
              </div>
              
              <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-gray-100"
                  onClick={() => setPeriodOffset((v) => v - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium hover:bg-gray-100"
                  onClick={() => setPeriodOffset(0)}
                >
                  Aujourd&apos;hui
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-gray-100"
                  onClick={() => setPeriodOffset((v) => v + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center px-4 py-2 bg-white rounded-lg border border-gray-300 shadow-sm">
              <Calendar className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                {getRangeLabel()}
              </span>
            </div>
          </div>
        </div>

        {/* Stats en pleine largeur */}
        <DashboardStats
          prospects={stats.prospects}
          clients={stats.clients}
          anciensClients={stats.anciensClients}
        />

        {/* Section Suivi opérationnel */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white shadow-sm border border-gray-200">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Suivi Opérationnel</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {/* Actions à venir */}
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-base font-semibold text-gray-900">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <span>Actions à venir</span>
                  </CardTitle>
                  {upcomingActions.length > 0 && (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-700">
                      {upcomingActions.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {upcomingActions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">📅</div>
                    <p className="text-sm text-gray-500">
                      Aucune action planifiée sur cette période
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {upcomingActions.map((action) =>
                      renderActionRow(action)
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rappels */}
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-base font-semibold text-gray-900">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Bell className="h-5 w-5 text-orange-600" />
                    </div>
                    <span>Rappels</span>
                  </CardTitle>
                  {reminders.length > 0 && (
                    <Badge className="bg-orange-600 text-white hover:bg-orange-700">
                      {reminders.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {reminders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">🔔</div>
                    <p className="text-sm text-gray-500">
                      Aucun rappel sur cette période
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {reminders.map((action) =>
                      renderReminderRow(action)
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Suggestions */}
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="flex items-center gap-3 text-base font-semibold text-gray-900">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <Lightbulb className="h-5 w-5 text-amber-600" />
                      </div>
                      <span>Suggestions</span>
                    </CardTitle>
                    {activeSuggestionsCount > 0 && (
                      <Badge className="bg-amber-600 text-white hover:bg-amber-700">
                        {activeSuggestionsCount}
                      </Badge>
                    )}
                  </div>
                  <SuggestionForm onSuccess={fetchSuggestions} />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {suggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">💡</div>
                    <p className="text-sm text-gray-500 mb-4">
                      Aucune suggestion pour le moment
                    </p>
                    <SuggestionForm onSuccess={fetchSuggestions} />
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {suggestions.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onUpdate={() => {
                          fetchSuggestions();
                          fetchStats();
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section Synthèse activité */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white shadow-sm border border-gray-200">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Synthèse d'Activité</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {renderWeeklyColumn("-1", "Semaine dernière")}
            {renderWeeklyColumn("0", "Semaine en cours")}
            {renderWeeklyColumn("1", "Semaine prochaine")}
          </div>
        </section>
      </div>

      <EstablishmentSheet
        establishmentId={selectedEstablishmentId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpdate={refreshAll}
      />
    </div>
  );
};

export default Dashboard;