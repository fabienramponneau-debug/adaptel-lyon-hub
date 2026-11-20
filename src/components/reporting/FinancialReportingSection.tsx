import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Euro, Landmark, Percent, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserView } from "@/contexts/UserViewContext";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface MonthSummary { month: number; objectiveCa: number; objectiveMargin: number; forecastCa: number; forecastMargin: number; planningEstimateCa: number; planningEstimateMargin: number; actualCa: number; actualMargin: number; previousYearCa: number; prime: number; clients: Set<string>; confirmed: boolean; actualRows: number; confirmedRows: number }
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const currency = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const emptyRows = (): MonthSummary[] => MONTHS.map((_, index) => ({ month: index + 1, objectiveCa: 0, objectiveMargin: 0, forecastCa: 0, forecastMargin: 0, planningEstimateCa: 0, planningEstimateMargin: 0, actualCa: 0, actualMargin: 0, previousYearCa: 0, prime: 0, clients: new Set<string>(), confirmed: false, actualRows: 0, confirmedRows: 0 }));
const commissionRate = (periodCode: string, triggeredAt?: string | null) => {
  if (!triggeredAt) return 0;
  const [periodYear, periodMonth] = periodCode.split("-").map(Number);
  const triggered = new Date(triggeredAt);
  const elapsedMonths = (periodYear - triggered.getFullYear()) * 12 + (periodMonth - (triggered.getMonth() + 1));
  if (elapsedMonths < 0) return 0;
  if (elapsedMonths < 12) return 0.07;
  if (elapsedMonths < 24) return 0.04;
  return 0.03;
};

