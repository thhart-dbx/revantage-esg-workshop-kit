import "server-only";
import { randomUUID } from "node:crypto";
import { config, isMock } from "./config";
import { query } from "./databricks";
import { computeFlags, kwhPerDay } from "./flags";
import { MOCK_PROPERTIES, mockStore } from "./mock-data";
import {
  EDITABLE_FIELDS,
  ERROR_TYPES,
  DOCUMENT_TYPES,
  READING_TYPES,
  UTILITY_TYPES,
  type Correction,
  type EditableField,
  type Invoice,
  type InvoiceWithFlags,
  type Property,
  type QaStatus,
  type QueueFilters,
  type ReviewRequest,
} from "./types";

// Data access for the QA app. Every statement is parameterised (:name markers); the only
// interpolated text is table names (validated in config.ts) and column names from the
// EDITABLE_FIELDS allow-list.

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- reads ----------

const SELECT_COLUMNS = `
  invoice_id, file_path, CAST(received_date AS STRING) AS received_date, supplier_name, invoice_number,
  CAST(invoice_date AS STRING) AS invoice_date,
  CAST(billing_period_start AS STRING) AS billing_period_start,
  CAST(billing_period_end AS STRING) AS billing_period_end,
  property_id, qa_property_name AS property_name, site_address, meter_id, utility_type,
  CAST(consumption AS DOUBLE) AS consumption, consumption_unit, CAST(consumption_kwh AS DOUBLE) AS consumption_kwh,
  CAST(amount_net AS DOUBLE) AS amount_net, CAST(vat_amount AS DOUBLE) AS vat_amount,
  CAST(amount_total AS DOUBLE) AS amount_total, currency,
  date_format(extracted_at, "yyyy-MM-dd'T'HH:mm:ss") AS extracted_at,
  document_type, reading_type, validation_flags,
  coalesce(qa_status, 'Pending') AS qa_status, reviewed_by,
  date_format(reviewed_at, "yyyy-MM-dd'T'HH:mm:ss") AS reviewed_at,
  peer_kwh_per_day, CAST(peer_count AS INT) AS peer_count`;

// Peer baseline = median kWh/day over the positive-consumption invoices for the same property and
// utility type (median, so one outlier doesn't make its normal neighbours look unusual).
function baseCte() {
  const c = config();
  return `
WITH base AS (
  SELECT i.*, p.property_name AS qa_property_name,
    CASE WHEN i.consumption_kwh > 0 AND datediff(i.billing_period_end, i.billing_period_start) >= 0
         THEN i.consumption_kwh / (datediff(i.billing_period_end, i.billing_period_start) + 1) END AS kpd
  FROM ${c.invoicesTable} i
  LEFT JOIN ${c.propertiesTable} p ON i.property_id = p.property_id
), peer AS (
  SELECT *,
    median(kpd) OVER w AS peer_kwh_per_day,
    count(kpd) OVER w AS peer_count
  FROM base
  WINDOW w AS (PARTITION BY property_id, utility_type)
)`;
}

function withFlags(inv: Invoice): InvoiceWithFlags {
  return { ...inv, flags: computeFlags(inv) };
}

function mockPeers(all: Invoice[]): Invoice[] {
  return all.map((inv) => {
    const peers = all
      .filter((o) => o.property_id === inv.property_id && o.utility_type === inv.utility_type)
      .map(kwhPerDay)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);
    const mid = Math.floor(peers.length / 2);
    const median = peers.length ? (peers.length % 2 ? peers[mid] : (peers[mid - 1] + peers[mid]) / 2) : null;
    return {
      ...inv,
      property_name: MOCK_PROPERTIES.find((p) => p.property_id === inv.property_id)?.property_name ?? null,
      peer_kwh_per_day: median,
      peer_count: peers.length,
    };
  });
}

export async function listInvoices(f: QueueFilters): Promise<InvoiceWithFlags[]> {
  let rows: Invoice[];
  if (isMock()) {
    rows = mockPeers(mockStore().invoices).filter(
      (r) =>
        (!f.status || r.qa_status === f.status) &&
        (!f.from || (r.received_date ?? "") >= f.from) &&
        (!f.to || (r.received_date ?? "") <= f.to) &&
        (!f.supplier || r.supplier_name === f.supplier) &&
        (!f.utility || r.utility_type === f.utility) &&
        (!f.property || (f.property === "unmatched" ? r.property_id == null : String(r.property_id) === f.property)),
    );
    rows.sort((a, b) => (b.received_date ?? "").localeCompare(a.received_date ?? "") || a.invoice_id.localeCompare(b.invoice_id));
  } else {
    rows = await query<Invoice>(
      `${baseCte()}
SELECT ${SELECT_COLUMNS} FROM peer
WHERE (:status = '' OR coalesce(qa_status, 'Pending') = :status)
  AND (:from_date = '' OR received_date >= try_cast(:from_date AS DATE))
  AND (:to_date = '' OR received_date <= try_cast(:to_date AS DATE))
  AND (:supplier = '' OR supplier_name = :supplier)
  AND (:utility = '' OR utility_type = :utility)
  AND (:property = '' OR (:property = 'unmatched' AND property_id IS NULL) OR CAST(property_id AS STRING) = :property)
ORDER BY received_date DESC, invoice_id`,
      {
        status: f.status ?? "",
        from_date: f.from ?? "",
        to_date: f.to ?? "",
        supplier: f.supplier ?? "",
        utility: f.utility ?? "",
        property: f.property ?? "",
      },
    );
  }
  const out = rows.map(withFlags);
  return f.flagged ? out.filter((r) => r.flags.length > 0) : out;
}

