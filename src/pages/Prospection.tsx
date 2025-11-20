// src/pages/Prospection.tsx - Finalisé (Header, Filtre User, Stabilité)
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfWeek,
  addWeeks,
  addDays,
  isSameDay,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  Bell,
  Lightbulb,
  Target // Icône pour le titre
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { ActionForm } from "@/components/ActionForm";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SuggestionForm } from "@/components/SuggestionForm";
import { EstablishmentSheet } from "@/components/EstablishmentSheet";
import { useUserView } from "@/contexts/UserViewContext"; // Import du contexte UserView

interface Action {
  id: string;
  type: "phoning" | "mailing" | "visite" | "rdv";
  date_action: string;
  relance_date?: string | null;
  commentaire: string | null;
  etablissement_id: string | null;
  etablissement: { nom: string } | null;
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
  const { selectedUserId, loadingUserView } = useUserView() as any; // Cast à 'any' pour la stabilité
  const isGlobalView = selectedUserId === "tous";

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Correction TS2589: Cast à 'any'
  const [actions, setActions] = useState<Action[] | any>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | any>([]);
  const [reminders, setReminders] = useState<Action[] | any>([]);

  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [selectedEstablishmentId, setSelectedEstablishmentId] =
    useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState<
    ("phoning" | "mailing" | "visite" | "rdv")[]
  >(["phoning", "mailing", "visite", "rdv"]);

  const [tab, setTab] = useState<"calendar" | "suggestions" | "reminders">(
    "calendar"
  );

  // Fonction pour appliquer le filtre utilisateur
  const applyUserFilter = (query: any) => {
    if (isGlobalView || !selectedUserId || selectedUserId === 'tous') {
        return query;
    }
    return query.eq('user_id', selectedUserId);
  };

  // Ajout de la fonction refreshAll pour les mises à jour propres
  const refreshAll = () => {
    if (selectedUserId) {
        const userIdToFilter = isGlobalView ? null : selectedUserId;
        fetchActions(userIdToFilter);
        fetchSuggestions(userIdToFilter);
        fetchReminders(userIdToFilter);
    }
  };


  // useEffect pour charger les actions, suggestions et rappels
  useEffect(() => {
    if (loadingUserView || !selectedUserId) return;
    
    const userIdToFilter = isGlobalView ? null : selectedUserId;

    fetchActions(userIdToFilter);
    fetchSuggestions(userIdToFilter);
    fetchReminders(userIdToFilter);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart, selectedUserId, loadingUserView]);

  
  const fetchActions = async (userIdToFilter: string | null) => {
    const start = currentWeekStart;
    const end = addDays(currentWeekStart, 13); // 2 semaines

    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");

    let query = supabase
      .from("actions")
      .select(
        "id, type, date_action, commentaire, etablissement_id, etablissement:establishments(nom)"
      );
      
    if (userIdToFilter) {
        query = query.eq('user_id', userIdToFilter);
    }
    
    const { data, error } = await query
      .gte("date_action", startStr)
      .lte("date_action", endStr)
      .order("date_action", { ascending: true });

    if (!error && data) {
      setActions(data as any);
    }
  };

  const fetchSuggestions = async (userIdToFilter: string | null) => {
    let query = supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
      
    if (userIdToFilter) {
        query = query.eq('created_by', userIdToFilter); 
    }
    
    const { data } = await query;
    setSuggestions((data as any) || []);
  };

  const fetchReminders = async (userIdToFilter: string | null) => {
    let query = supabase
      .from("actions")
      .select(
        "id, type, date_action, relance_date, commentaire, etablissement_id, etablissement:establishments(nom)"
      )
      .eq("statut_action", "a_relancer");
      
    if (userIdToFilter) {
        query = query.eq('user_id', userIdToFilter);
    }

    const { data } = await query
      .order("relance_date", { ascending: true });

    setReminders((data as any) || []);
  };

  const toggleType = (type: "phoning" | "mailing" | "visite" | "rdv") => {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Correction de la vérification de type ici
  const filteredActions = actions.filter((a: any) => typeFilter.includes(a.type));

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeekStart((prev) =>
      addWeeks(prev, direction === "next" ? 1 : -1)
    );
  };