export function FinancialReportingSection() {
  const { currentRole, currentUserId, selectedUserId, users } = useUserView();
  const [managedUserId, setManagedUserId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<MonthSummary[]>(emptyRows);
  const [syncing, setSyncing] = useState(false);
  const isAdmin = currentRole === "admin";
  const activeUserId = isAdmin ? managedUserId : currentUserId ?? selectedUserId ?? "";

  useEffect(() => {
    if (!isAdmin || managedUserId) return;
    setManagedUserId(selectedUserId || users[0]?.id || "tous");
  }, [isAdmin, managedUserId, selectedUserId, users]);

  const load = useCallback(async () => {
    if (!activeUserId) return;
    const start = `${year}-01`;
    const end = `${year}-12`;
    const previousStart = `${year - 1}-01`;
    const previousEnd = `${year - 1}-12`;
    let targets = supabase.from("objectifs_financiers").select("period_code, objectif_ca, objectif_marge").gte("period_code", start).lte("period_code", end);
    let forecasts = supabase.from("previsions_clients").select("period_code, chiffre_affaires_previsionnel, marge_previsionnelle, chiffre_affaires_estime_planning, marge_estimee_planning").gte("period_code", start).lte("period_code", end);
    let actuals = supabase.from("performances_clients").select("period_code, etablissement_id, chiffre_affaires, marge, statut_cloture, establishment:establishments(client_triggered_at)").gte("period_code", start).lte("period_code", end);
    let previousActuals = supabase.from("performances_clients").select("period_code, chiffre_affaires, statut_cloture").gte("period_code", previousStart).lte("period_code", previousEnd);
    if (activeUserId !== "tous") { targets = targets.eq("user_id", activeUserId); forecasts = forecasts.eq("user_id", activeUserId); actuals = actuals.eq("user_id", activeUserId); previousActuals = previousActuals.eq("user_id", activeUserId); }
    const [targetResult, forecastResult, actualResult, previousActualResult] = await Promise.all([targets, forecasts, actuals, previousActuals]);
    const next = emptyRows();
    for (const item of targetResult.data ?? []) { const row = next[Number(item.period_code.slice(5, 7)) - 1]; if (row) { row.objectiveCa += Number(item.objectif_ca); row.objectiveMargin += Number(item.objectif_marge); } }
    for (const item of forecastResult.data ?? []) { const row = next[Number(item.period_code.slice(5, 7)) - 1]; if (row) { row.forecastCa += Number(item.chiffre_affaires_previsionnel); row.forecastMargin += Number(item.marge_previsionnelle); row.planningEstimateCa += Number(item.chiffre_affaires_estime_planning); row.planningEstimateMargin += Number(item.marge_estimee_planning); } }
    for (const item of actualResult.data ?? []) { const row = next[Number(item.period_code.slice(5, 7)) - 1]; if (row) { row.actualRows += 1; if (item.statut_cloture === "confirme") { const establishment = Array.isArray(item.establishment) ? item.establishment[0] : item.establishment; const margin = Number(item.marge); row.confirmedRows += 1; row.actualCa += Number(item.chiffre_affaires); row.actualMargin += margin; row.prime += Math.max(0, margin) * commissionRate(item.period_code, establishment?.client_triggered_at); row.clients.add(item.etablissement_id); } } }
    for (const item of previousActualResult.data ?? []) { if (item.statut_cloture !== "confirme") continue; const row = next[Number(item.period_code.slice(5, 7)) - 1]; if (row) row.previousYearCa += Number(item.chiffre_affaires); }
    for (const row of next) row.confirmed = row.actualRows > 0 && row.actualRows === row.confirmedRows;
    setRows(next);
  }, [activeUserId, year]);

  useEffect(() => { void load(); }, [load]);

  const syncAgencyActuals = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-agency-actuals", {
      body: { fromPeriod: `${year}-01`, toPeriod: `${year}-12` },
    });
    setSyncing(false);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "La synchronisation avec l’app agence a échoué.");
      return;
    }
    toast.success(`${data.importedActuals ?? 0} résultat${data.importedActuals === 1 ? "" : "s"} confirmé${data.importedActuals === 1 ? "" : "s"} synchronisé${data.importedActuals === 1 ? "" : "s"}.`);
    await load();
  };

  const annual = useMemo(() => rows.reduce((acc, row) => ({ objectiveCa: acc.objectiveCa + row.objectiveCa, objectiveMargin: acc.objectiveMargin + row.objectiveMargin, forecastCa: acc.forecastCa + row.forecastCa, planningEstimateCa: acc.planningEstimateCa + row.planningEstimateCa, actualCa: acc.actualCa + row.actualCa, actualMargin: acc.actualMargin + row.actualMargin, previousYearCa: acc.previousYearCa + row.previousYearCa, prime: acc.prime + row.prime }), { objectiveCa: 0, objectiveMargin: 0, forecastCa: 0, planningEstimateCa: 0, actualCa: 0, actualMargin: 0, previousYearCa: 0, prime: 0 }), [rows]);
  const annualClients = useMemo(() => new Set(rows.flatMap((row) => [...row.clients])).size, [rows]);
  const caProgress = annual.objectiveCa > 0 ? Math.round((annual.actualCa / annual.objectiveCa) * 100) : 0;
  const marginProgress = annual.objectiveMargin > 0 ? Math.round((annual.actualMargin / annual.objectiveMargin) * 100) : 0;
  const marginRate = annual.actualCa > 0 ? (annual.actualMargin / annual.actualCa) * 100 : 0;
  const annualEvolution = annual.previousYearCa > 0 ? ((annual.actualCa - annual.previousYearCa) / annual.previousYearCa) * 100 : null;
  const metrics = [
    { label: `Chiffre d’affaires validé ${year}`, value: currency(annual.actualCa), detail: `${annual.objectiveCa > 0 ? `${caProgress}% de ${currency(annual.objectiveCa)}` : "Objectif à définir"}${annualEvolution !== null ? ` · ${annualEvolution >= 0 ? "+" : ""}${annualEvolution.toFixed(1)} % vs N-1` : ""}`, progress: Math.min(100, Math.max(0, caProgress)), icon: Euro },
    { label: `Marge ${year}`, value: currency(annual.actualMargin), detail: annual.objectiveMargin > 0 ? `${marginProgress}% de ${currency(annual.objectiveMargin)}` : "Objectif à définir", progress: Math.min(100, Math.max(0, marginProgress)), icon: Landmark },
    { label: "Taux de marge", value: `${marginRate.toFixed(1)} %`, detail: "Marge réelle / CA réel", progress: null, icon: Percent },
    { label: "Prime calculée", value: currency(annual.prime), detail: "Uniquement sur les marges validées", progress: null, icon: BadgePercent },
    { label: "Clients contributeurs", value: String(annualClients), detail: `Avec un résultat en ${year}`, progress: null, icon: Users },
  ];
  const chartData = rows.map((row, index) => ({ month: MONTHS[index].slice(0, 3), objectif: row.objectiveCa, prevision: row.forecastCa, planning: row.planningEstimateCa, reel: row.actualCa, nMoins1: row.previousYearCa }));

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-semibold text-slate-900">Pilotage financier</h2><p className="mt-1 text-sm text-slate-500">Objectif mensuel global fixé par l’admin, prévisions détaillées par client et réalisé confirmé.</p></div><div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">{isAdmin && <Button variant="outline" onClick={() => void syncAgencyActuals()} disabled={syncing} className="sm:mb-0"><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Synchronisation…" : "Synchroniser les réels agence"}</Button>}<div className="grid w-full gap-3 sm:grid-cols-2 lg:min-w-[420px]">{isAdmin && <div className="space-y-2"><Label htmlFor="reporting-financial-user">Commercial</Label><select id="reporting-financial-user" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={managedUserId} onChange={(event) => setManagedUserId(event.target.value)}><option value="tous">Tous les commerciaux</option>{users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</select></div>}<div className="space-y-2"><Label htmlFor="reporting-year">Année</Label><Input id="reporting-year" type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())} /></div></div></div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => { const Icon = metric.icon; return <Card key={metric.label}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{metric.value}</p></div><div className="rounded-xl bg-[#840404]/10 p-2.5"><Icon className="h-5 w-5 text-[#840404]" /></div></div><p className="mt-2 text-xs text-slate-500">{metric.detail}</p>{metric.progress !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#840404]" style={{ width: `${metric.progress}%` }} /></div>}</CardContent></Card>; })}
      </div>
      <Card><CardContent className="p-5"><div className="mb-4"><h3 className="font-semibold text-slate-900">Progression annuelle du chiffre d’affaires</h3><p className="mt-1 text-sm text-slate-500">Objectif, anticipation commerciale, planning, résultat validé et comparaison avec l’année précédente.</p></div><div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `${Math.round(Number(value) / 1000)} k€`} /><Tooltip formatter={(value) => currency(Number(value))} cursor={{ fill: "#f8fafc" }} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} /><Bar dataKey="objectif" name="Objectif admin" fill="#840404" radius={[3, 3, 0, 0]} /><Bar dataKey="prevision" name="Prévision commerciale" fill="#2563eb" radius={[3, 3, 0, 0]} /><Bar dataKey="planning" name="Estimation planning" fill="#d97706" radius={[3, 3, 0, 0]} /><Bar dataKey="reel" name="Réel validé" fill="#059669" radius={[3, 3, 0, 0]} /><Bar dataKey="nMoins1" name="CA N-1" fill="#94a3b8" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mois</th>
                  <th className="px-4 py-3 text-right">Objectif CA</th>
                  <th className="px-4 py-3 text-right">Prévision clients</th>
                  <th className="px-4 py-3 text-right">Estimation planning</th>
                  <th className="px-4 py-3 text-right">CA validé</th>
                  <th className="px-4 py-3 text-right">CA N-1</th>
                  <th className="px-4 py-3 text-right">Évolution N-1</th>
                  <th className="px-4 py-3 text-right">Marge validée</th>
                  <th className="px-4 py-3 text-right">Taux marge</th>
                  <th className="px-4 py-3 text-right">Atteinte</th>
                  <th className="px-4 py-3 text-right">Prime calculée</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, index) => {
                  const evolution = row.previousYearCa > 0 ? ((row.actualCa - row.previousYearCa) / row.previousYearCa) * 100 : null;
                  return <tr key={row.month} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium">{MONTHS[index]}{row.confirmed && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-700">Validé</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{currency(row.objectiveCa)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{currency(row.forecastCa)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{currency(row.planningEstimateCa)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{currency(row.actualCa)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{currency(row.previousYearCa)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${evolution === null ? "text-slate-400" : evolution >= 0 ? "text-emerald-700" : "text-red-700"}`}>{evolution === null ? "—" : `${evolution >= 0 ? "+" : ""}${evolution.toFixed(1)} %`}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{currency(row.actualMargin)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.actualCa > 0 ? `${((row.actualMargin / row.actualCa) * 100).toFixed(1)} %` : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.objectiveCa > 0 ? `${Math.round((row.actualCa / row.objectiveCa) * 100)} %` : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{currency(row.prime)}</td>
                  </tr>;
                })}
              </tbody>
              <tfoot className="border-t-2 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Total {year}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.objectiveCa)}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.forecastCa)}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.planningEstimateCa)}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.actualCa)}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.previousYearCa)}</td>
                  <td className="px-4 py-3 text-right">{annualEvolution === null ? "—" : `${annualEvolution >= 0 ? "+" : ""}${annualEvolution.toFixed(1)} %`}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.actualMargin)}</td>
                  <td className="px-4 py-3 text-right">{annual.actualCa > 0 ? `${((annual.actualMargin / annual.actualCa) * 100).toFixed(1)} %` : "—"}</td>
                  <td className="px-4 py-3 text-right">{annual.objectiveCa > 0 ? `${Math.round((annual.actualCa / annual.objectiveCa) * 100)} %` : "—"}</td>
                  <td className="px-4 py-3 text-right">{currency(annual.prime)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
