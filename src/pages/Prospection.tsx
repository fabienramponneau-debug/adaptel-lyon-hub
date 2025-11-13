import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/ActionForm";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SuggestionForm } from "@/components/SuggestionForm";
import { EstablishmentDrawer } from "@/components/EstablishmentDrawer";

interface Action {
  id: string;
  type: "phoning" | "mailing" | "visite" | "rdv";
  date_action: string;
  commentaire: string | null;
  etablissement_id: string;
  establishment: { nom: string };
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

const Prospection = () => {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [actions, setActions] = useState<Action[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchActions();
    fetchSuggestions();
  }, [currentDate, view]);

  const fetchActions = async () => {
    let startDate, endDate;

    if (view === "day") {
      startDate = format(currentDate, "yyyy-MM-dd");
      endDate = startDate;
    } else if (view === "week") {
      startDate = format(startOfWeek(currentDate, { locale: fr }), "yyyy-MM-dd");
      endDate = format(endOfWeek(currentDate, { locale: fr }), "yyyy-MM-dd");
    } else {
      startDate = format(startOfMonth(currentDate), "yyyy-MM-dd");
      endDate = format(endOfMonth(currentDate), "yyyy-MM-dd");
    }

    const { data, error } = await supabase
      .from("actions")
      .select(`
        id,
        type,
        date_action,
        commentaire,
        etablissement_id,
        establishment:establishments(nom)
      `)
      .gte("date_action", startDate)
      .lte("date_action", endDate)
      .order("date_action", { ascending: true });

    if (!error && data) {
      setActions(data as any);
    }
  };

  const fetchSuggestions = async () => {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setSuggestions(data as Suggestion[]);
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case "phoning": return "bg-blue-500";
      case "mailing": return "bg-purple-500";
      case "visite": return "bg-green-500";
      case "rdv": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case "phoning": return "Phoning";
      case "mailing": return "Mailing";
      case "visite": return "Visite";
      case "rdv": return "RDV";
      default: return type;
    }
  };

  const navigate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (view === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const handleAddAction = (date: string) => {
    setSelectedDate(date);
    setActionFormOpen(true);
  };

  const handleActionClick = (action: Action) => {
    setSelectedEstablishmentId(action.etablissement_id);
    setDrawerOpen(true);
  };

  const renderDayView = () => {
    const dayActions = actions.filter(a => isSameDay(new Date(a.date_action), currentDate));

    return (
      <div className="space-y-3">
        {dayActions.map(action => (
          <Card 
            key={action.id} 
            className="p-4 cursor-pointer hover:bg-muted/50"
            onClick={() => handleActionClick(action)}
          >
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 ${getActionColor(action.type)}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{getActionLabel(action.type)}</Badge>
                  <span className="font-medium text-foreground">{action.establishment.nom}</span>
                </div>
                {action.commentaire && (
                  <p className="text-sm text-muted-foreground">{action.commentaire}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
        {dayActions.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucune action prévue</p>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { locale: fr });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayActions = actions.filter(a => isSameDay(new Date(a.date_action), day));
          const dateStr = format(day, "yyyy-MM-dd");

          return (
            <div key={dateStr} className="border rounded-lg p-3 min-h-[120px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-foreground">
                  {format(day, "EEE d", { locale: fr })}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleAddAction(dateStr)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {dayActions.map(action => (
                  <div
                    key={action.id}
                    className="text-xs p-1.5 rounded cursor-pointer hover:bg-muted"
                    onClick={() => handleActionClick(action)}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${getActionColor(action.type)} inline-block mr-1`} />
                    <span className="font-medium">{getActionLabel(action.type)}</span>
                    <div className="text-muted-foreground truncate mt-0.5">{action.establishment.nom}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: fr });
    const endDate = endOfWeek(monthEnd, { locale: fr });

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground p-2">
            {d}
          </div>
        ))}
        {days.map(day => {
          const dayActions = actions.filter(a => isSameDay(new Date(a.date_action), day));
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();

          const stats = {
            phoning: dayActions.filter(a => a.type === "phoning").length,
            mailing: dayActions.filter(a => a.type === "mailing").length,
            visite: dayActions.filter(a => a.type === "visite").length,
            rdv: dayActions.filter(a => a.type === "rdv").length,
          };

          return (
            <div
              key={dateStr}
              className={`border rounded p-2 min-h-[80px] ${
                isCurrentMonth ? "bg-background" : "bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${isCurrentMonth ? "font-medium" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                {isCurrentMonth && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => handleAddAction(dateStr)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {dayActions.length > 0 && (
                <div className="space-y-0.5">
                  {stats.phoning > 0 && (
                    <div className="text-xs flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>{stats.phoning}</span>
                    </div>
                  )}
                  {stats.mailing > 0 && (
                    <div className="text-xs flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>{stats.mailing}</span>
                    </div>
                  )}
                  {stats.visite > 0 && (
                    <div className="text-xs flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span>{stats.visite}</span>
                    </div>
                  )}
                  {stats.rdv > 0 && (
                    <div className="text-xs flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      <span>{stats.rdv}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Prospection</h1>
        <p className="text-muted-foreground">Planifiez vos actions commerciales</p>
      </div>

      <Tabs value="calendar" className="w-full">
        <TabsList>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions ({suggestions.filter(s => s.statut !== "traite").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {view === "day" && format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
                  {view === "week" && `Semaine du ${format(startOfWeek(currentDate, { locale: fr }), "d MMM", { locale: fr })}`}
                  {view === "month" && format(currentDate, "MMMM yyyy", { locale: fr })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <Button
                      variant={view === "day" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("day")}
                    >
                      Jour
                    </Button>
                    <Button
                      variant={view === "week" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("week")}
                    >
                      Semaine
                    </Button>
                    <Button
                      variant={view === "month" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("month")}
                    >
                      Mois
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                      Aujourd'hui
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => navigate("next")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {view === "day" && renderDayView()}
              {view === "week" && renderWeekView()}
              {view === "month" && renderMonthView()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <div className="flex justify-end">
            <SuggestionForm onSuccess={fetchSuggestions} />
          </div>
          <div className="grid gap-4">
            {suggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onUpdate={fetchSuggestions}
                onClick={() => {
                  if (suggestion.etablissement_id) {
                    setSelectedEstablishmentId(suggestion.etablissement_id);
                    setDrawerOpen(true);
                  }
                }}
              />
            ))}
            {suggestions.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                Aucune suggestion pour le moment
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ActionForm
        open={actionFormOpen}
        onOpenChange={setActionFormOpen}
        establishmentId=""
        onSuccess={fetchActions}
        prefilledDate={selectedDate}
      />

      <EstablishmentDrawer
        establishmentId={selectedEstablishmentId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdate={fetchActions}
      />
    </div>
  );
};

export default Prospection;
