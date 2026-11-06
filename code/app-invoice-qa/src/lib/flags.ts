import type { Flag, Invoice } from "./types";

// QA flags shown in the queue and on the review page. Pure functions: used server-side for both
// the SQL and the mock data layer, so the rules live in one place.

const REQUIRED: { field: keyof Invoice; label: string }[] = [
  { field: "invoice_number", label: "invoice number" },
  { field: "invoice_date", label: "invoice date" },
  { field: "supplier_name", label: "supplier" },
  { field: "billing_period_start", label: "period start" },
  { field: "billing_period_end", label: "period end" },
  { field: "consumption", label: "consumption" },
  { field: "amount_total", label: "total" },
  { field: "currency", label: "currency" },
];

const PIPELINE_LABEL: Record<string, string> = {
  total_mismatch: "Total ≠ net + VAT",
  property_unmatched: "Unmatched property",
  not_an_invoice: "Not an invoice",
  multiple_invoices: "Two invoices in one file",
  unit_unknown: "Unknown unit",
};

const ROUNDED_TOTAL = new Set(["SEK", "CZK", "NOK", "DKK", "HUF", "CHF"]);

export function kwhPerDay(inv: Pick<Invoice, "consumption_kwh" | "billing_period_start" | "billing_period_end">) {
  if (inv.consumption_kwh == null || !inv.billing_period_start || !inv.billing_period_end) return null;
  const days =
    (Date.parse(inv.billing_period_end) - Date.parse(inv.billing_period_start)) / 86_400_000 + 1;
  if (!Number.isFinite(days) || days <= 0) return null;
  return inv.consumption_kwh / days;
}

export function computeFlags(inv: Invoice): Flag[] {
  const flags: Flag[] = [];

  const missing = REQUIRED.filter(({ field }) => inv[field] == null || inv[field] === "").map((r) => r.label);
  if (missing.length) flags.push({ key: "missing_fields", label: "Missing fields", detail: `Missing ${missing.join(", ")}` });

  if (inv.amount_net != null && inv.vat_amount != null && inv.amount_total != null) {
    const diff = Math.round((inv.amount_net + inv.vat_amount - inv.amount_total) * 100) / 100;
    // SEK / CZK (and a few others) round the payable total to whole units: allow that rounding line.
    const tolerance = ROUNDED_TOTAL.has(inv.currency ?? "") ? 0.5 : 0.01;
    if (Math.abs(diff) > tolerance)
      flags.push({
        key: "total_mismatch",
        label: "Total ≠ net + VAT",
        detail: `Net ${inv.amount_net.toFixed(2)} + VAT ${inv.vat_amount.toFixed(2)} = ${(inv.amount_net + inv.vat_amount).toFixed(2)}, total is ${inv.amount_total.toFixed(2)}`,
      });
  }

  if (inv.property_id == null)
    flags.push({ key: "unmatched_property", label: "Unmatched property", detail: "Site address did not match a Revantage property" });

  const perDay = kwhPerDay(inv);
  if (perDay != null && perDay < 0) {
    flags.push({ key: "unusual_consumption", label: "Unusual consumption", detail: "Negative consumption (credit note?)" });
  } else if (perDay != null && inv.peer_kwh_per_day && inv.peer_count >= 3) {
    const ratio = perDay / inv.peer_kwh_per_day;
    if (ratio > 2 || ratio < 0.5)
      flags.push({
        key: "unusual_consumption",
        label: "Unusual consumption",
        detail: `${Math.round(perDay).toLocaleString("en-GB")} kWh/day vs ${Math.round(inv.peer_kwh_per_day).toLocaleString("en-GB")} kWh/day median for this property and utility (${ratio.toFixed(1)}×)`,
      });
  }

  // Flags written by the extraction job (validation_flags), where the app doesn't already compute them.
  const SAME: Record<string, string> = { total_mismatch: "total_mismatch", property_unmatched: "unmatched_property", unmatched_property: "unmatched_property", missing_invoice_number: "missing_fields" };
  for (const raw of (inv.validation_flags ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    // The app re-checks these on the current values, so a corrected row stops showing them.
    if (SAME[raw]) continue;
    if (flags.some((f) => f.key === `pipeline:${raw}`)) continue;
    const label = PIPELINE_LABEL[raw] ?? raw.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
    flags.push({ key: `pipeline:${raw}`, label, detail: `Extraction check: ${label.toLowerCase()}` });
  }
  if (inv.document_type && inv.document_type !== "invoice" && inv.document_type !== "credit_note" && !flags.some((f) => /document|invoice/.test(f.key)))
    flags.push({ key: "pipeline:document_type", label: "Not an invoice?", detail: `Document classified as ${inv.document_type}` });

  return flags;
}
