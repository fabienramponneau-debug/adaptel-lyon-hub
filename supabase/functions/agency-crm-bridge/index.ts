// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
const clean = (value: unknown) => String(value ?? "").trim();
const validPeriod = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const nextPeriodStart = (periodCode: string) => {
  const [year, month] = periodCode.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
};
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const commissionRate = (periodCode: string, triggeredAt: string | null | undefined) => {
  if (!triggeredAt) return 0;
  const [periodYear, periodMonth] = periodCode.split("-").map(Number);
  const triggered = new Date(triggeredAt);
  const elapsedMonths = (periodYear - triggered.getUTCFullYear()) * 12 + (periodMonth - (triggered.getUTCMonth() + 1));
  if (elapsedMonths < 0) return 0;
  if (elapsedMonths < 12) return 0.07;
  if (elapsedMonths < 24) return 0.04;
  return 0.03;
};
const secureEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const expectedSecret = Deno.env.get("CRM_AGENCY_SYNC_SECRET");
  const providedSecret = request.headers.get("x-adaptel-sync-secret") ?? "";
  if (!url || !serviceKey || !expectedSecret) return json({ error: "Pont agence non configuré." }, 503);
  if (!providedSecret || !secureEqual(providedSecret, expectedSecret)) return json({ error: "Accès refusé." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let journalId: string | null = null;
  const respond = async (payload: unknown, status = 200) => {
    if (journalId) {
      await admin
        .from("agency_bridge_journal")
        .update({
          status: status >= 400 ? "error" : "success",
          response_status: status,
          response_body: payload,
          error_message: status >= 400 ? clean(payload?.error) || null : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", journalId);
    }
    return json(payload, status);
  };

  try {
    const body = await request.json();
    const operation = clean(body?.operation);
    const requestId = clean(body?.requestId);
    const actorAgencyUserId = clean(body?.actor?.agencyUserId);
    const actorName = [clean(body?.actor?.prenom), clean(body?.actor?.nom)].filter(Boolean).join(" ") || null;
    if (!validUuid(requestId) || !validUuid(actorAgencyUserId)) {
      return json({ error: "requestId et acteur agence valides obligatoires." }, 400);
    }

    const { data: journal, error: journalError } = await admin
      .from("agency_bridge_journal")
      .insert({
        request_id: requestId,
        direction: "agence_vers_crm",
        operation,
        actor_agency_user_id: actorAgencyUserId,
        actor_name: actorName,
      })
      .select("id")
      .single();

    if (journalError) {
      const { data: previous } = await admin
        .from("agency_bridge_journal")
        .select("id, status, response_status, response_body, started_at")
        .eq("request_id", requestId)
        .eq("direction", "agence_vers_crm")
        .maybeSingle();
      if (previous?.status !== "processing" && previous?.response_body) {
        return json(previous.response_body, previous.response_status ?? 200);
      }
      const processingSince = previous?.started_at ? new Date(previous.started_at).getTime() : Date.now();
      if (!previous?.id || Date.now() - processingSince < 5 * 60 * 1000) {
        return json({ error: "Cette requête est déjà en cours de traitement." }, 409);
      }
      // Un worker interrompu ne doit pas bloquer définitivement un requestId.
      journalId = previous.id;
      await admin.from("agency_bridge_journal").update({
        status: "processing",
        response_status: null,
        response_body: null,
        error_message: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        actor_agency_user_id: actorAgencyUserId,
        actor_name: actorName,
      }).eq("id", journalId);
    } else {
      journalId = journal.id;
    }

    if (operation === "link_client") {
      const establishmentId = clean(body?.establishmentId);
      const agencyClientId = clean(body?.agencyClientId);
      const erpClientCode = clean(body?.erpClientCode);
      const linkMode = clean(body?.linkMode);
      const siret = clean(body?.siret) || null;
      if (!establishmentId || !agencyClientId || !erpClientCode) return await respond({ error: "Fiche CRM, identifiant agence et matricule ERP obligatoires." }, 400);
      if (!['new_business', 'historical_match'].includes(linkMode)) return await respond({ error: "Le type de liaison doit être précisé." }, 400);

      const { data: establishment, error: establishmentError } = await admin
        .from("establishments")
        .select("id, nom, statut, commercial_id, client_triggered_by, client_triggered_at, agency_client_id, erp_client_code")
        .eq("id", establishmentId)
        .single();
      if (establishmentError || !establishment) return await respond({ error: "Fiche CRM introuvable." }, 404);
      if (establishment.agency_client_id && establishment.agency_client_id !== agencyClientId) return await respond({ error: "Cette fiche CRM est déjà liée à un autre client agence." }, 409);
      if (establishment.erp_client_code && establishment.erp_client_code !== erpClientCode) return await respond({ error: "Cette fiche CRM possède déjà un autre matricule ERP." }, 409);

      const [{ data: agencyConflict }, { data: erpConflict }] = await Promise.all([
        admin.from("establishments").select("id, nom").eq("agency_client_id", agencyClientId).neq("id", establishmentId).maybeSingle(),
        admin.from("establishments").select("id, nom").eq("erp_client_code", erpClientCode).neq("id", establishmentId).maybeSingle(),
      ]);
      if (agencyConflict || erpConflict) return await respond({ error: "Ce client agence ou ce matricule ERP est déjà relié à une autre fiche CRM." }, 409);

      const isNewBusiness = linkMode === "new_business";
      const triggeredBy = isNewBusiness
        ? (establishment.client_triggered_by ?? establishment.commercial_id)
        : establishment.client_triggered_by;
      const triggeredAt = isNewBusiness && triggeredBy
        ? (establishment.client_triggered_at ?? new Date().toISOString().slice(0, 10))
        : establishment.client_triggered_at;
      const { data, error } = await admin
        .from("establishments")
        .update({
          statut: "client",
          agency_client_id: agencyClientId,
          erp_client_code: erpClientCode,
          siret,
          client_triggered_by: triggeredBy,
          client_triggered_at: triggeredAt,
        })
        .eq("id", establishmentId)
        .select("id, nom, agency_client_id, erp_client_code, siret, client_triggered_by, client_triggered_at")
        .single();
      if (error) return await respond({ error: error.message }, 400);
      return await respond({ client: data });
    }

    if (operation === "list_linkable_crm_prospects") {
      const search = clean(body?.search);
      let query = admin
        .from("establishments")
        .select("id, nom, adresse, code_postal, ville, siret, commercial_id, created_at")
        .in("statut", ["prospect", "ancien_client"])
        .eq("actif", true)
        .is("agency_client_id", null)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (search) query = query.ilike("nom", `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return await respond({ prospects: data ?? [] });
    }

    if (operation === "list_linked_clients") {
      const agencyClientId = clean(body?.agencyClientId);
      let query = admin
        .from("establishments")
        .select("id, nom, statut, agency_client_id, erp_client_code, commercial_id, client_triggered_by, client_triggered_at")
        .not("agency_client_id", "is", null);
      if (agencyClientId) query = query.eq("agency_client_id", agencyClientId);
      const { data, error } = await query.order("nom");
      if (error) throw error;
      return await respond({ clients: data ?? [] });
    }

    if (operation === "list_unlinked_clients") {
      const { data, error } = await admin.from("establishments").select("id, nom, siret, erp_client_code, commercial_id, client_triggered_by").eq("statut", "client").is("agency_client_id", null).order("nom");
      if (error) throw error;
      return await respond({ clients: data ?? [] });
    }

    if (operation === "sync_planning_estimates") {
      const items = Array.isArray(body?.items) ? body.items : [body];
      if (items.length === 0 || items.length > 500) return await respond({ error: "Lot vide ou trop volumineux." }, 400);
      const results = [];
      for (const item of items) {
        const agencyClientId = clean(item?.agencyClientId);
        const periodCode = clean(item?.periodCode);
        const revenue = numberOrNull(item?.estimatedRevenue);
        const margin = item?.estimatedMargin == null ? null : numberOrNull(item.estimatedMargin);
        if (!agencyClientId || !validPeriod(periodCode) || revenue === null || revenue < 0 || (item?.estimatedMargin != null && margin === null)) {
          results.push({ agencyClientId, ok: false, error: "Données invalides." });
          continue;
        }
        const { data: establishment, error: clientError } = await admin.from("establishments").select("id, commercial_id, client_triggered_by").eq("agency_client_id", agencyClientId).maybeSingle();
        // Les estimations du planning appartiennent au commercial qui a
        // réellement déclenché le client, pas à son simple responsable actuel.
        const userId = establishment?.client_triggered_by;
        if (clientError || !establishment || !userId) {
          results.push({ agencyClientId, ok: false, error: "Client non rapproché ou sans commercial." });
          continue;
        }
        const planningValues = { user_id: userId, etablissement_id: establishment.id, period_code: periodCode, chiffre_affaires_estime_planning: revenue, planning_synced_at: new Date().toISOString() };
        if (margin !== null) planningValues.marge_estimee_planning = margin;
        const { error } = await admin.from("previsions_clients").upsert(planningValues, { onConflict: "user_id,etablissement_id,period_code" });
        results.push({ agencyClientId, ok: !error, error: error?.message });
      }
      return await respond({ results, successCount: results.filter((item) => item.ok).length });
    }

    if (operation === "set_crm_objectives") {
      const userId = clean(body?.userId);
      const periodCode = clean(body?.periodCode);
      const revenue = numberOrNull(body?.objectiveRevenue);
      const margin = numberOrNull(body?.objectiveMargin);
      if (!userId || !validPeriod(periodCode) || revenue === null || revenue < 0 || margin === null || margin < 0) return await respond({ error: "Objectifs invalides." }, 400);
      const { error } = await admin.from("objectifs_financiers").upsert({ user_id: userId, period_code: periodCode, objectif_ca: revenue, objectif_marge: margin }, { onConflict: "user_id,period_code" });
      if (error) throw error;
      if (body?.activityObjectives && typeof body.activityObjectives === "object") {
        const activityTypes = ["visite", "rdv", "phoning", "mailing"];
        const activityRows = activityTypes.map((actionType) => ({
          user_id: userId,
          action_type: actionType,
          objectif: numberOrNull(body.activityObjectives[actionType]),
          period_type: "mois",
          period_code: periodCode,
        }));
        if (activityRows.some((row) => row.objectif === null || row.objectif < 0)) return await respond({ error: "Objectifs d'activité invalides." }, 400);
        const { error: deleteError } = await admin.from("objectifs_actions").delete().eq("user_id", userId).eq("period_type", "mois").eq("period_code", periodCode);
        if (deleteError) throw deleteError;
        const { error: insertError } = await admin.from("objectifs_actions").insert(activityRows);
        if (insertError) throw insertError;
      }
      return await respond({ ok: true });
    }

    if (operation === "get_crm_dashboard") {
      const userId = clean(body?.userId);
      const periodCode = clean(body?.periodCode);
      if (!validPeriod(periodCode)) return await respond({ error: "Mois obligatoire." }, 400);
      const startDate = `${periodCode}-01`;
      const endDate = nextPeriodStart(periodCode);
      let targetsQuery = admin.from("objectifs_financiers").select("objectif_ca, objectif_marge").eq("period_code", periodCode);
      let forecastsQuery = admin.from("previsions_clients").select("chiffre_affaires_previsionnel, marge_previsionnelle, chiffre_affaires_estime_planning, marge_estimee_planning").eq("period_code", periodCode);
      let actualsQuery = admin.from("performances_clients").select("chiffre_affaires, marge, statut_cloture").eq("period_code", periodCode);
      let actionsQuery = admin.from("actions").select("type").eq("statut_action", "effectue").gte("date_action", startDate).lt("date_action", endDate);
      let activityTargetsQuery = admin.from("objectifs_actions").select("action_type, objectif").eq("period_type", "mois").eq("period_code", periodCode);
      let prospectsQuery = admin.from("establishments").select("id", { count: "exact", head: true }).eq("statut", "prospect").gte("created_at", startDate).lt("created_at", endDate);
      let clientsQuery = admin.from("establishments").select("id", { count: "exact", head: true }).eq("statut", "client").gte("client_triggered_at", startDate).lt("client_triggered_at", endDate);
      if (userId && userId !== "tous") {
        targetsQuery = targetsQuery.eq("user_id", userId);
        forecastsQuery = forecastsQuery.eq("user_id", userId);
        actualsQuery = actualsQuery.eq("user_id", userId);
        actionsQuery = actionsQuery.eq("user_id", userId);
        activityTargetsQuery = activityTargetsQuery.eq("user_id", userId);
        prospectsQuery = prospectsQuery.eq("commercial_id", userId);
        clientsQuery = clientsQuery.eq("client_triggered_by", userId);
      }
      const [targets, forecasts, actuals, actions, activityTargets, prospects, clients] = await Promise.all([
        targetsQuery,
        forecastsQuery,
        actualsQuery,
        actionsQuery,
        activityTargetsQuery,
        prospectsQuery,
        clientsQuery,
      ]);
      for (const result of [targets, forecasts, actuals, actions, activityTargets, prospects, clients]) if (result.error) throw result.error;
      const sum = (rows: unknown[], key: string) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
      const forecastRows = forecasts.data ?? [];
      const actualRows = actuals.data ?? [];
      const confirmedActualRows = actualRows.filter((row) => row.statut_cloture === "confirme");
      const actionCounts = { phoning: 0, mailing: 0, visite: 0, rdv: 0 };
      for (const action of actions.data ?? []) if (action.type in actionCounts) actionCounts[action.type] += 1;
      const actionObjectives = { phoning: 0, mailing: 0, visite: 0, rdv: 0 };
      for (const objective of activityTargets.data ?? []) if (objective.action_type in actionObjectives) actionObjectives[objective.action_type] += Number(objective.objectif ?? 0);
      const actualRevenue = sum(confirmedActualRows, "chiffre_affaires");
      const actualMargin = sum(confirmedActualRows, "marge");
      return await respond({
        periodCode,
        scope: userId && userId !== "tous" ? { userId } : { allCommercials: true },
        objectives: { revenue: sum(targets.data ?? [], "objectif_ca"), margin: sum(targets.data ?? [], "objectif_marge"), activity: actionObjectives },
        commercialForecast: { revenue: sum(forecastRows, "chiffre_affaires_previsionnel"), margin: sum(forecastRows, "marge_previsionnelle") },
        planningEstimate: { revenue: sum(forecastRows, "chiffre_affaires_estime_planning"), margin: null },
        actuals: { revenue: actualRevenue, margin: actualMargin, marginRate: actualRevenue > 0 ? actualMargin / actualRevenue : 0, confirmed: actualRows.length > 0 && actualRows.every((row) => row.statut_cloture === "confirme") },
        activity: actionCounts,
        acquisition: { newProspects: prospects.count ?? 0, newClients: clients.count ?? 0 },
      });
    }

    if (operation === "list_crm_portfolio") {
      const userId = clean(body?.userId);
      let establishmentsQuery = admin
        .from("establishments")
        .select("id, nom, statut, ville, siret, erp_client_code, agency_client_id, commercial_id, client_triggered_by, client_triggered_at")
        .eq("actif", true)
        .order("nom")
        .range(0, 4999);
      if (userId && userId !== "tous") {
        if (!validUuid(userId)) return await respond({ error: "Commercial invalide." }, 400);
        establishmentsQuery = establishmentsQuery.or(`commercial_id.eq.${userId},client_triggered_by.eq.${userId}`);
      }
      const { data: establishments, error: establishmentsError } = await establishmentsQuery;
      if (establishmentsError) throw establishmentsError;
      const establishmentIds = (establishments ?? []).map((item) => item.id);
      const lastActionByEstablishment = new Map<string, string>();
      for (let offset = 0; offset < establishmentIds.length; offset += 500) {
        const ids = establishmentIds.slice(offset, offset + 500);
        if (ids.length === 0) continue;
        const { data: actions, error: actionsError } = await admin
          .from("actions")
          .select("etablissement_id, date_action")
          .in("etablissement_id", ids)
          .order("date_action", { ascending: false })
          .range(0, 4999);
        if (actionsError) throw actionsError;
        for (const action of actions ?? []) {
          if (!lastActionByEstablishment.has(action.etablissement_id)) lastActionByEstablishment.set(action.etablissement_id, action.date_action);
        }
      }
      return await respond({
        establishments: (establishments ?? []).map((item) => ({
          ...item,
          last_action_date: lastActionByEstablishment.get(item.id) ?? null,
        })),
      });
    }

    if (operation === "get_crm_annual_report") {
      const userId = clean(body?.userId);
      const year = Number(body?.year);
      if (!Number.isInteger(year) || year < 2020 || year > 2100) return await respond({ error: "Année invalide." }, 400);
      if (userId && userId !== "tous" && !validUuid(userId)) return await respond({ error: "Commercial invalide." }, 400);
      const start = `${year}-01`;
      const end = `${year}-12`;
      const previousStart = `${year - 1}-01`;
      const previousEnd = `${year - 1}-12`;
      let targetsQuery = admin.from("objectifs_financiers").select("period_code, objectif_ca, objectif_marge").gte("period_code", start).lte("period_code", end).range(0, 4999);
      let forecastsQuery = admin.from("previsions_clients").select("period_code, chiffre_affaires_previsionnel, chiffre_affaires_estime_planning").gte("period_code", start).lte("period_code", end).range(0, 4999);
      let currentActualsQuery = admin.from("performances_clients").select("period_code, etablissement_id, chiffre_affaires, marge, statut_cloture").gte("period_code", start).lte("period_code", end).range(0, 4999);
      let previousActualsQuery = admin.from("performances_clients").select("period_code, chiffre_affaires").gte("period_code", previousStart).lte("period_code", previousEnd).eq("statut_cloture", "confirme").range(0, 4999);
      if (userId && userId !== "tous") {
        targetsQuery = targetsQuery.eq("user_id", userId);
        forecastsQuery = forecastsQuery.eq("user_id", userId);
        currentActualsQuery = currentActualsQuery.eq("user_id", userId);
        previousActualsQuery = previousActualsQuery.eq("user_id", userId);
      }
      const [targets, forecasts, currentActuals, previousActuals] = await Promise.all([targetsQuery, forecastsQuery, currentActualsQuery, previousActualsQuery]);
      for (const result of [targets, forecasts, currentActuals, previousActuals]) if (result.error) throw result.error;

      const establishmentIds = [...new Set((currentActuals.data ?? []).map((row) => row.etablissement_id))];
      const triggeredAtByEstablishment = new Map<string, string | null>();
      for (let offset = 0; offset < establishmentIds.length; offset += 500) {
        const ids = establishmentIds.slice(offset, offset + 500);
        if (ids.length === 0) continue;
        const { data: establishments, error } = await admin.from("establishments").select("id, client_triggered_at").in("id", ids);
        if (error) throw error;
        for (const establishment of establishments ?? []) triggeredAtByEstablishment.set(establishment.id, establishment.client_triggered_at);
      }

      const sumByPeriod = (rows: unknown[], periodCode: string, key: string) => rows
        .filter((row) => row.period_code === periodCode)
        .reduce((total, row) => total + Number(row[key] ?? 0), 0);
      const months = Array.from({ length: 12 }, (_, index) => {
        const month = String(index + 1).padStart(2, "0");
        const periodCode = `${year}-${month}`;
        const previousPeriodCode = `${year - 1}-${month}`;
        const allActualRows = (currentActuals.data ?? []).filter((row) => row.period_code === periodCode);
        const confirmedRows = allActualRows.filter((row) => row.statut_cloture === "confirme");
        const actualRevenue = confirmedRows.reduce((total, row) => total + Number(row.chiffre_affaires ?? 0), 0);
        const actualMargin = confirmedRows.reduce((total, row) => total + Number(row.marge ?? 0), 0);
        const commission = confirmedRows.reduce((total, row) => {
          const rate = commissionRate(periodCode, triggeredAtByEstablishment.get(row.etablissement_id));
          return total + Math.max(0, Number(row.marge ?? 0)) * rate;
        }, 0);
        return {
          periodCode,
          objectiveRevenue: sumByPeriod(targets.data ?? [], periodCode, "objectif_ca"),
          objectiveMargin: sumByPeriod(targets.data ?? [], periodCode, "objectif_marge"),
          forecastRevenue: sumByPeriod(forecasts.data ?? [], periodCode, "chiffre_affaires_previsionnel"),
          planningRevenue: sumByPeriod(forecasts.data ?? [], periodCode, "chiffre_affaires_estime_planning"),
          actualRevenue,
          actualMargin,
          confirmed: allActualRows.length > 0 && allActualRows.every((row) => row.statut_cloture === "confirme"),
          previousYearRevenue: sumByPeriod(previousActuals.data ?? [], previousPeriodCode, "chiffre_affaires"),
          commission,
        };
      });
      return await respond({ months });
    }

    if (operation === "list_crm_agenda") {
      const userId = clean(body?.userId);
      const from = clean(body?.from);
      const to = clean(body?.to);
      if (!validDate(from) || !validDate(to) || from > to) return await respond({ error: "Période invalide." }, 400);
      if (userId && userId !== "tous" && !validUuid(userId)) return await respond({ error: "Commercial invalide." }, 400);
      let actionsQuery = admin
        .from("actions")
        .select("id, date_action, type, statut_action, etablissement_id, user_id")
        .gte("date_action", from)
        .lte("date_action", to)
        .order("date_action")
        .range(0, 4999);
      if (userId && userId !== "tous") actionsQuery = actionsQuery.eq("user_id", userId);
      const { data: actions, error: actionsError } = await actionsQuery;
      if (actionsError) throw actionsError;
      const establishmentIds = [...new Set((actions ?? []).map((item) => item.etablissement_id))];
      const profileIds = [...new Set((actions ?? []).map((item) => item.user_id))];
      const [{ data: establishments, error: establishmentsError }, { data: profiles, error: profilesError }] = await Promise.all([
        establishmentIds.length ? admin.from("establishments").select("id, nom").in("id", establishmentIds) : Promise.resolve({ data: [], error: null }),
        profileIds.length ? admin.from("profiles").select("id, prenom, nom").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (establishmentsError || profilesError) throw establishmentsError ?? profilesError;
      const establishmentById = new Map((establishments ?? []).map((item) => [item.id, item.nom]));
      const profileById = new Map((profiles ?? []).map((item) => [item.id, [item.prenom, item.nom].filter(Boolean).join(" ")]));
      return await respond({
        events: (actions ?? []).map((item) => ({
          id: item.id,
          date: item.date_action,
          type: item.type,
          statut: item.statut_action,
          etablissement: establishmentById.get(item.etablissement_id) ?? null,
          commercialId: item.user_id,
          commercialNom: profileById.get(item.user_id) ?? null,
        })),
      });
    }

    if (operation === "get_crm_objectives_history") {
      const userId = clean(body?.userId);
      const year = Number(body?.year);
      if (!validUuid(userId) || !Number.isInteger(year) || year < 2020 || year > 2100) return await respond({ error: "Commercial ou année invalide." }, 400);
      const { data: history, error: historyError } = await admin
        .from("financial_change_history")
        .select("period_code, before_data, after_data, changed_by, changed_at")
        .eq("record_type", "objectif_financier")
        .eq("user_id", userId)
        .gte("period_code", `${year}-01`)
        .lte("period_code", `${year}-12`)
        .order("changed_at", { ascending: false })
        .range(0, 4999);
      if (historyError) throw historyError;
      const authorIds = [...new Set((history ?? []).map((item) => item.changed_by).filter(Boolean))];
      const { data: profiles, error: profilesError } = authorIds.length
        ? await admin.from("profiles").select("id, prenom, nom").in("id", authorIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const authorById = new Map((profiles ?? []).map((item) => [item.id, [item.prenom, item.nom].filter(Boolean).join(" ")]));
      const fields = [
        { key: "objectif_ca", label: "Objectif CA" },
        { key: "objectif_marge", label: "Objectif marge" },
      ];
      const changes = [];
      for (const item of history ?? []) {
        for (const field of fields) {
          const before = item.before_data?.[field.key] == null ? null : Number(item.before_data[field.key]);
          const after = item.after_data?.[field.key] == null ? null : Number(item.after_data[field.key]);
          if (before === after) continue;
          changes.push({
            periodCode: item.period_code,
            field: field.label,
            before,
            after,
            author: item.changed_by ? authorById.get(item.changed_by) ?? null : "App agence",
            changedAt: item.changed_at,
          });
        }
      }
      return await respond({ changes });
    }

    if (operation === "manage_crm_user") {
      const action = clean(body?.action);
      if (action === "list") {
        const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] = await Promise.all([admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), admin.from("profiles").select("id, prenom, nom, role, actif")]);
        if (authError || profilesError) throw authError ?? profilesError;
        const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        return await respond({ users: (authData.users ?? []).map((user) => ({ ...profileById.get(user.id), id: user.id, email: user.email ?? "" })).filter((user) => user.nom) });
      }
      const prenom = clean(body?.prenom);
      const nom = clean(body?.nom);
      const role = body?.role === "admin" ? "admin" : "commercial";
      const actif = body?.actif !== false;
      if (action === "create") {
        const email = clean(body?.email).toLowerCase();
        const password = clean(body?.password);
        if (!email || !prenom || !nom || password.length < 8) return await respond({ error: "Informations utilisateur invalides." }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { prenom, nom, role, source: "adaptel-agence" }, app_metadata: { role } });
        if (error || !data.user) return await respond({ error: error?.message ?? "Création impossible." }, 400);
        const { error: profileError } = await admin.from("profiles").update({ prenom, nom, role, actif }).eq("id", data.user.id);
        if (profileError) { await admin.auth.admin.deleteUser(data.user.id); throw profileError; }
        if (!actif) await admin.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
        return await respond({ userId: data.user.id });
      }
      if (action === "update") {
        const id = clean(body?.id);
        if (!id || !prenom || !nom) return await respond({ error: "Informations utilisateur invalides." }, 400);
        const { error: profileError } = await admin.from("profiles").update({ prenom, nom, role, actif }).eq("id", id);
        if (profileError) throw profileError;
        const { error: authError } = await admin.auth.admin.updateUserById(id, { app_metadata: { role }, user_metadata: { prenom, nom, role, source: "adaptel-agence" }, ban_duration: actif ? "none" : "876000h" });
        if (authError) throw authError;
        return await respond({ ok: true });
      }
    }

    return await respond({ error: "Opération inconnue." }, 400);
  } catch (error) {
    return await respond({ error: error instanceof Error ? error.message : "Erreur serveur inattendue." }, 500);
  }
});