  const handleAddAction = (date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setActionFormOpen(true);
  };

  const openEstablishment = (id?: string | null) => {
    if (!id) return;
    setSelectedEstablishmentId(id);
    setSheetOpen(true);
  };

  const handleDeleteAction = async (id: string) => {
    await supabase.from("actions").delete().eq("id", id);
    refreshAll(); 
  };

  // === Helpers UI ===

  const getActionIcon = (type: string) => {
    switch (type) {
      case "phoning":
        return <Phone className="h-3.5 w-3.5" />;
      case "mailing":
        return <Mail className="h-3.5 w-3.5" />;
      case "visite":
        return <MapPin className="h-3.5 w-3.5" />;
      case "rdv":
        return <CalendarIcon className="h-3.5 w-3.5" />;
      default:
        return <Bell className="h-3.5 w-3.5" />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case "phoning":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "mailing":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "visite":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "rdv":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case "phoning":
        return "Phoning";
      case "mailing":
        return "Mailing";
      case "visite":
        return "Visite";
      case "rdv":
        return "Rdv";
      default:
        return type;
    }
  };

  const activeSuggestionsCount = suggestions.filter(
    (s: any) => s.statut !== "traite"
  ).length;

  const activeRemindersCount = reminders.length;

  // === Rendu calendrier 2 semaines, Lundi → Vendredi ===

