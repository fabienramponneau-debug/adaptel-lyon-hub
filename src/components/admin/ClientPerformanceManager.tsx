import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, History, Plus, Save, Target, Trash2, Unlink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useUserView } from "@/contexts/UserViewContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FrenchDecimalInput } from "@/components/ui/french-decimal-input";
import { Label } from "@/components/ui/label";

type EstablishmentStatus = "prospect" | "client" | "ancien_client";
interface EstablishmentOption { id: string; nom: string; statut: EstablishmentStatus; agency_client_id: string | null; client_triggered_at: string | null }
interface ClientRow {
  id: string;
  nom: string;
  statut: EstablishmentStatus;
  agencyClientId: string | null;
  triggeredAt: string | null;
  forecastRecordId: string | null;
  actualRecordId: string | null;
  forecastCa: number;
  forecastMargin: number;
  forecastRate: number;
  planningEstimateCa: number;
  planningEstimateMargin: number | null;
  actualCa: number;
  actualMargin: number;
  actualMarginAfterCet: number | null;
  hoursBilled: number | null;
  actualSource: "manuel" | "agence" | null;
  confirmed: boolean;
}
interface HistoryRow {
  id: string;
  record_type: string;
  operation: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  changed_at: string;
  change_source: string;
  changer: { prenom: string | null; nom: string | null } | { prenom: string | null; nom: string | null }[] | null;
}

const db = supabase as unknown as SupabaseClient;
const currency = (value: number | null) => value === null ? "—" : value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const marginRate = (margin: number | null, revenue: number) => margin !== null && revenue > 0 ? (margin / revenue) * 100 : 0;
const recordLabel: Record<string, string> = { objectif_financier: "Objectif admin", prevision_client: "Prévision commerciale", performance_client: "Réalisé" };

