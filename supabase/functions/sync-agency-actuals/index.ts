// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const clean = (value: unknown) => String(value ?? "").trim();
const secureEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};
const validPeriod = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const periodIndex = (periodCode: string) => {
  const [year, month] = periodCode.split("-").map(Number);
  return year * 12 + month;
};
const nextPeriodStart = (periodCode: string) => {
  const [year, month] = periodCode.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString();
};
const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const agencySecret = Deno.env.get("AGENCY_CRM_SYNC_SECRET");
    const agencyUrl = Deno.env.get("AGENCY_CRM_BRIDGE_URL")
      ?? "https://nocqkcbghkwscizxryum.supabase.co/functions/v1/crm-agence-entrant";
    const authorization = request.headers.get("Authorization");
    const cronSecret = Deno.env.get("SYNC_AGENCY_ACTUALS_CRON_SECRET") ?? "";
    const providedCronSecret = request.headers.get("x-adaptel-cron-secret") ?? "";
    const isScheduled = !!cronSecret && !!providedCronSecret && secureEqual(cronSecret, providedCronSecret);
    const body = await request.json();
    const operation = clean(body?.operation) || "sync_actuals";

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !agencySecret) {
      return json({ error: "Synchronisation agence non configurée." }, 503);
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let caller = null;
    let profile = { id: null, prenom: "Synchronisation", nom: "quotidienne", role: "admin", actif: true };
    if (isScheduled) {
      if (operation !== "sync_actuals") return json({ error: "Le jeton planifié ne permet que la synchronisation des réels." }, 403);
    } else {
      if (!authorization) return json({ error: "Session absente." }, 401);
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error: callerError } = await callerClient.auth.getUser();
      if (callerError || !user) return json({ error: "Session invalide." }, 401);
      caller = user;
      const { data: callerProfile, error: profileError } = await admin
        .from("profiles")
        .select("id, prenom, nom, role, actif")
        .eq("id", caller.id)
        .maybeSingle();
      if (profileError) throw profileError;
      profile = callerProfile;
    }
    if (!profile?.actif) return json({ error: "Compte CRM inactif." }, 403);
    if (operation === "sync_actuals" && profile.role !== "admin") {
      return json({ error: "Synchronisation réservée à un administrateur actif." }, 403);
    }

    const callAgency = async (agencyOperation: string, payload: Record<string, unknown>) => {
      const requestId = crypto.randomUUID();
      const actorName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || null;
      const { data: journal, error: journalError } = await admin
        .from("agency_bridge_journal")
        .insert({ request_id: requestId, direction: "crm_vers_agence", operation: agencyOperation, actor_name: actorName })
        .select("id")
        .single();
      if (journalError) throw journalError;
      try {
        const response = await fetch(agencyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-adaptel-sync-secret": agencySecret },
          body: JSON.stringify({ operation: agencyOperation, requestId, ...payload }),
        });
        const responseBody = await response.json().catch(() => ({ error: "Réponse agence illisible." }));
        await admin.from("agency_bridge_journal").update({
          status: response.ok ? "success" : "error",
          response_status: response.status,
          response_body: responseBody,
          error_message: response.ok ? null : clean(responseBody?.error) || "Erreur agence.",
          completed_at: new Date().toISOString(),
        }).eq("id", journal.id);
        return { ok: response.ok, status: response.status, body: responseBody };
      } catch (error) {
        await admin.from("agency_bridge_journal").update({
          status: "error",
          error_message: error instanceof Error ? error.message : "Erreur réseau agence.",
          completed_at: new Date().toISOString(),
        }).eq("id", journal.id);
        throw error;
      }
    };

    if (operation === "search_agency_clients") {
      const q = clean(body?.q).slice(0, 100);
      if (q.length < 2) return json({ error: "Saisissez au moins deux caractères." }, 400);
      const agencyResponse = await callAgency("search_agency_clients", { q });
      if (!agencyResponse.ok) return json({ error: agencyResponse.body?.error ?? "Recherche agence impossible." }, agencyResponse.status);
      return json({ clients: Array.isArray(agencyResponse.body?.clients) ? agencyResponse.body.clients : [] });
    }

    if (operation === "link_agency_client") {
      const establishmentId = clean(body?.establishmentId);
      const agencyClientId = clean(body?.agencyClientId);
      const erpClientCode = clean(body?.erpClientCode);
      if (!validUuid(establishmentId) || !validUuid(agencyClientId) || !/^[A-Za-z0-9._-]{1,40}$/.test(erpClientCode)) return json({ error: "Client CRM et client agence obligatoires." }, 400);
      const { data: establishment, error: establishmentError } = await admin
        .from("establishments")
        .select("id, statut, commercial_id, agency_client_id, erp_client_code")
        .eq("id", establishmentId)
        .maybeSingle();
      if (establishmentError || !establishment) return json({ error: "Fiche CRM introuvable." }, 404);
      if (profile.role !== "admin" && establishment.commercial_id !== caller?.id) return json({ error: "Cette fiche n'est pas dans votre portefeuille." }, 403);
      if (establishment.statut !== "client") return json({ error: "Passez d'abord la fiche en client actuel." }, 409);
      if (establishment.agency_client_id && establishment.agency_client_id !== agencyClientId) return json({ error: "Cette fiche est déjà rapprochée." }, 409);

      const agencyResponse = await callAgency("search_agency_clients", { q: erpClientCode });
      if (!agencyResponse.ok) return json({ error: agencyResponse.body?.error ?? "Vérification agence impossible." }, agencyResponse.status);
      const trustedClient = (agencyResponse.body?.clients ?? []).find((client) => clean(client?.agencyClientId) === agencyClientId && clean(client?.erpClientCode) === erpClientCode);
      if (!trustedClient) return json({ error: "Le client agence sélectionné n'a pas pu être confirmé." }, 409);
      const { data: conflict } = await admin.from("establishments").select("id").or(`agency_client_id.eq.${agencyClientId},erp_client_code.eq.${erpClientCode}`).neq("id", establishmentId).limit(1).maybeSingle();
      if (conflict) return json({ error: "Ce client agence est déjà lié à une autre fiche CRM." }, 409);
      const { data: linked, error: linkError } = await admin.from("establishments").update({
        agency_client_id: agencyClientId,
        erp_client_code: erpClientCode,
        siret: clean(trustedClient?.siret) || null,
      }).eq("id", establishmentId).select("id, agency_client_id, erp_client_code, siret, commercial_id, client_triggered_by, client_triggered_at").single();
      if (linkError) return json({ error: linkError.message }, 409);
      return json({ client: linked });
    }

    const today = new Date();
    const currentPeriod = today.toISOString().slice(0, 7);
    const previousPeriodDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const fromPeriod = clean(body?.fromPeriod) || (isScheduled ? previousPeriodDate.toISOString().slice(0, 7) : "");
    const toPeriod = clean(body?.toPeriod) || (isScheduled ? currentPeriod : "");
    if (!validPeriod(fromPeriod) || !validPeriod(toPeriod)) {
      return json({ error: "Période de début et de fin obligatoires." }, 400);
    }
    const periodCount = periodIndex(toPeriod) - periodIndex(fromPeriod) + 1;
    if (periodCount < 1 || periodCount > 36) {
      return json({ error: "La période doit contenir entre 1 et 36 mois." }, 400);
    }

    let linkedQuery = admin
      .from("establishments")
      .select("id, agency_client_id, commercial_id")
      .eq("statut", "client")
      .not("agency_client_id", "is", null);
    const requestedAgencyIds = Array.isArray(body?.agencyClientIds)
      ? [...new Set(body.agencyClientIds.map(clean).filter(Boolean))]
      : [];
    if (requestedAgencyIds.length > 500) return json({ error: "500 clients maximum par synchronisation ciblée." }, 400);
    if (requestedAgencyIds.length) linkedQuery = linkedQuery.in("agency_client_id", requestedAgencyIds);

    const { data: linkedClients, error: linkedError } = await linkedQuery;
    if (linkedError) throw linkedError;
    const links = linkedClients ?? [];
    const linkByAgencyId = new Map(links.map((item) => [item.agency_client_id, item]));
    const assignmentHistoryByEstablishment = new Map();
    for (const establishmentIds of chunk(links.map((link) => link.id), 100)) {
      const { data: historyRows, error: historyError } = await admin
        .from("establishment_assignment_history")
        .select("etablissement_id, previous_commercial_id, new_commercial_id, changed_at")
        .in("etablissement_id", establishmentIds)
        .order("changed_at", { ascending: true })
        .range(0, 9999);
      if (historyError) throw historyError;
      for (const item of historyRows ?? []) {
        const history = assignmentHistoryByEstablishment.get(item.etablissement_id) ?? [];
        history.push(item);
        assignmentHistoryByEstablishment.set(item.etablissement_id, history);
      }
    }
    const commercialForPeriod = (link, periodCode) => {
      const history = assignmentHistoryByEstablishment.get(link.id) ?? [];
      const periodEnd = nextPeriodStart(periodCode);
      const lastEffective = [...history].reverse().find((item) => item.changed_at < periodEnd);
      if (lastEffective) return lastEffective.new_commercial_id;
      const firstLater = history.find((item) => item.changed_at >= periodEnd);
      return firstLater?.previous_commercial_id ?? link.commercial_id;
    };
    const allActuals = [];
    const actorName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || null;

    const linkedAgencyIds = [...linkByAgencyId.keys()];
    if (linkedAgencyIds.length === 0) {
      return json({ ok: true, linkedClients: 0, importedActuals: 0, insertedActuals: 0, updatedActuals: 0, unchangedActuals: 0, skippedWithoutCommercial: 0, skippedInvalid: 0, fromPeriod, toPeriod });
    }
    const agencyIdBatches = chunk(linkedAgencyIds, 500);
    for (const agencyIds of agencyIdBatches) {
      const requestId = crypto.randomUUID();
      const { data: journal, error: journalError } = await admin
        .from("agency_bridge_journal")
        .insert({
          request_id: requestId,
          direction: "crm_vers_agence",
          operation: "list_monthly_actuals",
          actor_name: actorName,
        })
        .select("id")
        .single();
      if (journalError) throw journalError;

      let responseStatus = 500;
      let responseBody: any = null;
      try {
        const response = await fetch(agencyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-adaptel-sync-secret": agencySecret,
          },
          body: JSON.stringify({
            operation: "list_monthly_actuals",
            requestId,
            agencyClientIds: agencyIds,
            fromPeriod,
            toPeriod,
          }),
        });
        responseStatus = response.status;
        responseBody = await response.json().catch(() => ({ error: "Réponse agence illisible." }));
        await admin.from("agency_bridge_journal").update({
          status: response.ok ? "success" : "error",
          response_status: response.status,
          response_body: responseBody,
          error_message: response.ok ? null : clean(responseBody?.error) || "Erreur agence.",
          completed_at: new Date().toISOString(),
        }).eq("id", journal.id);
        if (!response.ok) return json({ error: responseBody?.error ?? "Lecture agence impossible." }, response.status);
      } catch (error) {
        await admin.from("agency_bridge_journal").update({
          status: "error",
          response_status: responseStatus,
          response_body: responseBody,
          error_message: error instanceof Error ? error.message : "Erreur réseau agence.",
          completed_at: new Date().toISOString(),
        }).eq("id", journal.id);
        throw error;
      }
      if (!Array.isArray(responseBody?.actuals)) {
        throw new Error("La réponse agence ne contient pas la liste des réels attendue.");
      }
      allActuals.push(...responseBody.actuals);
    }

    const rows = [];
    let skippedWithoutCommercial = 0;
    let skippedInvalid = 0;
    for (const actual of allActuals) {
      const agencyClientId = clean(actual?.agencyClientId);
      const periodCode = clean(actual?.periodCode);
      const revenue = Number(actual?.revenue);
      const marginBeforeCet = actual?.marginBeforeCet;
      const marginAfterCet = actual?.marginAfterCet;
      const hoursBilled = actual?.hoursBilled;
      const confirmedAt = clean(actual?.confirmedAt);
      const link = linkByAgencyId.get(agencyClientId);
      if (!link || !validPeriod(periodCode) || !Number.isFinite(revenue) || revenue < 0
        || !Number.isFinite(marginBeforeCet) || !Number.isFinite(marginAfterCet)
        || !Number.isFinite(hoursBilled) || hoursBilled < 0
        || !Number.isFinite(Date.parse(confirmedAt))
        || periodCode < fromPeriod || periodCode > toPeriod) {
        skippedInvalid += 1;
        continue;
      }
      const historicalCommercialId = commercialForPeriod(link, periodCode);
      if (!historicalCommercialId) {
        skippedWithoutCommercial += 1;
        continue;
      }
      rows.push({
        user_id: historicalCommercialId,
        etablissement_id: link.id,
        period_code: periodCode,
        chiffre_affaires: revenue,
        marge: marginBeforeCet,
        marge_apres_cet: marginAfterCet,
        heures_facturees: hoursBilled,
        source: "agence",
        agency_client_id: agencyClientId,
        commentaire: "Synchronisé depuis l'app agence",
        statut_cloture: "confirme",
        cloture_at: confirmedAt,
        cloture_by: caller?.id ?? null,
      });
    }

    if (skippedInvalid > 0) {
      return json({
        error: "La réponse agence contient des réels invalides ; aucune donnée CRM n'a été modifiée.",
        skippedInvalid,
      }, 502);
    }

    // Une réattribution ne doit jamais dupliquer ni déplacer rétroactivement un
    // mois déjà clôturé. Une ligne agence existante conserve donc son user_id ;
    // seules les nouvelles périodes prennent le commercial actuellement attribué.
    const existingByKey = new Map();
    for (const establishmentIds of chunk(links.map((link) => link.id), 500)) {
      const { data: existingRows, error: existingError } = await admin
        .from("performances_clients")
        .select("id, user_id, etablissement_id, agency_client_id, period_code, source, chiffre_affaires, marge, marge_apres_cet, heures_facturees, statut_cloture, cloture_at")
        .in("etablissement_id", establishmentIds)
        .gte("period_code", fromPeriod)
        .lte("period_code", toPeriod);
      if (existingError) throw existingError;
      for (const existing of existingRows ?? []) {
        const key = `${existing.etablissement_id}|${existing.period_code}`;
        if (existingByKey.has(key)) {
          return json({ error: "Plusieurs résultats CRM existent pour un même client et un même mois ; synchronisation annulée." }, 409);
        }
        existingByKey.set(key, existing);
      }
    }

    const updates = [];
    const inserts = [];
    const reopenedIds = [];
    let unchangedActuals = 0;
    for (const row of rows) {
      const existing = existingByKey.get(`${row.etablissement_id}|${row.period_code}`);
      if (!existing) {
        inserts.push(row);
        continue;
      }
      if (existing.source !== "agence") {
        return json({ error: "Un résultat saisi directement dans le CRM existe déjà pour cette période ; synchronisation annulée." }, 409);
      }
      const sameAmounts = Number(existing.chiffre_affaires) === row.chiffre_affaires
        && Number(existing.marge) === row.marge
        && Number(existing.marge_apres_cet) === row.marge_apres_cet
        && Number(existing.heures_facturees) === row.heures_facturees;
      const incomingConfirmation = new Date(row.cloture_at).getTime();
      const existingConfirmation = existing.cloture_at ? new Date(existing.cloture_at).getTime() : 0;
      if (existing.statut_cloture === "confirme" && (sameAmounts || incomingConfirmation <= existingConfirmation)) {
        unchangedActuals += 1;
        continue;
      }
      if (existing.statut_cloture === "confirme") reopenedIds.push(existing.id);
      updates.push({ ...row, id: existing.id, user_id: existing.user_id });
    }

    // Une nouvelle confirmation agence plus recente est une revision explicite.
    // Le passage intermediaire en brouillon permet au trigger unique de figer le
    // nouveau snapshot de prime ; les autres mois confirmes restent intacts.
    for (const idBatch of chunk(reopenedIds, 500)) {
      const { error: reopenError } = await admin
        .from("performances_clients")
        .update({ statut_cloture: "brouillon", cloture_at: null, cloture_by: null })
        .in("id", idBatch);
      if (reopenError) throw reopenError;
    }

    for (const rowBatch of chunk(updates, 500)) {
      const { error: updateError } = await admin
        .from("performances_clients")
        .upsert(rowBatch, { onConflict: "id" });
      if (updateError) throw updateError;
    }

    for (const rowBatch of chunk(inserts, 500)) {
      const { error: insertError } = await admin
        .from("performances_clients")
        .insert(rowBatch);
      if (insertError) throw insertError;
    }

    return json({
      ok: true,
      linkedClients: links.length,
      importedActuals: inserts.length + updates.length,
      insertedActuals: inserts.length,
      updatedActuals: updates.length,
      unchangedActuals,
      skippedWithoutCommercial,
      skippedInvalid,
      fromPeriod,
      toPeriod,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erreur serveur inattendue." }, 500);
  }
});
