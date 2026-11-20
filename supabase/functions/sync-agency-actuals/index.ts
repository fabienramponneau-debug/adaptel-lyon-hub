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
const validPeriod = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const periodIndex = (periodCode: string) => {
  const [year, month] = periodCode.split("-").map(Number);
  return year * 12 + month;
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

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !agencySecret) {
      return json({ error: "Synchronisation agence non configurée." }, 503);
    }
    if (!authorization) return json({ error: "Session absente." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Session invalide." }, 401);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, prenom, nom, role, actif")
      .eq("id", caller.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.actif || profile.role !== "admin") {
      return json({ error: "Action réservée à un administrateur actif." }, 403);
    }

    const body = await request.json();
    const fromPeriod = clean(body?.fromPeriod);
    const toPeriod = clean(body?.toPeriod);
    if (!validPeriod(fromPeriod) || !validPeriod(toPeriod)) {
      return json({ error: "Période de début et de fin obligatoires." }, 400);
    }
    const periodCount = periodIndex(toPeriod) - periodIndex(fromPeriod) + 1;
    if (periodCount < 1 || periodCount > 36) {
      return json({ error: "La période doit contenir entre 1 et 36 mois." }, 400);
    }

    let linkedQuery = admin
      .from("establishments")
      .select("id, agency_client_id, client_triggered_by")
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
    const allActuals = [];
    const actorName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || null;

    const linkedAgencyIds = [...linkByAgencyId.keys()];
    const agencyIdBatches = linkedAgencyIds.length > 0 ? chunk(linkedAgencyIds, 500) : [[]];
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
      const margin = Number(actual?.margin);
      const link = linkByAgencyId.get(agencyClientId);
      if (!link || !validPeriod(periodCode) || !Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(margin)) {
        skippedInvalid += 1;
        continue;
      }
      if (!link.client_triggered_by) {
        skippedWithoutCommercial += 1;
        continue;
      }
      rows.push({
        user_id: link.client_triggered_by,
        etablissement_id: link.id,
        period_code: periodCode,
        chiffre_affaires: revenue,
        marge: margin,
        source: "agence",
        agency_client_id: agencyClientId,
        commentaire: "Synchronisé depuis l'app agence",
        statut_cloture: "confirme",
        cloture_at: actual?.confirmedAt ?? new Date().toISOString(),
        cloture_by: caller.id,
      });
    }

    if (skippedInvalid > 0) {
      return json({
        error: "La réponse agence contient des réels invalides ; aucune donnée CRM n'a été modifiée.",
        skippedInvalid,
      }, 502);
    }

    // On repère d'abord les lignes devenues obsolètes. Les nouvelles valeurs
    // sont écrites avant leur suppression : un échec d'upsert ne peut donc pas
    // effacer les chiffres déjà présents.
    const desiredKeys = new Set(rows.map((row) => `${row.agency_client_id}|${row.period_code}`));
    const staleIds = [];
    for (const agencyIds of chunk([...linkByAgencyId.keys()], 500)) {
      const { data: existingRows, error: existingError } = await admin
        .from("performances_clients")
        .select("id, agency_client_id, period_code")
        .eq("source", "agence")
        .in("agency_client_id", agencyIds)
        .gte("period_code", fromPeriod)
        .lte("period_code", toPeriod);
      if (existingError) throw existingError;
      for (const existing of existingRows ?? []) {
        if (!desiredKeys.has(`${existing.agency_client_id}|${existing.period_code}`)) staleIds.push(existing.id);
      }
    }

    for (const rowBatch of chunk(rows, 500)) {
      const { error: upsertError } = await admin
        .from("performances_clients")
        .upsert(rowBatch, { onConflict: "user_id,etablissement_id,period_code" });
      if (upsertError) throw upsertError;
    }

    // Une réouverture côté agence retire le mois de la réponse. L'ancienne
    // ligne CRM est supprimée seulement après la réussite de tous les upserts.
    for (const staleBatch of chunk(staleIds, 500)) {
      const { error: deleteError } = await admin
        .from("performances_clients")
        .delete()
        .in("id", staleBatch);
      if (deleteError) throw deleteError;
    }

    return json({
      ok: true,
      linkedClients: links.length,
      importedActuals: rows.length,
      skippedWithoutCommercial,
      skippedInvalid,
      fromPeriod,
      toPeriod,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erreur serveur inattendue." }, 500);
  }
});
