/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Car, ChevronRight, Download, FileText, Plus, Receipt, Route, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUserView } from "@/contexts/UserViewContext";
import { expenseReportsService, ExpenseCategory, ExpensePeriod, ExpenseTripLegInput, ExpenseVehicle } from "@/services/expenseReports.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const statusLabels: Record<string, string> = {
  draft: "En préparation",
  submitted: "Transmise pour contrôle",
  correction_required: "Correction demandée",
  validated: "Validée",
  closed: "Intégrée en paie",
};
const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  correction_required: "bg-amber-100 text-amber-800",
  validated: "bg-emerald-100 text-emerald-700",
  closed: "bg-violet-100 text-violet-700",
};
const todayPeriod = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

const parseFrenchNumber = (value: string) => Number(value.replace(/\s/g, "").replace(",", ".")) || 0;

export default function ExpenseReports() {
  const { currentUserId, currentRole, selectedUserId, selectedUserLabel } = useUserView();
  const managedUserId = currentRole === "admin" ? (selectedUserId === "tous" ? null : selectedUserId) : currentUserId;
  const [year, setYear] = useState(new Date().getFullYear());
  const [newPeriodCode, setNewPeriodCode] = useState(todayPeriod);
  const [periods, setPeriods] = useState<ExpensePeriod[]>([]);
  const [period, setPeriod] = useState<ExpensePeriod | null>(null);
  const [details, setDetails] = useState<{ trips: any[]; items: any[]; history: any[]; adjustments: any[] }>({ trips: [], items: [], history: [], adjustments: [] });
  const [vehicles, setVehicles] = useState<ExpenseVehicle[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripOpen, setTripOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const editable = period?.status === "draft" || period?.status === "correction_required";
  const expensesTotal = useMemo(() => details.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0), [details.items]);
  const declaredKm = useMemo(() => details.trips.reduce((sum, trip) => sum + Number(trip.total_km ?? 0), 0), [details.trips]);
  const adjustmentAmount = useMemo(() => details.adjustments.reduce((sum, item) => sum + Number(item.amount_delta ?? 0), 0), [details.adjustments]);
  const adjustmentKilometers = useMemo(() => details.adjustments.reduce((sum, item) => sum + Number(item.kilometers_delta ?? 0), 0), [details.adjustments]);
  const totalReimbursement = expensesTotal + Number(period?.mileage_amount_snapshot ?? 0) + adjustmentAmount;

  const loadBase = useCallback(async () => {
    if (!managedUserId) return;
    setLoading(true);
    try {
      const [periodRows, vehicleRows, categoryRows, establishmentRows] = await Promise.all([
        expenseReportsService.listPeriods(managedUserId, year),
        expenseReportsService.listVehicles(managedUserId),
        expenseReportsService.listCategories(),
        expenseReportsService.listEstablishments(),
      ]);
      setPeriods(periodRows);
      setVehicles(vehicleRows);
      setCategories(categoryRows);
      setEstablishments(establishmentRows);
      setPeriod((current) => periodRows.find((item) => item.id === current?.id) ?? periodRows[0] ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [managedUserId, year]);

  const loadDetails = useCallback(async () => {
    if (!period) {
      setDetails({ trips: [], items: [], history: [], adjustments: [] });
      setAgenda([]);
      return;
    }
    try {
      const [periodDetails, agendaRows] = await Promise.all([
        expenseReportsService.getPeriodDetails(period.id),
        expenseReportsService.listAgenda(period.user_id, period.period_code),
      ]);
      setDetails(periodDetails);
      setAgenda(agendaRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Détail indisponible");
    }
  }, [period]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => { void loadDetails(); }, [loadDetails]);

  const createPeriod = async () => {
    if (!managedUserId) return;
    const code = newPeriodCode;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(code)) return toast.error("Choisis un mois valide.");
    if (periods.some((item) => item.period_code === code)) {
      setPeriod(periods.find((item) => item.period_code === code) ?? null);
      return;
    }
    try {
      const created = await expenseReportsService.createPeriod(managedUserId, code);
      await loadBase();
      setPeriod(created);
      toast.success("Période ouverte");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible");
    }
  };

  const refresh = async () => { await loadBase(); await loadDetails(); };

  const submit = async () => {
    if (!period || !confirm("Transmettre cette période à l'administration ? Elle ne sera plus modifiable pendant le contrôle.")) return;
    try {
      await expenseReportsService.submitPeriod(period.id);
      await refresh();
      toast.success("Période transmise");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Transmission impossible"); }
  };

  const review = async (status: "correction_required" | "validated" | "closed") => {
    if (!period) return;
    const reason = status === "correction_required" ? prompt("Motif précis de la correction demandée :")?.trim() : undefined;
    if (status === "correction_required" && !reason) return;
    const payroll = status === "closed" ? prompt("Référence du traitement en paie :")?.trim() : undefined;
    if (status === "closed" && !payroll) return;
    try {
      await expenseReportsService.reviewPeriod(period.id, status, reason, payroll);
      await refresh();
      toast.success(status === "validated" ? "Période validée" : status === "closed" ? "Période intégrée en paie" : "Correction demandée");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Décision impossible"); }
  };

  const exportCsv = () => {
    if (!period) return;
    const rows = [
      ["Type", "Date", "Libellé", "Kilomètres", "Montant"],
      ...details.trips.map((trip) => ["Déplacement", trip.travel_date, `${trip.start_location} - ${trip.final_destination}`, trip.total_km, ""]),
      ...details.items.map((item) => ["Frais", item.expense_date, `${item.expense_categories?.label ?? "Frais"} - ${item.description}`, "", item.amount]),
      ["TOTAL", period.period_code, "Indemnités kilométriques + frais", period.mileage_km_snapshot, totalReimbursement],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `notes-frais-${period.user_id}-${period.period_code}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!managedUserId) return <div className="p-8 text-slate-500">Sélectionne un commercial pour consulter ses notes de frais.</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#840404]">Gestion commerciale</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Notes de frais</h1>
          <p className="mt-1 text-sm text-slate-500">Déplacements, justificatifs et suivi mensuel de {currentRole === "admin" ? selectedUserLabel : "ton activité"}.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>Année</Label><Input className="w-28" type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())} /></div>
          {periods.length > 0 && <div className="space-y-1"><Label>Mois</Label><Select value={period?.id ?? ""} onValueChange={(id) => setPeriod(periods.find((item) => item.id === id) ?? null)}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.id} value={item.id}>{monthLabel.format(new Date(`${item.period_code}-01T12:00:00`))} · {statusLabels[item.status]}</SelectItem>)}</SelectContent></Select></div>}
          <div className="space-y-1"><Label>Nouveau mois</Label><Input className="w-40" type="month" value={newPeriodCode} onChange={(event) => { setNewPeriodCode(event.target.value); if (event.target.value) setYear(Number(event.target.value.slice(0, 4))); }} /></div>
          <Button onClick={() => void createPeriod()}><Plus className="mr-2 h-4 w-4" />Ouvrir</Button>
        </div>
      </div>

      {loading ? <Card><CardContent className="p-10 text-center text-slate-500">Chargement…</CardContent></Card> : !period ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><Receipt className="h-10 w-10 text-slate-300" /><h2 className="text-lg font-semibold">Aucune période ouverte en {year}</h2><p className="max-w-md text-sm text-slate-500">Ouvre un mois pour commencer à enregistrer les déplacements et les dépenses.</p><Button onClick={() => void createPeriod()}><Plus className="mr-2 h-4 w-4" />Ouvrir une période</Button></CardContent></Card>
      ) : <>
        <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><Badge className={statusStyles[period.status]}>{statusLabels[period.status]}</Badge>{period.correction_reason && <span className="text-sm text-amber-700">Motif : {period.correction_reason}</span>}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exporter</Button>
            {editable && <Button onClick={() => void submit()}><Send className="mr-2 h-4 w-4" />Transmettre</Button>}
            {currentRole === "admin" && period.status === "submitted" && <><Button variant="outline" onClick={() => void review("correction_required")}>Demander une correction</Button><Button onClick={() => void review("validated")}><ShieldCheck className="mr-2 h-4 w-4" />Valider</Button></>}
            {currentRole === "admin" && period.status === "validated" && <Button onClick={() => void review("closed")}><ShieldCheck className="mr-2 h-4 w-4" />Intégrée en paie</Button>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Route} label="Kilométrage déclaré" value={`${number.format(declaredKm + adjustmentKilometers)} km`} detail={`${number.format(period.mileage_km_snapshot + adjustmentKilometers)} km indemnisables${adjustmentKilometers ? " après ajustement" : ""}`} />
          <SummaryCard icon={Car} label="Indemnités kilométriques" value={currency.format(period.mileage_amount_snapshot)} detail="Barème annuel figé à la transmission" />
          <SummaryCard icon={Receipt} label="Frais annexes et repas" value={currency.format(expensesTotal)} detail={`${details.items.length} dépense${details.items.length > 1 ? "s" : ""}`} />
          <SummaryCard icon={FileText} label="Total à rembourser" value={currency.format(totalReimbursement)} detail={statusLabels[period.status]} highlight />
        </div>

        <Tabs defaultValue="trips" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="trips">Déplacements</TabsTrigger><TabsTrigger value="expenses">Frais et repas</TabsTrigger><TabsTrigger value="vehicles">Véhicules</TabsTrigger>{currentRole === "admin" && <TabsTrigger value="rates">Barème IK</TabsTrigger>}<TabsTrigger value="history">Historique</TabsTrigger></TabsList>
          <TabsContent value="trips"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Déplacements du mois</CardTitle><p className="mt-1 text-sm text-slate-500">Plusieurs visites et étapes peuvent être regroupées dans une même journée.</p></div>{editable && <Button onClick={() => setTripOpen(true)}><Plus className="mr-2 h-4 w-4" />Ajouter</Button>}</CardHeader><CardContent className="space-y-3">{details.trips.length === 0 ? <Empty text="Aucun déplacement déclaré." /> : details.trips.map((trip) => <div key={trip.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-semibold">{new Date(`${trip.travel_date}T12:00:00`).toLocaleDateString("fr-FR")}</span><Badge variant="outline">{number.format(trip.total_km)} km</Badge></div><p className="mt-1 text-sm text-slate-700">{trip.start_location} <ChevronRight className="inline h-3 w-3" /> {trip.final_destination}{trip.return_location ? ` → ${trip.return_location}` : ""}</p><p className="text-xs text-slate-500">{trip.purpose.replaceAll("_", " ")}{trip.contact_name ? ` · ${trip.contact_name}` : ""}</p></div>{editable && <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Supprimer ce déplacement ?")) { await expenseReportsService.deleteTrip(trip.id); await loadDetails(); } }}><Trash2 className="h-4 w-4 text-red-600" /></Button>}</div>)}</CardContent></Card></TabsContent>
          <TabsContent value="expenses"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Frais annexes et repas</CardTitle><p className="mt-1 text-sm text-slate-500">Les justificatifs restent privés et accessibles uniquement aux personnes autorisées.</p></div>{editable && <Button onClick={() => setExpenseOpen(true)}><Plus className="mr-2 h-4 w-4" />Ajouter</Button>}</CardHeader><CardContent className="space-y-3">{details.items.length === 0 ? <Empty text="Aucun frais enregistré." /> : details.items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-semibold">{item.expense_categories?.label ?? "Frais"} · {currency.format(item.amount)}</p><p className="text-sm text-slate-600">{item.description}</p><p className="text-xs text-slate-500">{new Date(`${item.expense_date}T12:00:00`).toLocaleDateString("fr-FR")}{item.receipt_name ? ` · Justificatif : ${item.receipt_name}` : " · Sans justificatif"}</p></div><div className="flex gap-1">{item.receipt_path && <Button variant="ghost" size="sm" onClick={async () => window.open(await expenseReportsService.getReceiptUrl(item.receipt_path), "_blank", "noopener,noreferrer")}>Voir</Button>}{editable && <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Supprimer ce frais ?")) { await expenseReportsService.deleteExpense(item.id, item.receipt_path); await loadDetails(); } }}><Trash2 className="h-4 w-4 text-red-600" /></Button>}</div></div>)}</CardContent></Card></TabsContent>
          <TabsContent value="vehicles"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Véhicules et historique</CardTitle><p className="mt-1 text-sm text-slate-500">Aucun véhicule n’est obligatoire. Les locations ne déclenchent jamais d’indemnité kilométrique.</p></div><Button onClick={() => setVehicleOpen(true)}><Plus className="mr-2 h-4 w-4" />Ajouter</Button></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{vehicles.length === 0 ? <Empty text="Aucun véhicule renseigné." /> : vehicles.map((vehicle) => <div key={vehicle.id} className="rounded-xl border p-4"><div className="flex items-start justify-between"><div><p className="font-semibold">{vehicle.label}</p><p className="text-sm text-slate-500">{vehicle.registration || "Sans immatriculation"} · {vehicle.fiscal_power ? `${vehicle.fiscal_power} CV` : "Puissance non renseignée"}</p></div><Badge variant={vehicle.mileage_eligible ? "default" : "secondary"}>{vehicle.mileage_eligible ? "IK actif" : "Sans IK"}</Badge></div><p className="mt-3 text-xs text-slate-500">Depuis le {new Date(`${vehicle.valid_from}T12:00:00`).toLocaleDateString("fr-FR")}{vehicle.valid_to ? ` jusqu’au ${new Date(`${vehicle.valid_to}T12:00:00`).toLocaleDateString("fr-FR")}` : ""}</p></div>)}</CardContent></Card></TabsContent>
          {currentRole === "admin" && <TabsContent value="rates"><MileageRatesManager year={year} /></TabsContent>}
          <TabsContent value="history"><Card><CardHeader><CardTitle>Historique de validation</CardTitle></CardHeader><CardContent className="space-y-3">{details.adjustments.map((entry) => <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-amber-50 p-3"><div className="mt-1 h-2 w-2 rounded-full bg-amber-600" /><div><p className="text-sm font-medium">Ajustement administratif · {entry.amount_delta ? currency.format(entry.amount_delta) : ""}{entry.kilometers_delta ? ` · ${number.format(entry.kilometers_delta)} km` : ""}</p><p className="text-xs text-slate-600">{new Date(entry.created_at).toLocaleString("fr-FR")} · {entry.reason}</p></div></div>)}{details.history.map((entry) => <div key={entry.id} className="flex items-start gap-3 border-b pb-3 last:border-0"><div className="mt-1 h-2 w-2 rounded-full bg-[#840404]" /><div><p className="text-sm font-medium">{entry.from_status ? `${statusLabels[entry.from_status]} → ` : "Création · "}{statusLabels[entry.to_status]}</p><p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString("fr-FR")}{entry.reason ? ` · ${entry.reason}` : ""}</p></div></div>)}</CardContent></Card></TabsContent>
        </Tabs>
      </>}

      {period && <TripDialog open={tripOpen} onOpenChange={setTripOpen} period={period} vehicles={vehicles} agenda={agenda} establishments={establishments} saving={saving} setSaving={setSaving} onSaved={async () => { setTripOpen(false); await loadDetails(); }} />}
      {period && <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} period={period} categories={categories} trips={details.trips} saving={saving} setSaving={setSaving} onSaved={async () => { setExpenseOpen(false); await loadDetails(); }} />}
      <VehicleDialog open={vehicleOpen} onOpenChange={setVehicleOpen} userId={managedUserId} saving={saving} setSaving={setSaving} onSaved={async () => { setVehicleOpen(false); await loadBase(); }} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, highlight = false }: any) { return <Card className={highlight ? "border-[#840404]/30 bg-[#840404]/[0.03]" : ""}><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><Icon className={`h-5 w-5 ${highlight ? "text-[#840404]" : "text-slate-400"}`} /></div><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">{text}</div>; }

function TripDialog({ open, onOpenChange, period, vehicles, agenda, establishments, saving, setSaving, onSaved }: any) {
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("Agence ADAPTEL Lyon");
  const [destination, setDestination] = useState("");
  const [returnLocation, setReturnLocation] = useState("Agence ADAPTEL Lyon");
  const [purpose, setPurpose] = useState("prospection");
  const [vehicleId, setVehicleId] = useState("none");
  const [contact, setContact] = useState("");
  const [comment, setComment] = useState("");
  const [manual, setManual] = useState(false);
  const [manualKm, setManualKm] = useState("");
  const [legs, setLegs] = useState<ExpenseTripLegInput[]>([{ from_location: "Agence ADAPTEL Lyon", to_location: "", kilometers: 0 }]);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const total = manual ? parseFrenchNumber(manualKm) : legs.reduce((sum, leg) => sum + Number(leg.kilometers || 0), 0);
  const save = async () => {
    if (!destination.trim() || !start.trim() || !date || total < 0) return toast.error("Complète le trajet et le kilométrage.");
    setSaving(true);
    try {
      await expenseReportsService.saveTrip({ period_id: period.id, user_id: period.user_id, travel_date: date, start_location: start.trim(), final_destination: destination.trim(), return_location: returnLocation.trim() || null, purpose, vehicle_id: vehicleId === "none" ? null : vehicleId, contact_name: contact.trim() || null, comment: comment.trim() || null, total_km: total, kilometers_manually_adjusted: manual, legs: legs.map((leg) => ({ ...leg, establishment_id: establishments.find((item: any) => `${item.nom}${item.ville ? ` · ${item.ville}` : ""}` === leg.to_location)?.id ?? null })), actionIds });
      toast.success("Déplacement enregistré"); await onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Ajouter un déplacement</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Motif"><Select value={purpose} onValueChange={setPurpose}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="prospection">Prospection</SelectItem><SelectItem value="rendez_vous">Rendez-vous</SelectItem><SelectItem value="suivi_client">Suivi client</SelectItem><SelectItem value="fidelisation">Fidélisation</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></Field><Field label="Départ"><Input value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="Destination finale"><Input value={destination} onChange={(e) => setDestination(e.target.value)} /></Field><Field label="Retour"><Input value={returnLocation} onChange={(e) => setReturnLocation(e.target.value)} /></Field><Field label="Véhicule"><Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucun / transport collectif</SelectItem>{vehicles.map((v: ExpenseVehicle) => <SelectItem key={v.id} value={v.id}>{v.label}{v.mileage_eligible ? " · IK" : ""}</SelectItem>)}</SelectContent></Select></Field><Field label="Contact rencontré"><Input value={contact} onChange={(e) => setContact(e.target.value)} /></Field><Field label="Kilométrage total"><div className="flex gap-2"><Input value={manual ? manualKm : number.format(total)} onChange={(e) => setManualKm(e.target.value)} disabled={!manual} /><Button type="button" variant={manual ? "default" : "outline"} onClick={() => setManual(!manual)}>Manuel</Button></div></Field></div><div className="space-y-3"><div className="flex items-center justify-between"><Label>Étapes</Label><Button size="sm" variant="outline" onClick={() => setLegs([...legs, { from_location: legs.at(-1)?.to_location || "", to_location: "", kilometers: 0 }])}><Plus className="mr-1 h-3 w-3" />Étape</Button></div><datalist id="expense-establishments">{establishments.map((item: any) => <option key={item.id} value={`${item.nom}${item.ville ? ` · ${item.ville}` : ""}`} />)}</datalist>{legs.map((leg, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_120px_40px]"><Input placeholder="Départ" value={leg.from_location} onChange={(e) => setLegs(legs.map((row, i) => i === index ? { ...row, from_location: e.target.value } : row))} /><Input list="expense-establishments" placeholder="Étape / établissement" value={leg.to_location} onChange={(e) => setLegs(legs.map((row, i) => i === index ? { ...row, to_location: e.target.value } : row))} /><Input inputMode="decimal" placeholder="km" value={leg.kilometers || ""} onChange={(e) => setLegs(legs.map((row, i) => i === index ? { ...row, kilometers: parseFrenchNumber(e.target.value) } : row))} /><Button size="icon" variant="ghost" disabled={legs.length === 1} onClick={() => setLegs(legs.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>{agenda.length > 0 && <div className="space-y-2"><Label>Rattacher aux actions de l’agenda</Label><div className="max-h-36 space-y-2 overflow-auto rounded-lg border p-3">{agenda.map((action: any) => <label key={action.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={actionIds.includes(action.id)} onChange={(e) => setActionIds(e.target.checked ? [...actionIds, action.id] : actionIds.filter((id) => id !== action.id))} /><span>{new Date(`${action.date_action}T12:00:00`).toLocaleDateString("fr-FR")} · {action.type} · {action.establishments?.nom}</span></label>)}</div></div>}<Field label="Commentaire"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ExpenseDialog({ open, onOpenChange, period, categories, trips, saving, setSaving, onSaved }: any) {
  const [date, setDate] = useState(today); const [categoryId, setCategoryId] = useState(""); const [amount, setAmount] = useState(""); const [description, setDescription] = useState(""); const [tripId, setTripId] = useState("none"); const [restaurant, setRestaurant] = useState(""); const [reason, setReason] = useState(""); const [guests, setGuests] = useState(""); const [guestCount, setGuestCount] = useState(""); const [receipt, setReceipt] = useState<File | null>(null);
  const category = categories.find((item: ExpenseCategory) => item.id === categoryId);
  const save = async () => { const numericAmount = parseFrenchNumber(amount); if (!categoryId || !description.trim() || numericAmount <= 0) return toast.error("Complète la catégorie, le montant et le descriptif."); if (receipt && (receipt.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(receipt.type))) return toast.error("Justificatif invalide : PDF ou image, 10 Mo maximum."); setSaving(true); try { await expenseReportsService.saveExpense({ period_id: period.id, user_id: period.user_id, trip_id: tripId === "none" ? null : tripId, category_id: categoryId, expense_date: date, amount: numericAmount, description: description.trim(), restaurant_name: category?.is_meal ? restaurant.trim() || null : null, business_reason: category?.is_meal ? reason.trim() || null : null, invited_contacts: category?.is_meal ? guests.split(",").map((value) => value.trim()).filter(Boolean) : [], guest_count: category?.is_meal ? Number(guestCount) || null : null }, receipt); toast.success("Frais enregistré"); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Ajouter un frais professionnel</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Catégorie"><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{categories.map((item: ExpenseCategory) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></Field><Field label="Montant TTC"><Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Déplacement associé"><Select value={tripId} onValueChange={setTripId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{trips.map((trip: any) => <SelectItem key={trip.id} value={trip.id}>{trip.travel_date} · {trip.final_destination}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>{category?.is_meal && <div className="grid gap-4 sm:grid-cols-2"><Field label="Restaurant"><Input value={restaurant} onChange={(e) => setRestaurant(e.target.value)} /></Field><Field label="Nombre de convives"><Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} /></Field><Field label="Motif"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Field label="Contacts invités"><Input placeholder="Séparés par des virgules" value={guests} onChange={(e) => setGuests(e.target.value)} /></Field></div>}<Field label="Justificatif (PDF ou image, 10 Mo max.)"><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} /></Field><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>;
}

function VehicleDialog({ open, onOpenChange, userId, saving, setSaving, onSaved }: any) {
  const [type, setType] = useState("personnel"); const [label, setLabel] = useState(""); const [registration, setRegistration] = useState(""); const [power, setPower] = useState(""); const [holder, setHolder] = useState(""); const [validFrom, setValidFrom] = useState(today); const [validTo, setValidTo] = useState(""); const [eligible, setEligible] = useState(false);
  useEffect(() => { if (type === "location") setEligible(false); }, [type]);
  const save = async () => { if (!label.trim() || !validFrom || (eligible && !power)) return toast.error("Complète le libellé, la période et la puissance fiscale si les IK sont actives."); setSaving(true); try { await expenseReportsService.saveVehicle({ user_id: userId, vehicle_type: type as any, label: label.trim(), registration: registration.trim() || null, fiscal_power: power ? Number(power) : null, holder_name: holder.trim() || null, valid_from: validFrom, valid_to: validTo || null, mileage_eligible: type === "location" ? false : eligible, active: true }); toast.success("Véhicule enregistré"); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Ajouter un véhicule</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Type"><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="personnel">Véhicule personnel</SelectItem><SelectItem value="societe">Véhicule de société</SelectItem><SelectItem value="location">Véhicule de location</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></Field><Field label="Libellé"><Input placeholder="Ex. Peugeot 308" value={label} onChange={(e) => setLabel(e.target.value)} /></Field><Field label="Immatriculation"><Input value={registration} onChange={(e) => setRegistration(e.target.value.toUpperCase())} /></Field><Field label="Puissance fiscale"><Input type="number" min={1} max={20} value={power} onChange={(e) => setPower(e.target.value)} /></Field><Field label="Titulaire / utilisateur"><Input value={holder} onChange={(e) => setHolder(e.target.value)} /></Field><Field label="Début d’utilisation"><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field><Field label="Fin d’utilisation"><Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></Field><label className="flex items-center gap-2 self-end rounded-lg border p-3 text-sm"><input type="checkbox" checked={eligible} disabled={type === "location"} onChange={(e) => setEligible(e.target.checked)} />Éligible aux indemnités kilométriques</label></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>;
}

function MileageRatesManager({ year }: { year: number }) {
  const [rates, setRates] = useState<any[]>([]);
  const [form, setForm] = useState({ fiscal_power_min: "1", fiscal_power_max: "3", distance_from: "0", distance_to: "", rate_per_km: "", fixed_amount: "0", label: "" });
  const load = useCallback(async () => { try { setRates(await expenseReportsService.listMileageRates(year)); } catch (error) { toast.error(error instanceof Error ? error.message : "Barème indisponible"); } }, [year]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => { if (!form.label.trim() || parseFrenchNumber(form.rate_per_km) < 0) return toast.error("Complète le libellé et le taux."); try { await expenseReportsService.saveMileageRate({ year, fiscal_power_min: Number(form.fiscal_power_min), fiscal_power_max: Number(form.fiscal_power_max), distance_from: parseFrenchNumber(form.distance_from), distance_to: form.distance_to ? parseFrenchNumber(form.distance_to) : null, rate_per_km: parseFrenchNumber(form.rate_per_km), fixed_amount: parseFrenchNumber(form.fixed_amount), label: form.label.trim() }); setForm({ fiscal_power_min: "1", fiscal_power_max: "3", distance_from: "0", distance_to: "", rate_per_km: "", fixed_amount: "0", label: "" }); await load(); toast.success("Tranche ajoutée"); } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); } };
  return <Card><CardHeader><CardTitle>Barème kilométrique {year}</CardTitle><p className="text-sm text-slate-500">Saisis les tranches officielles de l’année. Les anciens barèmes sont conservés et les montants sont figés lors de la transmission.</p></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7"><Field label="CV min."><Input type="number" min={1} max={20} value={form.fiscal_power_min} onChange={(e) => setForm({ ...form, fiscal_power_min: e.target.value })} /></Field><Field label="CV max."><Input type="number" min={1} max={20} value={form.fiscal_power_max} onChange={(e) => setForm({ ...form, fiscal_power_max: e.target.value })} /></Field><Field label="Km à partir de"><Input inputMode="decimal" value={form.distance_from} onChange={(e) => setForm({ ...form, distance_from: e.target.value })} /></Field><Field label="Km jusqu’à"><Input inputMode="decimal" placeholder="Sans limite" value={form.distance_to} onChange={(e) => setForm({ ...form, distance_to: e.target.value })} /></Field><Field label="Taux / km"><Input inputMode="decimal" value={form.rate_per_km} onChange={(e) => setForm({ ...form, rate_per_km: e.target.value })} /></Field><Field label="Part fixe"><Input inputMode="decimal" value={form.fixed_amount} onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })} /></Field><Field label="Libellé"><Input placeholder="Ex. 4 CV · 0–5 000 km" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field></div><Button onClick={() => void save()}><Plus className="mr-2 h-4 w-4" />Ajouter la tranche</Button><div className="overflow-hidden rounded-xl border"><div className="grid grid-cols-5 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500"><span>Puissance</span><span>Distance</span><span>Taux</span><span>Part fixe</span><span>Libellé</span></div>{rates.length === 0 ? <div className="p-6 text-center text-sm text-amber-700">Aucun barème configuré : aucune indemnité kilométrique ne sera calculée pour {year}.</div> : rates.map((rate) => <div key={rate.id} className="grid grid-cols-5 border-t px-4 py-3 text-sm"><span>{rate.fiscal_power_min}–{rate.fiscal_power_max} CV</span><span>{number.format(rate.distance_from)}–{rate.distance_to == null ? "∞" : number.format(rate.distance_to)} km</span><span>{number.format(rate.rate_per_km)} €/km</span><span>{currency.format(rate.fixed_amount)}</span><span>{rate.label}</span></div>)}</div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
