// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (value: unknown) => String(value ?? "").trim();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Configuration serveur incomplète." }, 500);
    }
    if (!authorization) return json({ error: "Session absente." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Session invalide." }, 401);

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("id, role, actif")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfileError) return json({ error: callerProfileError.message }, 500);
    if (!callerProfile?.actif || callerProfile.role !== "admin") {
      return json({ error: "Action réservée à un administrateur actif." }, 403);
    }

    const body = await request.json();
    const action = clean(body?.action);

    const listUsers = async () => {
      const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
          adminClient.from("profiles").select("id, prenom, nom, role, actif"),
        ]);
      if (authError) throw authError;
      if (profilesError) throw profilesError;
      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return (authData.users ?? [])
        .map((authUser) => {
          const profile = profileById.get(authUser.id);
          if (!profile) return null;
          return {
            id: authUser.id,
            email: authUser.email ?? "",
            prenom: profile.prenom ?? "",
            nom: profile.nom ?? "",
            role: profile.role,
            actif: profile.actif,
            lastSignInAt: authUser.last_sign_in_at ?? null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, "fr"));
    };

    if (action === "list") return json({ users: await listUsers() });

    if (action === "create") {
      const email = clean(body?.email).toLowerCase();
      const password = clean(body?.password);
      const prenom = clean(body?.prenom);
      const nom = clean(body?.nom);
      const role = body?.role === "admin" ? "admin" : "commercial";
      const actif = body?.actif !== false;

      if (!email || !prenom || !nom) return json({ error: "Email, prénom et nom obligatoires." }, 400);
      if (password.length < 8) return json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, 400);

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { prenom, nom, role, source: "adaptel-crm" },
        app_metadata: { role },
      });
      if (createError || !created.user) return json({ error: createError?.message ?? "Création impossible." }, 400);

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ prenom, nom, role, actif })
        .eq("id", created.user.id);
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 500);
      }
      if (!actif) {
        await adminClient.auth.admin.updateUserById(created.user.id, { ban_duration: "876000h" });
      }

      const users = await listUsers();
      return json({ user: users.find((user) => user.id === created.user.id) });
    }

    if (action === "update") {
      const id = clean(body?.id);
      const prenom = clean(body?.prenom);
      const nom = clean(body?.nom);
      const role = body?.role === "admin" ? "admin" : "commercial";
      const actif = body?.actif !== false;
      if (!id || !prenom || !nom) return json({ error: "Utilisateur, prénom et nom obligatoires." }, 400);
      if (id === caller.id && (!actif || role !== "admin")) {
        return json({ error: "Vous ne pouvez pas désactiver ou rétrograder votre propre compte." }, 400);
      }

      const { data: previous, error: previousError } = await adminClient
        .from("profiles")
        .select("prenom, nom, role, actif")
        .eq("id", id)
        .single();
      if (previousError) return json({ error: previousError.message }, 404);

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ prenom, nom, role, actif })
        .eq("id", id);
      if (profileError) return json({ error: profileError.message }, 500);

      const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
        app_metadata: { role },
        user_metadata: { prenom, nom, role, source: "adaptel-crm" },
        ban_duration: actif ? "none" : "876000h",
      });
      if (authError) {
        await adminClient.from("profiles").update(previous).eq("id", id);
        return json({ error: authError.message }, 500);
      }

      const users = await listUsers();
      return json({ user: users.find((user) => user.id === id) });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erreur serveur inattendue." }, 500);
  }
});

