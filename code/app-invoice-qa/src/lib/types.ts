// Shared types (client + server). Column names follow the workshop data contract (UJ2).

export const QA_STATUSES = ["Pending", "Approved", "Corrected", "Rejected"] as const;
export type QaStatus = (typeof QA_STATUSES)[number];

export const UTILITY_TYPES = ["electricity", "gas", "water", "district_heating"] as const;

export const DOCUMENT_TYPES = ["invoice", "credit_note", "reminder", "other"] as const;
export const READING_TYPES = ["actual", "estimated"] as const;

// Agreed with the invoice data-engineer (thread.md) so the QA errors dashboard groups cleanly.
export const ERROR_TYPES = [
  "wrong_value",
  "missing",
  "unit",
  "date_format",
  "currency",
  "not_an_invoice",
  "split_required",
  "other",
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

export type Invoice = {
  invoice_id: string;
  file_path: string;
  received_date: string | null; // yyyy-mm-dd
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  property_id: number | null;
  property_name: string | null;
  site_address: string | null;
  meter_id: string | null;
  utility_type: string | null;
  consumption: number | null;
  consumption_unit: string | null;
  consumption_kwh: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  amount_total: number | null;
  currency: string | null;
  extracted_at: string | null;
  document_type: string | null;
  reading_type: string | null;
  validation_flags: string | null; // comma-separated, set by the extraction job; NULL = clean
  qa_status: QaStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  // Peer baseline for the unusual-consumption flag: median kWh/day of the invoices for the same
  // property and utility type (peer_count includes this invoice).
  peer_kwh_per_day: number | null;
  peer_count: number;
};

export type FlagKey = "missing_fields" | "total_mismatch" | "unmatched_property" | "unusual_consumption" | `pipeline:${string}`;

export type Flag = { key: FlagKey; label: string; detail: string };

export type InvoiceWithFlags = Invoice & { flags: Flag[] };

export type Correction = {
  correction_id: string;
  invoice_id: string;
  field_name: string;
  extracted_value: string | null;
  corrected_value: string | null;
  error_type: string;
  comment: string | null;
  corrected_by: string;
  corrected_at: string;
};

export type Property = { property_id: number; property_name: string; city: string | null; country: string | null };

export type QueueFilters = {
  status?: string;
  from?: string;
  to?: string;
  supplier?: string;
  utility?: string;
  property?: string; // property_id, or "unmatched"
  flagged?: boolean;
};

// Fields the reviewer can edit, with how each is typed in SQL. Order = form order.
export const EDITABLE_FIELDS = [
  { name: "document_type", label: "Document type", kind: "string" },
  { name: "supplier_name", label: "Supplier", kind: "string" },
  { name: "invoice_number", label: "Invoice number", kind: "string" },
  { name: "invoice_date", label: "Invoice date", kind: "date" },
  { name: "billing_period_start", label: "Billing period start", kind: "date" },
  { name: "billing_period_end", label: "Billing period end", kind: "date" },
  { name: "property_id", label: "Property", kind: "int" },
  { name: "site_address", label: "Site address", kind: "string" },
  { name: "meter_id", label: "Meter ID", kind: "string" },
  { name: "utility_type", label: "Utility type", kind: "string" },
  { name: "consumption", label: "Consumption", kind: "double" },
  { name: "consumption_unit", label: "Unit", kind: "string" },
  { name: "consumption_kwh", label: "Consumption (kWh)", kind: "double" },
  { name: "reading_type", label: "Reading", kind: "string" },
  { name: "amount_net", label: "Net amount", kind: "decimal" },
  { name: "vat_amount", label: "VAT", kind: "decimal" },
  { name: "amount_total", label: "Total", kind: "decimal" },
  { name: "currency", label: "Currency", kind: "string" },
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number]["name"];

export type FieldChange = { field: EditableField; value: string | null; error_type: ErrorType; comment?: string };

export type ReviewRequest =
  | { action: "approve"; comment?: string }
  | { action: "save"; changes: FieldChange[] }
  | { action: "reject"; error_type?: ErrorType; comment: string };
