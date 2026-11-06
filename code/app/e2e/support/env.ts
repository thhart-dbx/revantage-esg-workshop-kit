import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// Test-side access to the real data, as the developer running the tests (credentials from
// code/app/.env.local, written by scripts/dev-env.sh). Used to pick test contacts, verify that a
// submission landed in Lakebase and in the synced Delta table, and to clean up afterwards.

export const STATE_FILE = path.join(__dirname, "..", ".e2e-state.json");

export function loadEnvLocal(): Record<string, string> {
  const file = path.join(__dirname, "..", "..", ".env.local");
  const env: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) env[m[1]] = m[2];
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string> };
}

export const isMock = () => {
  const env = loadEnvLocal();
  return !process.env.BASE_URL && env.SURVEY_DATA_SOURCE === "mock";
};

export interface E2EState {
  mock: boolean;
  campaign: string;
  startedAt: string;
  /** One contact per Playwright project that has not responded to the campaign yet. */
  fresh: Record<string, { contact_id: number; email: string; name: string; property: string }>;
  responded: { email: string; name: string } | null;
}

export function readState(): E2EState {
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

export async function pg(): Promise<Client> {
  const env = loadEnvLocal();
  const client = new Client({
    host: env.PGHOST,
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.LAKEBASE_PASSWORD,
    ssl: { rejectUnauthorized: true },
  });
  await client.connect();
  return client;
}

/** Runs SQL on the warehouse through the Statement Execution API; returns rows as objects. */
export async function sql(statement: string, parameters: Record<string, string> = {}): Promise<Record<string, string | null>[]> {
  const env = loadEnvLocal();
  const host = env.DATABRICKS_HOST.replace(/\/$/, "");
  const res = await fetch(`${host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.DATABRICKS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      warehouse_id: env.DATABRICKS_WAREHOUSE_ID,
      statement,
      wait_timeout: "50s",
      parameters: Object.entries(parameters).map(([name, value]) => ({ name, value })),
    }),
  });
  const body = await res.json();
  if (!res.ok || body.status?.state !== "SUCCEEDED") {
    throw new Error(`SQL failed: ${JSON.stringify(body.status ?? body).slice(0, 500)}`);
  }
  const cols: string[] = body.manifest.schema.columns.map((c: { name: string }) => c.name);
  return (body.result?.data_array ?? []).map((r: (string | null)[]) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

export const fq = (table: string) => {
  const env = loadEnvLocal();
  return `${env.DATABRICKS_CATALOG}.${env.DATABRICKS_SCHEMA}.${table}`;
};
