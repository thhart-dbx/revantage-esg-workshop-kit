// Client-safe display helpers.
export function money(v: number | null | undefined, currency?: string | null) {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "EUR", maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency ?? ""}`;
  }
}

export function num(v: number | null | undefined, digits = 0) {
  return v == null ? "—" : v.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

export function date(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v.endsWith("Z") ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function dateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v.endsWith("Z") ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export const UTILITY_LABEL: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  district_heating: "District heating",
};
