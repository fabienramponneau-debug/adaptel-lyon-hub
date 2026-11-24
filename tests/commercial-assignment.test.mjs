import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("le rapprochement agence reste strictement technique", () => {
  const source = read("supabase/functions/agency-crm-bridge/index.ts");
  const block = source.slice(source.indexOf('if (operation === "link_client")'), source.indexOf('if (operation === "list_linkable_crm_prospects")'));
  assert.ok(block.includes("agency_client_id: agencyClientId"));
  assert.ok(block.includes("erp_client_code: erpClientCode"));
  assert.ok(!block.includes("linkMode"));
  assert.ok(!block.includes('statut: "client"'));
  assert.ok(!block.includes("client_triggered_by:"));
  assert.ok(!block.includes("commercial_id:"));
});

test("le CA planning suit uniquement commercial_id", () => {
  const source = read("supabase/functions/agency-crm-bridge/index.ts");
  const block = source.slice(source.indexOf('if (operation === "sync_planning_estimates")'), source.indexOf('if (operation === "set_crm_objectives")'));
  assert.ok(block.includes('select("id, commercial_id")'));
  assert.ok(block.includes("establishment?.commercial_id"));
  assert.ok(block.includes('onConflict: "etablissement_id,period_code"'));
  assert.ok(!block.includes("client_triggered_by"));
});

test("le CA réel conserve l'attribution des périodes existantes", () => {
  const source = read("supabase/functions/sync-agency-actuals/index.ts");
  assert.ok(source.includes('select("id, agency_client_id, commercial_id")'));
  assert.ok(source.includes("commercialForPeriod(link, periodCode)"));
  assert.ok(source.includes("establishment_assignment_history"));
  assert.ok(source.includes("user_id: historicalCommercialId"));
  assert.ok(source.includes("user_id: existing.user_id"));
  const importBlock = source.slice(source.indexOf("const rows = []"), source.indexOf("const existingByKey"));
  assert.ok(!importBlock.includes("client_triggered_by"));
  assert.ok(!source.includes("staleIds"));
});

test("le CRM affiche et historise l'attribution commerciale", () => {
  const ui = read("src/components/EstablishmentSheet.tsx");
  const migration = read("supabase/migrations/20261123164449_unify_commercial_assignment.sql");
  assert.ok(ui.includes("Commercial attribué"));
  assert.ok(ui.includes('onChange({ commercial_id: v === "none" ? null : v })'));
  assert.ok(!ui.includes("Commercial déclencheur (pour reporting)"));
  assert.ok(migration.includes("establishment_assignment_history"));
  assert.ok(migration.includes("after insert or update of commercial_id"));
  assert.ok(migration.includes("revoke insert on public.establishment_assignment_history from authenticated"));
});
