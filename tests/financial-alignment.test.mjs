import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261124120000_crm_v1_financial_alignment.sql");

test("la migration V1 reste additive et sépare les deux marges", () => {
  assert.ok(migration.includes("add column if not exists marge_apres_cet"));
  assert.ok(migration.includes("add column if not exists heures_facturees"));
  assert.ok(migration.includes("add column if not exists reference_marge"));
  assert.ok(!migration.match(/drop table|drop column/i));
});

test("un seul moteur SQL versionné calcule et fige les primes", () => {
  const bridge = read("supabase/functions/agency-crm-bridge/index.ts");
  const reporting = read("src/components/reporting/FinancialReportingSection.tsx");
  assert.ok(migration.includes("create table public.commission_rules"));
  assert.ok(migration.includes("commission_rate_v1"));
  assert.ok(migration.includes("freeze_performance_commission_v1"));
  assert.ok(migration.includes("client_triggered_by"));
  assert.ok(!bridge.includes("const commissionRate"));
  assert.ok(!reporting.includes("const commissionRate"));
  assert.ok(reporting.includes("crm_commission_totals_v1"));
  assert.ok(migration.includes("sum(coalesce(performance.prime_montant, 0))"));
});

test("la synchronisation exige les champs ERP explicites et évite les réécritures", () => {
  const source = read("supabase/functions/sync-agency-actuals/index.ts");
  assert.ok(source.includes("actual?.marginBeforeCet"));
  assert.ok(source.includes("actual?.marginAfterCet"));
  assert.ok(source.includes("actual?.hoursBilled"));
  assert.ok(source.includes("unchangedActuals"));
  assert.ok(!source.includes("const margin = Number(actual?.margin)"));
});

test("les réels agence sont en lecture seule dans le CRM", () => {
  const source = read("src/components/admin/ClientPerformanceManager.tsx");
  assert.ok(source.includes('row.actualSource === "agence"'));
  assert.ok(source.includes("Les réels liés à l’app agence sont en lecture seule"));
  assert.ok(migration.includes("protect_agency_performance_v1"));
  assert.ok(migration.includes("Un reel confirme doit etre rouvert avant correction"));
});