  const renderTwoWeekGrid = () => {
    const week1Days = Array.from({ length: 5 }, (_, i) =>
      addDays(currentWeekStart, i)
    );
    const week2Days = Array.from({ length: 5 }, (_, i) =>
      addDays(currentWeekStart, 7 + i)
    );

    const renderRow = (days: Date[]) => (
      <div className="grid grid-cols-5 gap-3">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          // Correction de la vérification de type ici
          const dayActions = (filteredActions as any[]).filter((a) =>
            isSameDay(parseISO(a.date_action), day)
          );

          return (
            <div
              key={dateStr}
              className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[260px]"
            >
              {/* En-tête de la case journée */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-slate-500 uppercase">
                    {format(day, "EEE", { locale: fr })}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {format(day, "d MMM", { locale: fr })}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleAddAction(day)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Liste des actions du jour */}
              <div className="flex-1 px-3 py-2 space-y-1.5 max-h-[220px] overflow-y-auto">
                {dayActions.length === 0 ? (
                  <p className="text-[11px] text-slate-400 mt-2">
                    Aucune action
                  </p>
                ) : (
                  dayActions.map((action: any) => {
                    const colorClass = getActionColor(action.type);
                    const nom =
                      action.etablissement?.nom || "Établissement";

                    return (
                      <div
                        key={action.id}
                        className="group flex items-center gap-2 rounded-lg border bg-slate-50 px-2 py-1.5 hover:bg-slate-100"
                      >
                        {/* Icône type */}
                        <div
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${colorClass}`}
                        >
                          {getActionIcon(action.type)}
                        </div>

                        {/* Nom établissement uniquement (plus d’étiquette type) */}
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() =>
                            openEstablishment(action.etablissement_id)
                          }
                        >
                          <span className="text-[12px] font-medium text-slate-900 truncate">
                            {nom}
                          </span>
                        </button>

                        {/* Bouton suppression */}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAction(action.id);
                          }}
                        >
                          <span className="text-[14px] leading-none text-slate-400">
                            ×
                          </span>
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

    const labelWeek1 = `${format(week1Days[0], "dd MMM", {
      locale: fr,
    })} – ${format(week1Days[4], "dd MMM", { locale: fr })}`;
    const labelWeek2 = `${format(week2Days[0], "dd MMM", {
      locale: fr,
    })} – ${format(week2Days[4], "dd MMM", { locale: fr })}`;

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Période de prospection
            </p>
            <p className="text-sm text-slate-800">
              Semaine en cours :{" "}
              <span className="font-semibold">{labelWeek1}</span>
              <span className="mx-2 text-slate-400">•</span>
              Semaine suivante :{" "}
              <span className="font-semibold">{labelWeek2}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateWeek("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() =>
                setCurrentWeekStart(
                  startOfWeek(new Date(), { weekStartsOn: 1 })
                )
              }
            >
              Cette semaine
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateWeek("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filtres types */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-2">
            Types d&apos;actions :
          </span>
          {([
            "phoning",
            "mailing",
            "visite",
            "rdv",
          ] as ("phoning" | "mailing" | "visite" | "rdv")[]).map((t) => {
            const active = typeFilter.includes(t);
            return (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-8 px-3 text-xs flex items-center gap-1.5"
                onClick={() => toggleType(t)}
              >
                {getActionIcon(t)}
                <span>{getActionLabel(t)}</span>
              </Button>
            );
          })}
        </div>

        {/* Grille 2 semaines */}
        <div className="space-y-4">
          {renderRow(week1Days)}
          {renderRow(week2Days)}
        </div>
      </div>
    );
  };

  // === Rendu rappels ===

  const renderRemindersList = () => {
    if (reminders.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Aucun rappel pour le moment.
        </p>
      );
    }

    return (
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {reminders.map((r: any) => {
          const baseDate = r.relance_date || r.date_action;
          const dateLabel = baseDate
            ? format(new Date(baseDate), "dd MMM yyyy", { locale: fr })
            : "";
          const label = getActionLabel(r.type);
          const icon = getActionIcon(r.type);
          const nom = r.etablissement?.nom || "Établissement";

          return (
            <Card
              key={r.id}
              className="p-3 hover:bg-muted/40 cursor-pointer"
              onClick={() => openEstablishment(r.etablissement_id)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  {icon}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{nom}</p>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {dateLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Rappel · {label}
                  </p>
                  {r.commentaire && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {r.commentaire}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* NOUVEL EN-TÊTE UNIFORMISÉ (Header cohérent) */}
      <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-[#840404]/10 rounded-lg">
                  <Target className="h-6 w-6 text-[#840404]" />
              </div>
              <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                      Prospection
                  </h1>
                  <p className="text-slate-600">
                      Préparez et visualisez vos actions de prospection
                  </p>
              </div>
          </div>
      </div>
      {/* FIN DU NOUVEL EN-TÊTE */}

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setTab(v as "calendar" | "suggestions" | "reminders")
        }
        className="w-full"
      >
        <TabsList className="mb-3">
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="suggestions">
            Suggestions
            {activeSuggestionsCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-slate-900 text-white text-[11px] px-1">
                {activeSuggestionsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reminders">
            Rappels
            {activeRemindersCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-slate-900 text-white text-[11px] px-1">
                {activeRemindersCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Onglet Calendrier */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <CalendarIcon className="h-5 w-5 text-[#840404]" />
                  <span>Calendrier de prospection</span>
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>
                    Planifiez vos phoning, mailings, visites et RDV sur 2
                    semaines
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>{renderTwoWeekGrid()}</CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Suggestions */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Lightbulb className="h-5 w-5 text-[#840404]" />
                <span>Suggestions de prospection</span>
              </CardTitle>
              <SuggestionForm onSuccess={refreshAll} />
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aucune suggestion pour le moment
                </p>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {suggestions.map((s: any) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onUpdate={refreshAll}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Rappels */}
        <TabsContent value="reminders" className="space-y-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Bell className="h-5 w-5 text-[#840404]" />
                <span>Rappels à traiter</span>
              </CardTitle>
            </CardHeader>
            <CardContent>{renderRemindersList()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Popup création d’action */}
      <ActionForm
        open={actionFormOpen}
        onOpenChange={setActionFormOpen}
        establishmentId={undefined}
        onSuccess={refreshAll}
        prefilledDate={selectedDate}
      />

      {/* Overlay + fiche établissement (Prospection seulement) */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSheetOpen(false)}
          />
          <EstablishmentSheet
            establishmentId={selectedEstablishmentId}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onUpdate={refreshAll}
          />
        </>
      )}
    </div>
  );
};

export default Prospection;