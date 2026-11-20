import { supabase } from "@/integrations/supabase/client";

export type CrmUserRole = "admin" | "commercial";

export interface CrmUser {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: CrmUserRole;
  actif: boolean;
  lastSignInAt: string | null;
}

export interface CreateCrmUserInput {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  role: CrmUserRole;
  actif: boolean;
}

export interface UpdateCrmUserInput {
  id: string;
  prenom: string;
  nom: string;
  role: CrmUserRole;
  actif: boolean;
}

type UserManagementPayload =
  | { action: "list" }
  | ({ action: "create" } & CreateCrmUserInput)
  | ({ action: "update" } & UpdateCrmUserInput);

interface UserManagementResponse {
  users?: CrmUser[];
  user?: CrmUser;
  error?: string;
}

async function requestUserManagement(
  payload: UserManagementPayload,
): Promise<UserManagementResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error("Session introuvable. Reconnectez-vous puis réessayez.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) {
    throw new Error("Configuration Supabase manquante.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/manage-crm-users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | UserManagementResponse
    | null;

  if (!response.ok) {
    throw new Error(
      result?.error ?? `Gestion des utilisateurs impossible (${response.status}).`,
    );
  }

  return result ?? {};
}

export async function fetchCrmUsers(): Promise<CrmUser[]> {
  const result = await requestUserManagement({ action: "list" });
  return result.users ?? [];
}

export async function createCrmUser(
  input: CreateCrmUserInput,
): Promise<CrmUser> {
  const result = await requestUserManagement({ action: "create", ...input });
  if (!result.user) throw new Error("Le compte créé n'a pas pu être relu.");
  return result.user;
}

export async function updateCrmUser(
  input: UpdateCrmUserInput,
): Promise<CrmUser> {
  const result = await requestUserManagement({ action: "update", ...input });
  if (!result.user) throw new Error("Le compte modifié n'a pas pu être relu.");
  return result.user;
}