export function ClientPerformanceManager() {
  const { currentRole, currentUserId, selectedUserId, users } = useUserView();
  const [managedUserId, setManagedUserId] = useState("");
  const [periodCode, setPeriodCode] = useState(format(new Date(), "yyyy-MM"));
  const [allRows, setRows] = useState<ClientRow[]>([]);
  const [prospects, setProspects] = useState<EstablishmentOption[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [prospectSearch, setProspectSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [objective, setObjective] = useState({ revenue: 0, margin: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const normalizedClientSearch = clientSearch.trim().toLocaleLowerCase("fr");
  const rows = useMemo(
    () => normalizedClientSearch ? allRows.filter((row) => row.nom.toLocaleLowerCase("fr").includes(normalizedClientSearch)) : allRows,
    [allRows, normalizedClientSearch]
  );
  const isAdmin = currentRole === "admin";
  const activeUserId = isAdmin ? managedUserId : currentUserId ?? selectedUserId ?? "";
  const activeUserLabel = users.find((user) => user.id === activeUserId)?.label ?? "ce commercial";
  const canEditForecasts = isAdmin || activeUserId === currentUserId;

  useEffect(() => {
    if (!isAdmin || managedUserId) return;
    const initialId = selectedUserId && selectedUserId !== "tous" ? selectedUserId : users[0]?.id ?? "";
    setManagedUserId(initialId);
  }, [isAdmin, managedUserId, selectedUserId, users]);

  const load = useCallback(async () => {
    if (!activeUserId) { setRows([]); return; }
    setLoading(true);
    const [triggeredResult, forecastResult, actualResult, prospectResult, historyResult, objectiveResult] = await Promise.all([
      db.from("establishments").select("id, nom, statut, agency_client_id, client_triggered_at").eq("actif", true).eq("statut", "client").eq("commercial_id", activeUserId).order("nom"),
      db.from("previsions_clients").select("id, etablissement_id, chiffre_affaires_previsionnel, marge_previsionnelle, chiffre_affaires_estime_planning, marge_estimee_planning").eq("user_id", activeUserId).eq("period_code", periodCode),
      db.from("performances_clients").select("id, etablissement_id, chiffre_affaires, marge, marge_apres_cet, heures_facturees, source, statut_cloture").eq("user_id", activeUserId).eq("period_code", periodCode),
      db.from("establishments").select("id, nom, statut, agency_client_id, client_triggered_at").eq("actif", true).eq("statut", "prospect").eq("commercial_id", activeUserId).order("nom"),
      db.from("financial_change_history").select("id, record_type, operation, before_data, after_data, changed_at, change_source, changer:changed_by(prenom, nom)").eq("user_id", activeUserId).eq("period_code", periodCode).order("changed_at", { ascending: false }).limit(30),
      db.from("objectifs_financiers").select("objectif_ca, objectif_marge").eq("user_id", activeUserId).eq("period_code", periodCode).maybeSingle(),
    ]);
    if (triggeredResult.error || forecastResult.error || actualResult.error || prospectResult.error || historyResult.error || objectiveResult.error) {
      toast.error("Impossible de charger le suivi financier des clients.");
      setLoading(false);
      return;
    }

    const triggered = (triggeredResult.data ?? []) as EstablishmentOption[];
    const forecasts = forecastResult.data ?? [];
    const actuals = actualResult.data ?? [];
    const existingIds = new Set(triggered.map((client) => client.id));
    const extraIds = [...new Set([...forecasts.map((item) => item.etablissement_id), ...actuals.map((item) => item.etablissement_id)])].filter((id) => !existingIds.has(id));
    let extras: EstablishmentOption[] = [];
    if (extraIds.length > 0) {
      const extraResult = await db.from("establishments").select("id, nom, statut, agency_client_id, client_triggered_at").in("id", extraIds).order("nom");
      if (extraResult.error) toast.error("Certains prospects prévisionnels n’ont pas pu être chargés.");
      else extras = (extraResult.data ?? []) as EstablishmentOption[];
    }

    const forecastByClient = new Map(forecasts.map((item) => [item.etablissement_id, item]));
    const actualByClient = new Map(actuals.map((item) => [item.etablissement_id, item]));
    const establishments = [...triggered, ...extras].sort((left, right) => left.nom.localeCompare(right.nom, "fr"));
    setRows(establishments.map((client) => {
      const forecast = forecastByClient.get(client.id);
      const actual = actualByClient.get(client.id);
      const forecastCa = Number(forecast?.chiffre_affaires_previsionnel ?? 0);
      const forecastMargin = Number(forecast?.marge_previsionnelle ?? 0);
      return {
        id: client.id,
        nom: client.nom,
        statut: client.statut,
        agencyClientId: client.agency_client_id,
        triggeredAt: client.client_triggered_at,
        forecastRecordId: forecast?.id ?? null,
        actualRecordId: actual?.id ?? null,
        forecastCa,
        forecastMargin,
        forecastRate: marginRate(forecastMargin, forecastCa),
        planningEstimateCa: Number(forecast?.chiffre_affaires_estime_planning ?? 0),
        planningEstimateMargin: forecast?.marge_estimee_planning == null ? null : Number(forecast.marge_estimee_planning),
        actualCa: Number(actual?.chiffre_affaires ?? 0),
        actualMargin: Number(actual?.marge ?? 0),
        actualMarginAfterCet: actual?.marge_apres_cet == null ? null : Number(actual.marge_apres_cet),
        hoursBilled: actual?.heures_facturees == null ? null : Number(actual.heures_facturees),
        actualSource: actual?.source ?? null,
        confirmed: actual?.statut_cloture === "confirme",
      };
    }));
    const visibleIds = new Set(establishments.map((item) => item.id));
    setProspects(((prospectResult.data ?? []) as EstablishmentOption[]).filter((item) => !visibleIds.has(item.id)));
    setHistory((historyResult.data ?? []) as HistoryRow[]);
    setObjective({
      revenue: Number(objectiveResult.data?.objectif_ca ?? 0),
      margin: Number(objectiveResult.data?.objectif_marge ?? 0),
    });
    setLoading(false);
  }, [activeUserId, periodCode]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => allRows.reduce((acc, row) => ({
    forecastCa: acc.forecastCa + row.forecastCa,
    forecastMargin: acc.forecastMargin + row.forecastMargin,
    planningEstimateCa: acc.planningEstimateCa + row.planningEstimateCa,
    planningEstimateMargin: acc.planningEstimateMargin + (row.planningEstimateMargin ?? 0),
    actualCa: acc.actualCa + row.actualCa,
    actualMargin: acc.actualMargin + row.actualMargin,
  }), { forecastCa: 0, forecastMargin: 0, planningEstimateCa: 0, planningEstimateMargin: 0, actualCa: 0, actualMargin: 0 }), [allRows]);
  const missingAgencyLinks = allRows.filter((row) => row.statut === "client" && !row.agencyClientId).length;
  const hasPlanningMargin = allRows.some((row) => row.planningEstimateMargin !== null);
  const monthConfirmed = allRows.some((row) => row.actualRecordId) && allRows.filter((row) => row.actualRecordId).every((row) => row.confirmed);
  const normalizedProspectSearch = prospectSearch.trim().toLocaleLowerCase("fr");
  const visibleProspects = normalizedProspectSearch ? prospects.filter((prospect) => prospect.nom.toLocaleLowerCase("fr").includes(normalizedProspectSearch)) : prospects;

  const updateForecastCa = (id: string, value: number) => setRows((current) => current.map((row) => row.id === id ? { ...row, forecastCa: Math.max(0, value), forecastMargin: Math.max(0, value) * row.forecastRate / 100 } : row));
  const updateForecastRate = (id: string, value: number) => setRows((current) => current.map((row) => row.id === id ? { ...row, forecastRate: Math.max(0, value), forecastMargin: row.forecastCa * Math.max(0, value) / 100 } : row));
  const updateActualCa = (id: string, value: number) => setRows((current) => current.map((row) => row.id === id ? { ...row, actualCa: Math.max(0, value) } : row));
  const updateActualMargin = (id: string, value: number) => setRows((current) => current.map((row) => row.id === id ? { ...row, actualMargin: value } : row));

  const addProspect = () => {
    const prospect = prospects.find((item) => item.id === selectedProspectId);
    if (!prospect) return;
    const newRow: ClientRow = { id: prospect.id, nom: prospect.nom, statut: "prospect", agencyClientId: prospect.agency_client_id, triggeredAt: null, forecastRecordId: null, actualRecordId: null, forecastCa: 0, forecastMargin: 0, forecastRate: 0, planningEstimateCa: 0, planningEstimateMargin: null, actualCa: 0, actualMargin: 0, actualMarginAfterCet: null, hoursBilled: null, actualSource: null, confirmed: false };
    setRows((current) => [...current, newRow].sort((left, right) => left.nom.localeCompare(right.nom, "fr")));
    setProspects((current) => current.filter((item) => item.id !== prospect.id));
    setSelectedProspectId("");
  };

  const removeProspect = async (row: ClientRow) => {
    if (row.forecastRecordId) {
      const { error } = await db.from("previsions_clients").delete().eq("id", row.forecastRecordId);
      if (error) { toast.error(error.message); return; }
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
    const restoredProspect: EstablishmentOption = { id: row.id, nom: row.nom, statut: "prospect", agency_client_id: row.agencyClientId, client_triggered_at: null };
    setProspects((current) => [...current, restoredProspect].sort((left, right) => left.nom.localeCompare(right.nom, "fr")));
    toast.success("Prospect retiré du prévisionnel.");
    await load();
  };

  const saveMonth = async (confirm = false) => {
    if (!activeUserId) return;
    setSaving(true);
    const operations: PromiseLike<{ error: { message: string } | null }>[] = [];
    if (canEditForecasts) {
      const forecastRows = allRows.filter((row) => row.forecastRecordId || row.forecastCa !== 0 || row.forecastMargin !== 0 || row.statut === "prospect");
      if (forecastRows.length > 0) operations.push(db.from("previsions_clients").upsert(forecastRows.map((row) => ({ user_id: activeUserId, etablissement_id: row.id, period_code: periodCode, chiffre_affaires_previsionnel: row.forecastCa, marge_previsionnelle: row.forecastMargin })), { onConflict: "user_id,etablissement_id,period_code" }));
    }
    if (isAdmin) {
      const actualRows = allRows.filter((row) => row.actualSource !== "agence" && (!row.agencyClientId || row.actualSource === "manuel") && (row.actualRecordId || row.actualCa !== 0 || row.actualMargin !== 0));
      if (actualRows.length > 0) operations.push(db.from("performances_clients").upsert(actualRows.map((row) => ({ user_id: activeUserId, etablissement_id: row.id, period_code: periodCode, chiffre_affaires: row.actualCa, marge: row.actualMargin, agency_client_id: row.agencyClientId, source: "manuel", statut_cloture: confirm ? "confirme" : (row.confirmed ? "confirme" : "brouillon"), cloture_at: confirm ? new Date().toISOString() : null, cloture_by: confirm ? currentUserId : null })), { onConflict: "user_id,etablissement_id,period_code" }));
    }
    const results = await Promise.all(operations);
    setSaving(false);
    const error = results.find((result) => result.error)?.error;
    if (error) toast.error(error.message); else { toast.success(confirm ? "Résultats validés et mois clôturé." : "Données du mois enregistrées."); await load(); }
  };

  if (!activeUserId) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Aucun commercial actif disponible.</CardContent></Card>;

  const summary = [
    { label: "Objectif fixé par l’admin", revenue: objective.revenue, margin: objective.margin },
    { label: "Prévision commerciale", revenue: totals.forecastCa, margin: totals.forecastMargin },
    { label: "Estimation plannings", revenue: totals.planningEstimateCa, margin: hasPlanningMargin ? totals.planningEstimateMargin : null },
    { label: monthConfirmed ? "Réel consolidé" : "Réel saisi à valider", revenue: totals.actualCa, margin: totals.actualMargin },
  ];
  const progressItems = [
    { label: "Prévision commerciale", value: totals.forecastCa, color: "bg-blue-600" },
    { label: "Estimation planning", value: totals.planningEstimateCa, color: "bg-amber-500" },
    ...(totals.actualCa > 0 ? [{ label: monthConfirmed ? "Réel consolidé" : "Réel saisi", value: totals.actualCa, color: "bg-emerald-600" }] : []),
  ];

  return (
    <Card>
      <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#840404]" />Suivi mensuel par client</CardTitle><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Clients attribués au commercial et prospects ajoutés volontairement au prévisionnel. L’objectif admin reste verrouillé.</p></div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[420px]">
          {isAdmin && <div className="space-y-2"><Label htmlFor="client-finance-user">Commercial</Label><select id="client-finance-user" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={managedUserId} onChange={(event) => { setManagedUserId(event.target.value); setClientSearch(""); setProspectSearch(""); }}><option value="">Choisir un commercial</option>{users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</select></div>}
          <div className="space-y-2"><Label htmlFor="client-finance-month">Mois</Label><Input id="client-finance-month" type="month" value={periodCode} onChange={(event) => setPeriodCode(event.target.value)} /></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasPlanningMargin && totals.planningEstimateCa > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">L’app agence fournit actuellement le CA estimé du planning, mais ne possède pas encore de calcul de marge. La marge planning reste donc non disponible.</div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((item, index) => <div key={item.label} className={`rounded-xl border p-4 ${index === 0 ? "border-[#840404]/20 bg-[#840404]/5" : "bg-slate-50"}`}><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-700">{item.label}</p>{index === 0 && <Target className="h-4 w-4 text-[#840404]" />}</div><div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-slate-500">CA</p><p className="mt-1 font-semibold tabular-nums">{currency(item.revenue)}</p></div><div><p className="text-xs text-slate-500">Marge</p><p className="mt-1 font-semibold tabular-nums">{currency(item.margin)}</p></div><div><p className="text-xs text-slate-500">Taux</p><p className="mt-1 font-semibold tabular-nums">{item.margin === null || item.revenue <= 0 ? "—" : `${marginRate(item.margin, item.revenue).toFixed(1)} %`}</p></div></div></div>)}
        </div>
        {objective.revenue > 0 && <div className="rounded-xl border bg-white p-4"><div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">Progression vers l’objectif CA du mois</p><p className="text-sm text-slate-500">Compare l’engagement commercial, le planning agence et le résultat validé.</p></div><p className="text-sm font-medium tabular-nums text-slate-700">Objectif : {currency(objective.revenue)}</p></div><div className="space-y-4">{progressItems.map((item) => { const percentage = Math.max(0, (item.value / objective.revenue) * 100); const gap = item.value - objective.revenue; return <div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.label}</span><span className="tabular-nums text-slate-600">{Math.round(percentage)} % · {gap >= 0 ? `${currency(gap)} d’avance` : `${currency(Math.abs(gap))} restant`}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, percentage)}%` }} /></div></div>; })}</div></div>}

        {canEditForecasts && prospects.length > 0 && <div className="grid gap-3 rounded-xl border bg-white p-4 lg:grid-cols-[minmax(180px,0.65fr)_minmax(260px,1fr)_auto] lg:items-end"><div className="space-y-2"><Label htmlFor="forecast-prospect-search">Rechercher un prospect</Label><Input id="forecast-prospect-search" type="search" placeholder="Nom de l’établissement…" value={prospectSearch} onChange={(event) => setProspectSearch(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="forecast-prospect">Ajouter au prévisionnel de {periodCode.slice(5, 7)}/{periodCode.slice(0, 4)}</Label><select id="forecast-prospect" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedProspectId} onChange={(event) => setSelectedProspectId(event.target.value)}><option value="">Choisir parmi {visibleProspects.length} prospect{visibleProspects.length > 1 ? "s" : ""} de {activeUserLabel}</option>{visibleProspects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.nom}</option>)}</select></div><Button variant="outline" onClick={addProspect} disabled={!selectedProspectId}><Plus className="mr-2 h-4 w-4" />Ajouter</Button></div>}
        {missingAgencyLinks > 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><Unlink className="mt-0.5 h-4 w-4 shrink-0" /><span>{missingAgencyLinks} client{missingAgencyLinks > 1 ? "s" : ""} attribué{missingAgencyLinks > 1 ? "s" : ""} à rapprocher avec l’app agence.</span></div>}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">Détail prévisionnel et réalisé</p><p className="text-xs text-slate-500">L’objectif mensuel global se règle dans « Objectifs financiers annuels ».</p></div><div className="w-full space-y-2 sm:w-80"><Label htmlFor="client-finance-search">Rechercher un client ou prospect</Label><Input id="client-finance-search" type="search" placeholder="Nom de l’établissement…" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} /></div></div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-3">Client / prospect</th><th className="px-3 py-3">Prévision CA</th><th className="px-3 py-3">Taux marge prévu</th><th className="px-3 py-3 text-right">Marge prévue</th><th className="px-3 py-3 text-right">Estimation planning</th><th className="px-3 py-3">CA réel</th><th className="px-3 py-3">Marges réelles</th><th className="px-3 py-3">Validation</th><th className="px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y">
              {rows.map((row) => { const actualReadOnly = row.actualSource === "agence" || (!!row.agencyClientId && row.actualSource !== "manuel") || row.confirmed; return <tr key={row.id} className="hover:bg-slate-50/60"><td className="px-3 py-3"><div className="flex items-center gap-2"><p className="font-medium text-slate-900">{row.nom}</p>{row.statut === "prospect" && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Prospect prévisionnel</span>}</div><p className="mt-0.5 text-xs text-slate-500">{row.statut === "prospect" ? "Ajouté uniquement pour ce mois" : row.agencyClientId ? "Lié à l’app agence" : "Lien agence manquant"}{row.triggeredAt ? ` · déclenché le ${new Date(row.triggeredAt).toLocaleDateString("fr-FR")}` : ""}</p></td><td className="px-3 py-2"><FrenchDecimalInput aria-label={`Prévision CA ${row.nom}`} min={0} decimals={2} value={row.forecastCa} onValueChange={(value) => updateForecastCa(row.id, value)} disabled={!canEditForecasts || row.confirmed} className="h-9 w-28" /></td><td className="px-3 py-2"><div className="relative w-24"><FrenchDecimalInput aria-label={`Taux de marge prévu ${row.nom}`} min={0} decimals={2} value={row.forecastRate} onValueChange={(value) => updateForecastRate(row.id, value)} disabled={!canEditForecasts || row.confirmed} className="h-9 pr-7" /><span className="pointer-events-none absolute right-3 top-2 text-slate-400">%</span></div></td><td className="px-3 py-2 text-right tabular-nums">{currency(row.forecastMargin)}</td><td className="px-3 py-2 text-right"><p className="font-medium tabular-nums">{currency(row.planningEstimateCa)}</p><p className="text-xs text-slate-500">{currency(row.planningEstimateMargin)}{row.planningEstimateMargin !== null && row.planningEstimateCa > 0 ? ` · ${marginRate(row.planningEstimateMargin, row.planningEstimateCa).toFixed(1)} %` : ""}</p></td><td className="px-3 py-2"><FrenchDecimalInput aria-label={`CA réel ${row.nom}`} min={0} decimals={2} value={row.actualCa} onValueChange={(value) => updateActualCa(row.id, value)} disabled={!isAdmin || actualReadOnly} className="h-9 w-28" />{row.actualSource === "agence" && <p className="mt-1 text-xs text-emerald-700">Import agence · {row.hoursBilled == null ? "heures —" : `${row.hoursBilled.toLocaleString("fr-FR")} h`}</p>}</td><td className="px-3 py-2"><FrenchDecimalInput aria-label={`Marge avant CET ${row.nom}`} decimals={2} allowNegative value={row.actualMargin} onValueChange={(value) => updateActualMargin(row.id, value)} disabled={!isAdmin || actualReadOnly} className="h-9 w-28" /><p className="mt-1 text-right text-xs text-slate-500">Avant CET · {row.actualCa > 0 ? `${marginRate(row.actualMargin, row.actualCa).toFixed(1)} %` : "—"}</p>{row.actualMarginAfterCet !== null && <p className="text-right text-xs text-slate-500">Après CET · {currency(row.actualMarginAfterCet)}</p>}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs ${row.confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.confirmed ? "Validé" : "À valider"}</span></td><td className="px-3 py-2 text-right">{row.statut === "prospect" && canEditForecasts && <Button variant="ghost" size="icon" title="Retirer ce prospect du prévisionnel" onClick={() => void removeProspect(row)}><Trash2 className="h-4 w-4 text-slate-500" /></Button>}</td></tr>; })}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aucun client attribué ni prospect ajouté au prévisionnel de ce mois.</p>}
        </div>

        {isAdmin && <p className="text-sm text-slate-500">Les réels liés à l’app agence sont en lecture seule. La saisie CRM reste disponible uniquement pour les fiches non rapprochées ou les anciennes lignes manuelles.</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => void saveMonth(false)} disabled={loading || saving || rows.length === 0}><Save className="mr-2 h-4 w-4" />Enregistrer les données</Button>{isAdmin && <Button onClick={() => void saveMonth(true)} disabled={loading || saving || !rows.some((row) => row.actualRecordId || row.actualCa !== 0 || row.actualMargin !== 0) || monthConfirmed}><CheckCircle2 className="mr-2 h-4 w-4" />{monthConfirmed ? "Résultats validés" : "Valider les résultats du mois"}</Button>}</div>

        <details className="rounded-xl border bg-slate-50/50 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-800"><History className="h-4 w-4 text-[#840404]" />Historique des modifications du mois <span className="ml-auto text-xs font-normal text-slate-500">{history.length} événement{history.length > 1 ? "s" : ""}</span></summary><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-2">Date</th><th className="pb-2">Élément</th><th className="pb-2">Action</th><th className="pb-2">Auteur</th><th className="pb-2">Source</th></tr></thead><tbody className="divide-y">{history.map((item) => { const changer = Array.isArray(item.changer) ? item.changer[0] : item.changer; return <tr key={item.id}><td className="py-2 tabular-nums">{new Date(item.changed_at).toLocaleString("fr-FR")}</td><td className="py-2">{recordLabel[item.record_type] ?? item.record_type}</td><td className="py-2">{item.operation === "INSERT" ? "Création" : item.operation === "DELETE" ? "Suppression" : "Modification"}</td><td className="py-2">{changer ? `${changer.prenom ?? ""} ${changer.nom ?? ""}`.trim() : "Système"}</td><td className="py-2">{item.change_source === "api_agence" ? "App agence" : "CRM"}</td></tr>; })}</tbody></table>{history.length === 0 && <p className="py-4 text-sm text-slate-500">Aucune modification enregistrée pour ce mois.</p>}</div></details>
      </CardContent>
    </Card>
  );
}
