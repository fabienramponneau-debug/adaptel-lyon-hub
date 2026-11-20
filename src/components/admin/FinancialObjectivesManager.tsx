import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FrenchDecimalInput } from "@/components/ui/french-decimal-input";
import { Label } from "@/components/ui/label";

interface UserOption { id: string; label: string }
interface MonthRow {
  month: number;
  objectifCa: number;
  objectifMarge: number;
  previsionCa: number;
  planningEstimateCa: number;
  reelCa: number;
  reelMarge: number;
  confirme: boolean;
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const currency = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const emptyRows = (): MonthRow[] => MONTHS.map((_, index) => ({ month: index + 1, objectifCa: 0, objectifMarge: 0, previsionCa: 0, planningEstimateCa: 0, reelCa: 0, reelMarge: 0, confirme: false }));

export function FinancialObjectivesManager({ users }: { users: UserOption[] }) {
  const [userId, setUserId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<MonthRow[]>(emptyRows);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!userId && users[0]) setUserId(users[0].id); }, [userId, users]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const start = `${year}-01`;
    const end = `${year}-12`;
    const [targets, forecasts, actuals] = await Promise.all([
      supabase.from("objectifs_financiers").select("period_code, objectif_ca, objectif_marge").eq("user_id", userId).gte("period_code", start).lte("period_code", end),
      supabase.from("previsions_clients").select("period_code, chiffre_affaires_previsionnel, chiffre_affaires_estime_planning").eq("user_id", userId).gte("period_code", start).lte("period_code", end),
      supabase.from("performances_clients").select("period_code, chiffre_affaires, marge, statut_cloture").eq("user_id", userId).gte("period_code", start).lte("period_code", end),
    ]);
    if (targets.error || forecasts.error || actuals.error) {
      toast.error("Impossible de charger le suivi financier annuel.");
      setLoading(false);
      return;
    }
    const next = emptyRows();
    for (const item of targets.data ?? []) {
      const row = next[Number(item.period_code.slice(5, 7)) - 1];
      if (row) { row.objectifCa = Number(item.objectif_ca); row.objectifMarge = Number(item.objectif_marge); }
    }
    for (const item of forecasts.data ?? []) {
      const row = next[Number(item.period_code.slice(5, 7)) - 1];
      if (row) { row.previsionCa += Number(item.chiffre_affaires_previsionnel); row.planningEstimateCa += Number(item.chiffre_affaires_estime_planning); }
    }
    for (const item of actuals.data ?? []) {
      const row = next[Number(item.period_code.slice(5, 7)) - 1];
      if (row) { row.reelCa += Number(item.chiffre_affaires); row.reelMarge += Number(item.marge); row.confirme ||= item.statut_cloture === "confirme"; }
    }
    setRows(next);
    setLoading(false);
  }, [userId, year]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    objectifCa: acc.objectifCa + row.objectifCa,
    objectifMarge: acc.objectifMarge + row.objectifMarge,
    previsionCa: acc.previsionCa + row.previsionCa,
    planningEstimateCa: acc.planningEstimateCa + row.planningEstimateCa,
    reelCa: acc.reelCa + row.reelCa,
    reelMarge: acc.reelMarge + row.reelMarge,
  }), { objectifCa: 0, objectifMarge: 0, previsionCa: 0, planningEstimateCa: 0, reelCa: 0, reelMarge: 0 }), [rows]);

  const updateObjective = (index: number, field: "objectifCa" | "objectifMarge", value: number) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: Math.max(0, value) } : row));
  };
  const updateObjectiveCa = (index: number, value: number) => setRows((current) => current.map((row, rowIndex) => {
    if (rowIndex !== index) return row;
    const rate = row.objectifCa > 0 ? row.objectifMarge / row.objectifCa : 0;
    const objectifCa = Math.max(0, value);
    return { ...row, objectifCa, objectifMarge: objectifCa * rate };
  }));
  const updateObjectiveRate = (index: number, value: number) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, objectifMarge: row.objectifCa * Math.max(0, value) / 100 } : row));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const payload = rows.map((row) => ({ user_id: userId, period_code: `${year}-${String(row.month).padStart(2, "0")}`, objectif_ca: row.objectifCa, objectif_marge: row.objectifMarge }));
    const { error } = await supabase.from("objectifs_financiers").upsert(payload, { onConflict: "user_id,period_code" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(`Objectifs ${year} enregistrés.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-[#840404]" />Objectifs financiers annuels</CardTitle>
        <p className="text-sm text-muted-foreground">Fixez les objectifs mois par mois. Les prévisions correspondent toujours à la somme des clients du commercial.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="financial-user">Commercial</Label><select id="financial-user" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={userId} onChange={(event) => setUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="financial-year">Année</Label><Input id="financial-year" type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())} /></div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-3">Mois</th><th className="px-3 py-3">Objectif CA</th><th className="px-3 py-3">Objectif marge</th><th className="px-3 py-3">Taux marge</th><th className="px-3 py-3 text-right">Prévision clients</th><th className="px-3 py-3 text-right">Estimation planning</th><th className="px-3 py-3 text-right">CA réel</th><th className="px-3 py-3 text-right">Marge réelle</th><th className="px-3 py-3">État</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((row, index) => <tr key={row.month} className="hover:bg-slate-50/60"><td className="px-3 py-2 font-medium">{MONTHS[index]}</td><td className="px-3 py-2"><FrenchDecimalInput aria-label={`Objectif CA ${MONTHS[index]}`} min={0} decimals={2} value={row.objectifCa} onValueChange={(value) => updateObjectiveCa(index, value)} disabled={loading} className="h-9 w-32" /></td><td className="px-3 py-2"><FrenchDecimalInput aria-label={`Objectif marge ${MONTHS[index]}`} min={0} decimals={2} value={row.objectifMarge} onValueChange={(value) => updateObjective(index, "objectifMarge", value)} disabled={loading} className="h-9 w-32" /></td><td className="px-3 py-2"><div className="relative w-24"><FrenchDecimalInput aria-label={`Taux de marge objectif ${MONTHS[index]}`} min={0} decimals={2} value={row.objectifCa > 0 ? (row.objectifMarge / row.objectifCa) * 100 : 0} onValueChange={(value) => updateObjectiveRate(index, value)} disabled={loading} className="h-9 pr-7" /><span className="pointer-events-none absolute right-3 top-2 text-slate-400">%</span></div></td><td className="px-3 py-2 text-right tabular-nums">{currency(row.previsionCa)}</td><td className="px-3 py-2 text-right tabular-nums">{currency(row.planningEstimateCa)}</td><td className="px-3 py-2 text-right font-medium tabular-nums">{currency(row.reelCa)}</td><td className="px-3 py-2 text-right tabular-nums">{currency(row.reelMarge)}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs ${row.confirme ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.confirme ? "Validé" : "À valider"}</span></td></tr>)}
            </tbody>
            <tfoot className="border-t-2 bg-slate-50 font-semibold"><tr><td className="px-3 py-3">Total {year}</td><td className="px-3 py-3 tabular-nums">{currency(totals.objectifCa)}</td><td className="px-3 py-3 tabular-nums">{currency(totals.objectifMarge)}</td><td className="px-3 py-3 tabular-nums">{totals.objectifCa > 0 ? `${((totals.objectifMarge / totals.objectifCa) * 100).toFixed(1)} %` : "—"}</td><td className="px-3 py-3 text-right tabular-nums">{currency(totals.previsionCa)}</td><td className="px-3 py-3 text-right tabular-nums">{currency(totals.planningEstimateCa)}</td><td className="px-3 py-3 text-right tabular-nums">{currency(totals.reelCa)}</td><td className="px-3 py-3 text-right tabular-nums">{currency(totals.reelMarge)}</td><td /></tr></tfoot>
          </table>
        </div>
        <div className="flex justify-end"><Button onClick={() => void save()} disabled={!userId || loading || saving}><Save className="mr-2 h-4 w-4" />{saving ? "Enregistrement…" : `Enregistrer ${year}`}</Button></div>
      </CardContent>
    </Card>
  );
}
