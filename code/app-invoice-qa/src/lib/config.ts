import "server-only";

// Table / volume names come from env vars (data contract, UJ2), so the same code serves the
// reference tables (ref_*) and a participant's own copy. Identifiers can't be bound as SQL
// parameters, so they are validated against a strict pattern before they are quoted.

const IDENT = /^[A-Za-z0-9_]+$/;

function ident(name: string, value: string | undefined, fallback?: string): string {
  const v = value && value.length > 0 ? value : fallback;
  if (!v || !IDENT.test(v)) throw new Error(`${name} must be set to a plain identifier (got ${JSON.stringify(v)})`);
  return v;
}

export function config() {
  const catalog = ident("DATABRICKS_CATALOG", process.env.DATABRICKS_CATALOG);
  const schema = ident("DATABRICKS_SCHEMA", process.env.DATABRICKS_SCHEMA);
  const q = (t: string) => `\`${catalog}\`.\`${schema}\`.\`${t}\``;
  const volume = ident("INVOICES_VOLUME", process.env.INVOICES_VOLUME, "utility_invoices");
  return {
    catalog,
    schema,
    invoicesTable: q(ident("INVOICES_TABLE", process.env.INVOICES_TABLE, "ref_invoices_extracted")),
    correctionsTable: q(ident("CORRECTIONS_TABLE", process.env.CORRECTIONS_TABLE, "ref_invoice_corrections")),
    propertiesTable: q(ident("PROPERTIES_TABLE", process.env.PROPERTIES_TABLE, "properties")),
    volumeRoot: `/Volumes/${catalog}/${schema}/${volume}/`,
  };
}

export const isMock = () => process.env.QA_DATA_MODE === "mock";

export function databricksHost(): string {
  const h = (process.env.DATABRICKS_HOST ?? "").replace(/\/$/, "");
  return h.startsWith("http") ? h : `https://${h}`;
}