export async function getInvoice(id: string): Promise<InvoiceWithFlags | null> {
  if (isMock()) {
    const inv = mockPeers(mockStore().invoices).find((r) => r.invoice_id === id);
    return inv ? withFlags(inv) : null;
  }
  const rows = await query<Invoice>(`${baseCte()}\nSELECT ${SELECT_COLUMNS} FROM peer WHERE invoice_id = :id`, { id });
  return rows[0] ? withFlags(rows[0]) : null;
}

export async function listCorrections(id: string): Promise<Correction[]> {
  if (isMock()) return mockStore().corrections.filter((c) => c.invoice_id === id).sort((a, b) => b.corrected_at.localeCompare(a.corrected_at));
  const c = config();
  return query<Correction>(
    `SELECT correction_id, invoice_id, field_name, extracted_value, corrected_value, error_type, comment, corrected_by,
            date_format(corrected_at, "yyyy-MM-dd'T'HH:mm:ss") AS corrected_at
     FROM ${c.correctionsTable} WHERE invoice_id = :id ORDER BY corrected_at DESC, field_name`,
    { id },
  );
}

export async function listProperties(): Promise<Property[]> {
  if (isMock()) return MOCK_PROPERTIES;
  const c = config();
  return query<Property>(`SELECT property_id, property_name, city, country FROM ${c.propertiesTable} ORDER BY property_id`);
}

export async function listSuppliers(): Promise<string[]> {
  if (isMock()) return [...new Set(mockStore().invoices.map((r) => r.supplier_name).filter((s): s is string => !!s))].sort();
  const c = config();
  const rows = await query<{ supplier_name: string }>(
    `SELECT DISTINCT supplier_name FROM ${c.invoicesTable} WHERE supplier_name IS NOT NULL ORDER BY supplier_name`,
  );
  return rows.map((r) => r.supplier_name);
}

// ---------- writes ----------

const FIELD = new Map(EDITABLE_FIELDS.map((f) => [f.name as string, f]));
const SQL_TYPE = { string: "STRING", date: "DATE", int: "INT", double: "DOUBLE", decimal: "DECIMAL(14,2)" } as const;

/** Normalise a submitted value to the canonical string form we store/compare, or throw 400. */
function normalise(field: EditableField, raw: string | null): string | null {
  const def = FIELD.get(field)!;
  const v = raw == null ? "" : String(raw).trim();
  if (v === "") return null;
  switch (def.kind) {
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new HttpError(400, `${def.label}: use YYYY-MM-DD`);
      return v;
    case "int":
      if (!/^-?\d+$/.test(v)) throw new HttpError(400, `${def.label}: must be a whole number`);
      return String(parseInt(v, 10));
    case "double":
    case "decimal": {
      const n = Number(v.replace(/\s/g, ""));
      if (!Number.isFinite(n)) throw new HttpError(400, `${def.label}: must be a number (use . as decimal separator)`);
      return def.kind === "decimal" ? n.toFixed(2) : String(n);
    }
    default:
      if (field === "utility_type" && !(UTILITY_TYPES as readonly string[]).includes(v))
        throw new HttpError(400, `Utility type must be one of ${UTILITY_TYPES.join(", ")}`);
      if (field === "document_type" && !(DOCUMENT_TYPES as readonly string[]).includes(v))
        throw new HttpError(400, `Document type must be one of ${DOCUMENT_TYPES.join(", ")}`);
      if (field === "reading_type" && !(READING_TYPES as readonly string[]).includes(v))
        throw new HttpError(400, `Reading must be one of ${READING_TYPES.join(", ")}`);
      if (field === "currency" && !/^[A-Z]{3}$/.test(v)) throw new HttpError(400, "Currency: 3-letter ISO code, e.g. EUR");
      return v;
  }
}

function currentValue(inv: Invoice, field: EditableField): string | null {
  const v = inv[field];
  if (v == null || v === "") return null;
  const kind = FIELD.get(field)!.kind;
  if (kind === "decimal") return Number(v).toFixed(2);
  return String(v);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !/DELTA_CONCURRENT|ConcurrentAppend|ConcurrentModification/.test(String((e as Error)?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 500 * i + Math.random() * 500));
    }
  }
}

