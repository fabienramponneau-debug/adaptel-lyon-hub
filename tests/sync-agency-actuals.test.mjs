import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../supabase/functions/sync-agency-actuals/index.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source.replace(/^import .*;$/m, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
});
const valid = {
  agencyClientId: "agency-client",
  periodCode: "2026-10",
  revenue: 100,
  marginBeforeCet: 20,
  marginAfterCet: 15,
  hoursBilled: 10,
  confirmedAt: "2026-11-01T12:00:00Z",
};

async function sync(actuals) {
  const financialWrites = [];
  let handler;
  const tables = {
    establishments: [{ id: "establishment", agency_client_id: valid.agencyClientId, commercial_id: "commercial" }],
    establishment_assignment_history: [],
    agency_bridge_journal: { id: "journal" },
    performances_clients: [],
  };
  const createClient = () => ({
    from(table) {
      assert.ok(Object.hasOwn(tables, table));
      const query = {
        then(resolve, reject) {
          return Promise.resolve({ data: tables[table], error: null }).then(resolve, reject);
        },
      };
      for (const method of ["select", "eq", "not", "in", "order", "range", "single", "gte", "lte"]) {
        query[method] = () => query;
      }
      for (const method of ["insert", "update", "upsert"]) {
        query[method] = (payload) => {
          if (table === "performances_clients") financialWrites.push({ method, payload });
          return query;
        };
      }
      return query;
    },
  });
  runInNewContext(outputText, {
    Deno: { env: { get: () => "test-secret" }, serve: (callback) => { handler = callback; } },
    createClient,
    fetch: async () => Response.json({ actuals }),
    Request, Response, TextEncoder, crypto,
  });
  const response = await handler(new Request("http://localhost", {
    method: "POST",
    headers: { "x-adaptel-cron-secret": "test-secret" },
    body: JSON.stringify({ fromPeriod: "2026-10", toPeriod: "2026-11" }),
  }));
  return { status: response.status, body: await response.json(), financialWrites };
}

for (const field of ["marginBeforeCet", "marginAfterCet", "hoursBilled"]) {
  test(`la fonction Edge refuse ${field} absent, null ou non numérique`, async () => {
    for (const value of [undefined, null, "", "invalide", "0", false, [], {}]) {
      const result = await sync([{ ...valid, [field]: value }]);
      assert.equal(result.status, 502, `${field} = ${JSON.stringify(value)}`);
      assert.equal(result.body.skippedInvalid, 1);
      assert.equal(result.financialWrites.length, 0);
    }
  });
}

test("la fonction Edge conserve les zéros numériques explicites", async () => {
  const result = await sync([{ ...valid, marginBeforeCet: 0, marginAfterCet: 0, hoursBilled: 0 }]);
  assert.equal(result.status, 200);
  assert.equal(result.body.insertedActuals, 1);
  assert.equal(result.financialWrites.length, 1);
  const { marge, marge_apres_cet, heures_facturees } = result.financialWrites[0].payload[0];
  assert.deepEqual([marge, marge_apres_cet, heures_facturees], [0, 0, 0]);
});

test("la fonction Edge rejette tout le lot si une ligne est invalide", async () => {
  const result = await sync([valid, { ...valid, periodCode: "2026-11", hoursBilled: -1 }]);
  assert.equal(result.status, 502);
  assert.equal(result.body.skippedInvalid, 1);
  assert.equal(result.financialWrites.length, 0);
});
