import "server-only";

// Where the app reads (Delta, via the SQL warehouse) and writes (Lakebase Postgres).
// On Databricks Apps these come from code/resources/app.yml (bundle variables); locally from .env.local.

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ident(name: string, fallback: string): string {
  const v = process.env[name] || fallback;
  if (!IDENT.test(v)) throw new Error(`${name} must be a plain SQL identifier, got "${v}"`);
  return v;
}

export const catalog = () => ident("DATABRICKS_CATALOG", "<catalog>");
export const schema = () => ident("DATABRICKS_SCHEMA", "<schema>");
export const pgSchema = () => ident("SURVEY_PG_SCHEMA", "survey");

/** Fully qualified Delta table name in the demo schema. */
export const delta = (table: string) => {
  if (!IDENT.test(table)) throw new Error(`Bad table name "${table}"`);
  return `${catalog()}.${schema()}.${table}`;
};

/**
 * `SURVEY_DATA_SOURCE=mock` (local only) serves fixtures and keeps responses in memory, so the UI
 * can be built without a warehouse or Lakebase. Never set it on the deployed app.
 */
export const isMockMode = () => process.env.SURVEY_DATA_SOURCE === "mock";