export type ReviewResult = { invoice: InvoiceWithFlags; corrections: Correction[]; changed: string[] };

export async function review(id: string, req: ReviewRequest, user: string): Promise<ReviewResult> {
  const inv = await getInvoice(id);
  if (!inv) throw new HttpError(404, `Invoice ${id} not found`);

  type Row = { field_name: string; extracted_value: string | null; corrected_value: string | null; error_type: string; comment: string | null };
  const corrections: Row[] = [];
  const updates: { field: EditableField; value: string | null }[] = [];
  let status: QaStatus;

  if (req.action === "approve") {
    status = "Approved";
  } else if (req.action === "reject") {
    const comment = (req.comment ?? "").trim();
    if (!comment) throw new HttpError(400, "Add a comment explaining why the document is rejected");
    const et = req.error_type ?? "not_an_invoice";
    if (!(ERROR_TYPES as readonly string[]).includes(et)) throw new HttpError(400, "Unknown error type");
    status = "Rejected";
    // Same shape as the seeded history (code/invoices/sql/seed_qa_history.sql): a whole-document decision.
    corrections.push({ field_name: "document", extracted_value: inv.document_type ?? "invoice", corrected_value: "rejected", error_type: et, comment });
  } else if (req.action === "save") {
    for (const ch of req.changes ?? []) {
      if (!FIELD.has(ch.field)) throw new HttpError(400, `Field ${ch.field} can't be edited`);
      if (!(ERROR_TYPES as readonly string[]).includes(ch.error_type)) throw new HttpError(400, `Pick an error type for ${FIELD.get(ch.field)!.label}`);
      const next = normalise(ch.field, ch.value);
      const prev = currentValue(inv, ch.field);
      if (next === prev) continue;
      updates.push({ field: ch.field, value: next });
      corrections.push({ field_name: ch.field, extracted_value: prev, corrected_value: next, error_type: ch.error_type, comment: ch.comment?.trim() || null });
    }
    if (updates.length === 0) throw new HttpError(400, "No field changed: use Approve to accept the extraction as is");
    status = "Corrected";
  } else {
    throw new HttpError(400, "Unknown action");
  }

  if (isMock()) {
    const store = mockStore();
    const row = store.invoices.find((r) => r.invoice_id === id)!;
    const now = new Date().toISOString().slice(0, 19);
    for (const u of updates) {
      const kind = FIELD.get(u.field)!.kind;
      (row as Record<string, unknown>)[u.field] = u.value == null ? null : kind === "string" || kind === "date" ? u.value : Number(u.value);
    }
    Object.assign(row, { qa_status: status, reviewed_by: user, reviewed_at: now });
    for (const c of corrections)
      store.corrections.push({ correction_id: randomUUID(), invoice_id: id, ...c, corrected_by: user, corrected_at: now });
  } else {
    const c = config();
    const params: Record<string, string | null> = { id, user, status };
    const sets = updates.map((u, i) => {
      params[`v${i}`] = u.value;
      return `${u.field} = CAST(:v${i} AS ${SQL_TYPE[FIELD.get(u.field)!.kind]})`;
    });
    sets.push("qa_status = :status", "reviewed_by = :user", "reviewed_at = current_timestamp()");
    // UPDATE first (retried on Delta write conflicts with other writers, e.g. a pipeline run), then the
    // corrections INSERT (a blind append never conflicts), so a retry can't duplicate corrections.
    await withRetry(() => query(`UPDATE ${c.invoicesTable} SET ${sets.join(", ")} WHERE invoice_id = :id`, params));
    if (corrections.length) {
      const params: Record<string, string | null> = { id, user, received: inv.received_date };
      const values = corrections.map((r, i) => {
        Object.assign(params, { [`u${i}`]: randomUUID(), [`f${i}`]: r.field_name, [`o${i}`]: r.extracted_value, [`n${i}`]: r.corrected_value, [`e${i}`]: r.error_type, [`c${i}`]: r.comment });
        return `(:u${i}, :id, :f${i}, CAST(:o${i} AS STRING), CAST(:n${i} AS STRING), :e${i}, CAST(:c${i} AS STRING), :user, current_timestamp(), CAST(:received AS DATE))`;
      });
      await withRetry(() => query(
        `INSERT INTO ${c.correctionsTable}
           (correction_id, invoice_id, field_name, extracted_value, corrected_value, error_type, comment, corrected_by, corrected_at, received_date)
         VALUES ${values.join(",\n")}`,
        params,
      ));
    }
  }

  return { invoice: (await getInvoice(id))!, corrections: await listCorrections(id), changed: updates.map((u) => u.field) };
}
