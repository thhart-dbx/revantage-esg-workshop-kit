import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { DBSQLClient } from "@databricks/sql";

// Test-only SQL access (runs in the Playwright process, never in the app): snapshot the test
// invoice before a test, check what the app wrote, and restore the seed state afterwards.
// Settings: env vars, falling back to .env.local (what `npm run dev` uses). Without
// DATABRICKS_TOKEN the token comes from the Databricks CLI for the DATABRICKS_PROFILE profile.

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  if (existsSync(".env.local"))
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  for (const [k, v] of Object.entries(process.env)) if (v) out[k] = v;
  return out;
}

const E = env();
const IDENT = /^[A-Za-z0-9_]+$/;
const q = (t: string) => {
  for (const p of [E.DATABRICKS_CATALOG, E.DATABRICKS_SCHEMA, t]) if (!p || !IDENT.test(p)) throw new Error(`bad identifier ${p}`);
  return `\`${E.DATABRICKS_CATALOG}\`.\`${E.DATABRICKS_SCHEMA}\`.\`${t}\``;
};
export const INVOICES = () => q(E.INVOICES_TABLE || "ref_invoices_extracted");
export const CORRECTIONS = () => q(E.CORRECTIONS_TABLE || "ref_invoice_corrections");

function token(): string {
  if (E.DATABRICKS_TOKEN) return E.DATABRICKS_TOKEN;
  const profile = E.DATABRICKS_PROFILE;
  const out = execSync(`databricks auth token --profile ${profile}`, { encoding: "utf8" });
  return JSON.parse(out).access_token;
}

export async function sql<T = Record<string, unknown>>(statement: string, params?: Record<string, string | number | null>): Promise<T[]> {
  const client = await new DBSQLClient().connect({
    host: (E.DATABRICKS_HOST ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    path: `/sql/1.0/warehouses/${E.DATABRICKS_WAREHOUSE_ID}`,
    token: token(),
  });
  const session = await client.openSession();
  try {
    const op = await session.executeStatement(statement, { namedParameters: params });
    const rows = (await op.fetchAll()) as T[];
    await op.close();
    return rows;
  } finally {
    await session.close();
    await client.close();
  }
}

// Columns the app may change, with their SQL types (for an exact restore).
const RESTORE: Record<string, string> = {
  document_type: "STRING", supplier_name: "STRING", invoice_number: "STRING", invoice_date: "DATE",
  billing_period_start: "DATE", billing_period_end: "DATE", property_id: "INT", site_address: "STRING",
  meter_id: "STRING", utility_type: "STRING", consumption: "DOUBLE", consumption_unit: "STRING",
  consumption_kwh: "DOUBLE", reading_type: "STRING", amount_net: "DECIMAL(14,2)", vat_amount: "DECIMAL(14,2)",
  amount_total: "DECIMAL(14,2)", currency: "STRING", qa_status: "STRING", reviewed_by: "STRING", reviewed_at: "TIMESTAMP",
};

export type Snapshot = Record<string, string | null>;

export async function snapshot(invoiceId: string): Promise<Snapshot> {
  const cols = Object.keys(RESTORE).map((c) => `CAST(${c} AS STRING) AS ${c}`).join(", ");
  const [row] = await sql<Snapshot>(`SELECT ${cols} FROM ${INVOICES()} WHERE invoice_id = :id`, { id: invoiceId });
  if (!row) throw new Error(`no row ${invoiceId}`);
  return row;
}

export async function restore(invoiceId: string, snap: Snapshot) {
  const params: Record<string, string | null> = { id: invoiceId };
  const sets = Object.entries(RESTORE).map(([c, t]) => {
    params[c] = snap[c] ?? null;
    return `${c} = CAST(:${c} AS ${t})`;
  });
  await sql(`UPDATE ${INVOICES()} SET ${sets.join(", ")} WHERE invoice_id = :id`, params);
  await sql(`DELETE FROM ${CORRECTIONS()} WHERE invoice_id = :id AND comment LIKE '%[e2e]%'`, { id: invoiceId });
}
