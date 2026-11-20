/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type ExpensePeriodStatus = "draft" | "submitted" | "correction_required" | "validated" | "closed";

export interface ExpensePeriod {
  id: string;
  user_id: string;
  period_code: string;
  status: ExpensePeriodStatus;
  mileage_km_snapshot: number;
  mileage_amount_snapshot: number;
  correction_reason: string | null;
  payroll_reference: string | null;
  submitted_at: string | null;
  validated_at: string | null;
  closed_at: string | null;
}

export interface ExpenseVehicle {
  id: string;
  user_id: string;
  vehicle_type: "personnel" | "societe" | "location" | "autre";
  label: string;
  registration: string | null;
  fiscal_power: number | null;
  holder_name: string | null;
  valid_from: string;
  valid_to: string | null;
  mileage_eligible: boolean;
  active: boolean;
}

export interface ExpenseCategory {
  id: string;
  code: string;
  label: string;
  is_meal: boolean;
}

export interface ExpenseTripLegInput {
  from_location: string;
  to_location: string;
  kilometers: number;
  establishment_id?: string | null;
  contact_id?: string | null;
}

export interface ExpenseTripInput {
  id?: string;
  period_id: string;
  user_id: string;
  travel_date: string;
  start_location: string;
  final_destination: string;
  return_location?: string | null;
  purpose: string;
  vehicle_id?: string | null;
  contact_name?: string | null;
  comment?: string | null;
  total_km: number;
  kilometers_manually_adjusted: boolean;
  legs: ExpenseTripLegInput[];
  actionIds: string[];
}

export interface ExpenseItemInput {
  id?: string;
  period_id: string;
  user_id: string;
  trip_id?: string | null;
  category_id: string;
  expense_date: string;
  amount: number;
  description: string;
  restaurant_name?: string | null;
  business_reason?: string | null;
  invited_contacts?: string[];
  guest_count?: number | null;
}

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export const expenseReportsService = {
  async listPeriods(userId: string, year: number) {
    const { data, error } = await db
      .from("expense_periods")
      .select("*")
      .eq("user_id", userId)
      .gte("period_code", `${year}-01`)
      .lte("period_code", `${year}-12`)
      .order("period_code", { ascending: false });
    throwIfError(error);
    return (data ?? []) as ExpensePeriod[];
  },

  async createPeriod(userId: string, periodCode: string) {
    const { data, error } = await db
      .from("expense_periods")
      .insert({ user_id: userId, period_code: periodCode })
      .select("*")
      .single();
    throwIfError(error);
    return data as ExpensePeriod;
  },

  async getPeriodDetails(periodId: string) {
    const [tripsResult, itemsResult, historyResult, adjustmentsResult] = await Promise.all([
      db.from("expense_trips").select("*, expense_trip_legs(*), expense_trip_actions(action_id)").eq("period_id", periodId).order("travel_date"),
      db.from("expense_items").select("*, expense_categories(id, code, label, is_meal)").eq("period_id", periodId).order("expense_date"),
      db.from("expense_period_history").select("*").eq("period_id", periodId).order("created_at", { ascending: false }),
      db.from("expense_adjustments").select("*").eq("period_id", periodId).order("created_at", { ascending: false }),
    ]);
    throwIfError(tripsResult.error);
    throwIfError(itemsResult.error);
    throwIfError(historyResult.error);
    throwIfError(adjustmentsResult.error);
    return { trips: tripsResult.data ?? [], items: itemsResult.data ?? [], history: historyResult.data ?? [], adjustments: adjustmentsResult.data ?? [] };
  },

  async listVehicles(userId: string) {
    const { data, error } = await db.from("expense_vehicles").select("*").eq("user_id", userId).order("valid_from", { ascending: false });
    throwIfError(error);
    return (data ?? []) as ExpenseVehicle[];
  },

  async saveVehicle(vehicle: Partial<ExpenseVehicle> & Pick<ExpenseVehicle, "user_id" | "vehicle_type" | "label" | "valid_from">) {
    const payload = { ...vehicle };
    const query = vehicle.id
      ? db.from("expense_vehicles").update(payload).eq("id", vehicle.id)
      : db.from("expense_vehicles").insert(payload);
    const { error } = await query;
    throwIfError(error);
  },

  async listCategories() {
    const { data, error } = await db.from("expense_categories").select("id, code, label, is_meal").eq("active", true).order("sort_order");
    throwIfError(error);
    return (data ?? []) as ExpenseCategory[];
  },

  async listAgenda(userId: string, periodCode: string) {
    const [year, month] = periodCode.split("-").map(Number);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const { data, error } = await db
      .from("actions")
      .select("id, date_action, type, statut_action, commentaire, establishments(id, nom, ville)")
      .eq("user_id", userId)
      .gte("date_action", `${periodCode}-01`)
      .lte("date_action", end)
      .order("date_action");
    throwIfError(error);
    return data ?? [];
  },

  async listEstablishments() {
    const { data, error } = await db.from("establishments").select("id, nom, ville").eq("actif", true).order("nom").range(0, 1999);
    throwIfError(error);
    return data ?? [];
  },

  async saveTrip(input: ExpenseTripInput) {
    const { legs, actionIds, id, ...trip } = input;
    let tripId = id;
    if (tripId) {
      const { error } = await db.from("expense_trips").update(trip).eq("id", tripId);
      throwIfError(error);
      const [legsDelete, actionsDelete] = await Promise.all([
        db.from("expense_trip_legs").delete().eq("trip_id", tripId),
        db.from("expense_trip_actions").delete().eq("trip_id", tripId),
      ]);
      throwIfError(legsDelete.error);
      throwIfError(actionsDelete.error);
    } else {
      const { data, error } = await db.from("expense_trips").insert(trip).select("id").single();
      throwIfError(error);
      tripId = data.id;
    }
    if (legs.length) {
      const { error } = await db.from("expense_trip_legs").insert(legs.map((leg, index) => ({ ...leg, trip_id: tripId, sequence_number: index + 1 })));
      throwIfError(error);
    }
    if (actionIds.length) {
      const { error } = await db.from("expense_trip_actions").insert(actionIds.map((actionId) => ({ trip_id: tripId, action_id: actionId })));
      throwIfError(error);
    }
    return tripId as string;
  },

  async deleteTrip(id: string) {
    const { error } = await db.from("expense_trips").delete().eq("id", id);
    throwIfError(error);
  },

  async saveExpense(input: ExpenseItemInput, receipt?: File | null) {
    const { id, ...payload } = input;
    let itemId = id;
    if (itemId) {
      const { error } = await db.from("expense_items").update(payload).eq("id", itemId);
      throwIfError(error);
    } else {
      const { data, error } = await db.from("expense_items").insert(payload).select("id").single();
      throwIfError(error);
      itemId = data.id;
    }
    if (receipt && itemId) {
      const extension = receipt.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${input.user_id}/${input.period_id}/${itemId}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("expense-receipts").upload(path, receipt, { upsert: false, contentType: receipt.type });
      throwIfError(uploadError);
      const { error: updateError } = await db.from("expense_items").update({
        receipt_path: path,
        receipt_name: receipt.name,
        receipt_mime_type: receipt.type,
        receipt_size_bytes: receipt.size,
      }).eq("id", itemId);
      throwIfError(updateError);
    }
  },

  async deleteExpense(id: string, receiptPath?: string | null) {
    if (receiptPath) await supabase.storage.from("expense-receipts").remove([receiptPath]);
    const { error } = await db.from("expense_items").delete().eq("id", id);
    throwIfError(error);
  },

  async getReceiptUrl(path: string) {
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 300);
    throwIfError(error);
    return data!.signedUrl;
  },

  async submitPeriod(periodId: string) {
    const { error } = await db.from("expense_periods").update({ status: "submitted" }).eq("id", periodId);
    throwIfError(error);
  },

  async reviewPeriod(periodId: string, status: "correction_required" | "validated" | "closed", reason?: string, payrollReference?: string) {
    const payload: Record<string, unknown> = { status };
    if (reason) payload.correction_reason = reason;
    if (payrollReference) payload.payroll_reference = payrollReference;
    const { error } = await db.from("expense_periods").update(payload).eq("id", periodId);
    throwIfError(error);
  },

  async listMileageRates(year: number) {
    const { data, error } = await db.from("mileage_rate_brackets").select("*").eq("year", year).order("fiscal_power_min").order("distance_from");
    throwIfError(error);
    return data ?? [];
  },

  async saveMileageRate(rate: Record<string, unknown>) {
    const { id, ...payload } = rate;
    const query = id ? db.from("mileage_rate_brackets").update(payload).eq("id", id) : db.from("mileage_rate_brackets").insert(payload);
    const { error } = await query;
    throwIfError(error);
  },
};
