"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, FileText, History, Save, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { date, dateTime, money, UTILITY_LABEL } from "@/lib/format";
import {
  EDITABLE_FIELDS,
  ERROR_TYPES,
  DOCUMENT_TYPES,
  READING_TYPES,
  UTILITY_TYPES,
  type Correction,
  type EditableField,
  type ErrorType,
  type InvoiceWithFlags,
  type Property,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Values = Record<EditableField, string>;

const ERROR_LABEL: Record<ErrorType, string> = {
  wrong_value: "Wrong value",
  missing: "Missing",
  unit: "Unit",
  date_format: "Date format",
  currency: "Currency",
  not_an_invoice: "Not an invoice",
  split_required: "Split required",
  other: "Other",
};

// Which form fields each flag points at (highlighted in the form).
const FLAG_FIELDS: Record<string, EditableField[]> = {
  missing_fields: [],
  total_mismatch: ["amount_net", "vat_amount", "amount_total"],
  unmatched_property: ["property_id"],
  unusual_consumption: ["consumption", "consumption_unit", "consumption_kwh"],
};

function toValues(inv: InvoiceWithFlags): Values {
  return Object.fromEntries(EDITABLE_FIELDS.map((f) => [f.name, inv[f.name] == null ? "" : String(inv[f.name])])) as Values;
}

// Keep consumption_kwh in step when the reviewer fixes consumption or its unit (kWh / MWh / GJ;
// m³ needs a calorific value, so the reviewer enters kWh by hand).
function withKwh(values: Values, field: EditableField, value: string): Values {
  const next = { ...values, [field]: value };
  if (field !== "consumption" && field !== "consumption_unit") return next;
  const n = Number(next.consumption);
  const unit = next.consumption_unit.trim().toLowerCase();
  if (next.consumption.trim() === "" || !Number.isFinite(n)) return next;
  if (unit === "kwh") next.consumption_kwh = String(n);
  else if (unit === "mwh") next.consumption_kwh = String(Math.round(n * 1000 * 1000) / 1000);
  else if (unit === "gj") next.consumption_kwh = String(Math.round(n * 277.78 * 1000) / 1000);
  return next;
}

function defaultErrorType(field: EditableField, before: string): ErrorType {
  if (!before) return "missing";
  if (field === "consumption_unit" || field === "consumption_kwh") return "unit";
  if (field.endsWith("_date") || field.startsWith("billing_period")) return "date_format";
  if (field === "currency") return "currency";
  return "wrong_value";
}

export function ReviewView() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = decodeURIComponent(id);
  const [inv, setInv] = useState<InvoiceWithFlags | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [initial, setInitial] = useState<Values | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [errorTypes, setErrorTypes] = useState<Partial<Record<EditableField, ErrorType>>>({});
  const [comments, setComments] = useState<Partial<Record<EditableField, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectType, setRejectType] = useState<ErrorType>("not_an_invoice");
  const [nextId, setNextId] = useState<string | null>(null);

  const apply = useCallback((invoice: InvoiceWithFlags, corr: Correction[]) => {
    setInv(invoice);
    setCorrections(corr);
    const v = toValues(invoice);
    setInitial(v);
    setValues(v);
    setErrorTypes({});
    setComments({});
  }, []);

  useEffect(() => {
    fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? r.statusText);
        apply(body.invoice, body.corrections);
      })
      .catch((e) => setLoadError(String(e.message ?? e)));
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => setProperties(m.properties ?? []))
      .catch(() => {});
  }, [invoiceId, apply]);

  useEffect(() => {
    fetch("/api/invoices?status=Pending")
      .then((r) => r.json())
      .then((b) => setNextId((b.invoices as InvoiceWithFlags[] | undefined)?.find((r) => r.invoice_id !== invoiceId)?.invoice_id ?? null))
      .catch(() => {});
  }, [invoiceId, inv?.qa_status]);

  const changed = useMemo(
    () => (values && initial ? EDITABLE_FIELDS.filter((f) => values[f.name].trim() !== initial[f.name].trim()).map((f) => f.name) : []),
    [values, initial],
  );

  const flaggedFields = useMemo(() => {
    const s = new Set<EditableField>();
    for (const f of inv?.flags ?? []) for (const k of FLAG_FIELDS[f.key] ?? []) s.add(k);
    if (inv) for (const f of EDITABLE_FIELDS) if (inv[f.name] == null && f.name !== "consumption_kwh") s.add(f.name);
    return s;
  }, [inv]);

  async function submit(body: unknown, label: string) {
    setBusy(label);
    try {
      const r = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error ?? r.statusText);
      apply(res.invoice, res.corrections);
      return res as { changed: string[] };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!values || !initial) return;
    const changes = changed.map((field) => ({
      field,
      value: values[field],
      error_type: errorTypes[field] ?? defaultErrorType(field, initial[field]),
      comment: comments[field] ?? "",
    }));
    const res = await submit({ action: "save", changes }, "save");
    if (res) toast.success(`Saved ${res.changed.length} correction${res.changed.length === 1 ? "" : "s"}: status Corrected`);
  }

  async function approve() {
    const res = await submit({ action: "approve" }, "approve");
    if (res) toast.success("Approved as extracted");
  }

  async function reject() {
    const res = await submit({ action: "reject", error_type: rejectType, comment: rejectReason }, "reject");
    if (res) {
      toast.success("Document rejected");
      setRejectOpen(false);
      setRejectReason("");
    }
  }

  if (loadError)
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent role="alert" className="text-destructive">{loadError}</CardContent>
        </Card>
      </div>
    );

  if (!inv || !values || !initial)
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[70vh]" />
          <Skeleton className="h-[70vh]" />
        </div>
      </div>
    );

  const pdfUrl = `/api/invoices/${encodeURIComponent(invoiceId)}/pdf`;
  const sum = (Number(values.amount_net) || 0) + (Number(values.vat_amount) || 0);
  const totalOk = values.amount_total !== "" && Math.abs(sum - Number(values.amount_total)) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink />
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
              {inv.supplier_name ?? "Unknown supplier"} <StatusBadge status={inv.qa_status} />
            </h1>
            <p className="text-xs text-muted-foreground">
              {inv.invoice_id} · received {date(inv.received_date)} · extracted {dateTime(inv.extracted_at)}
              {inv.reviewed_by && <> · reviewed by {inv.reviewed_by} {dateTime(inv.reviewed_at)}</>}
            </p>
          </div>
        </div>
        {nextId && (
          <Link href={`/invoices/${encodeURIComponent(nextId)}`} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="next-invoice">
            Next to review
          </Link>
        )}
      </div>

      {inv.flags.length > 0 && (
        <div data-testid="flag-panel" className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" /> Check before approving
          </div>
          <ul className="ml-6 list-disc space-y-0.5">
            {inv.flags.map((f) => (
              <li key={f.key} data-flag={f.key}>
                <span className="font-medium">{f.label}:</span> {f.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 truncate text-muted-foreground">
              <FileText className="size-4 shrink-0" /> <span className="truncate" title={inv.file_path}>{inv.file_path.split("/").pop()}</span>
            </span>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Open <ExternalLink />
            </a>
          </div>
          {/\.(jpe?g|png)$/i.test(inv.file_path) ? (
            <div className="h-[55vh] overflow-auto bg-muted lg:h-[calc(100vh-14rem)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-testid="pdf-frame" src={pdfUrl} alt={`Scanned invoice ${inv.invoice_id}`} className="mx-auto max-w-full" />
            </div>
          ) : (
            <iframe data-testid="pdf-frame" title="Invoice PDF" src={pdfUrl} className="h-[55vh] w-full bg-muted lg:h-[calc(100vh-14rem)]" />
          )}
        </Card>

        <Card className="lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
          <CardHeader>
            <CardTitle>Extracted fields</CardTitle>
            <CardDescription>
              Edit any field that doesn&apos;t match the PDF. Changed fields need an error type; each one is written to the corrections log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (changed.length) save();
              }}
            >
              {EDITABLE_FIELDS.map((f) => {
                const isChanged = changed.includes(f.name);
                const flagged = flaggedFields.has(f.name);
                const id = `field-${f.name}`;
                const common = {
                  id,
                  name: f.name,
                  value: values[f.name],
                  "aria-invalid": flagged && !isChanged ? true : undefined,
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues(withKwh(values, f.name, e.target.value)),
                };
                const wide = f.name === "site_address" || f.name === "supplier_name";
                return (
                  <div key={f.name} className={cn("space-y-1.5 rounded-lg", wide && "sm:col-span-2", isChanged && "bg-sky-50 p-2 ring-1 ring-sky-300 dark:bg-sky-950/30 dark:ring-sky-800")}>
                    <Label htmlFor={id} className="flex items-center gap-1.5 text-xs">
                      {f.label}
                      {flagged && !isChanged && <AlertTriangle className="size-3 text-orange-600" aria-label="flagged" />}
                    </Label>
                    {f.name === "property_id" ? (
                      <NativeSelect {...common} className="w-full">
                        <NativeSelectOption value="">Unmatched</NativeSelectOption>
                        {properties.map((p) => (
                          <NativeSelectOption key={p.property_id} value={String(p.property_id)}>
                            {p.property_id} · {p.property_name} ({p.city})
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : f.name === "document_type" || f.name === "reading_type" ? (
                      <NativeSelect {...common} className="w-full">
                        <NativeSelectOption value="">—</NativeSelectOption>
                        {(f.name === "document_type" ? DOCUMENT_TYPES : READING_TYPES).map((u) => (
                          <NativeSelectOption key={u} value={u}>{u.replace("_", " ")}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : f.name === "utility_type" ? (
                      <NativeSelect {...common} className="w-full">
                        <NativeSelectOption value="">—</NativeSelectOption>
                        {UTILITY_TYPES.map((u) => (
                          <NativeSelectOption key={u} value={u}>{UTILITY_LABEL[u]}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        {...common}
                        type={f.kind === "date" ? "date" : "text"}
                        inputMode={f.kind === "double" || f.kind === "decimal" ? "decimal" : undefined}
                        className={cn(f.kind !== "string" && "tabular-nums")}
                      />
                    )}
                    {isChanged && (
                      <div className="space-y-1.5" data-testid={`change-${f.name}`}>
                        <div className="text-xs text-muted-foreground">
                          Extracted: <span className="font-mono">{initial[f.name] || "(empty)"}</span>
                        </div>
                        <div className="flex gap-2">
                          <NativeSelect
                            aria-label={`Error type for ${f.label}`}
                            size="sm"
                            className="w-40 shrink-0"
                            value={errorTypes[f.name] ?? defaultErrorType(f.name, initial[f.name])}
                            onChange={(e) => setErrorTypes({ ...errorTypes, [f.name]: e.target.value as ErrorType })}
                          >
                            {ERROR_TYPES.filter((t) => t !== "not_an_invoice").map((t) => (
                              <NativeSelectOption key={t} value={t}>{ERROR_LABEL[t]}</NativeSelectOption>
                            ))}
                          </NativeSelect>
                          <Input
                            aria-label={`Comment for ${f.label}`}
                            placeholder="Comment (optional)"
                            className="h-7"
                            value={comments[f.name] ?? ""}
                            onChange={(e) => setComments({ ...comments, [f.name]: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className={cn("sm:col-span-2 text-xs", totalOk ? "text-muted-foreground" : "text-orange-700 dark:text-orange-300")} data-testid="total-check">
                Net + VAT = {money(sum, values.currency || inv.currency)} {totalOk ? "matches the total" : `vs total ${money(Number(values.amount_total) || null, values.currency || inv.currency)}`}
              </div>
              <button type="submit" hidden />
            </form>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={!changed.length || !!busy} data-testid="save">
                <Save /> {busy === "save" ? "Saving…" : `Save ${changed.length || ""} correction${changed.length === 1 ? "" : "s"}`}
              </Button>
              <Button variant="secondary" onClick={approve} disabled={changed.length > 0 || !!busy} data-testid="approve">
                <Check /> {busy === "approve" ? "Approving…" : "Approve as extracted"}
              </Button>
              {changed.length > 0 && (
                <Button variant="ghost" onClick={() => setValues(initial)} disabled={!!busy}>
                  <Undo2 /> Undo edits
                </Button>
              )}
              <Button variant="destructive" className="ml-auto" onClick={() => setRejectOpen(true)} disabled={!!busy} data-testid="reject">
                <X /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> Corrections log
          </CardTitle>
          <CardDescription>Every field a reviewer changed on this invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          {corrections.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="no-corrections">No corrections yet.</p>
          ) : (
            <ul className="divide-y text-sm" data-testid="corrections">
              {corrections.map((c) => (
                <li key={c.correction_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2" data-testid="correction-row" data-field={c.field_name}>
                  <span className="font-medium">{c.field_name === "document" ? "Document" : (EDITABLE_FIELDS.find((f) => f.name === c.field_name)?.label ?? c.field_name)}</span>
                  <span className="font-mono text-xs">
                    <span className="text-muted-foreground line-through">{c.extracted_value ?? "(empty)"}</span> → {c.corrected_value ?? "(empty)"}
                  </span>
                  <span className="rounded bg-muted px-1.5 text-xs">{ERROR_LABEL[c.error_type as ErrorType] ?? c.error_type}</span>
                  {c.comment && <span className="text-muted-foreground">“{c.comment}”</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {c.corrected_by} · {dateTime(c.corrected_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this document?</DialogTitle>
            <DialogDescription>Use this for documents that aren&apos;t a usable invoice (a reminder letter, a duplicate, an unreadable scan). The reason is logged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reject-type">Reason</Label>
              <NativeSelect id="reject-type" className="w-full" value={rejectType} onChange={(e) => setRejectType(e.target.value as ErrorType)}>
                <NativeSelectOption value="not_an_invoice">Not an invoice</NativeSelectOption>
                <NativeSelectOption value="split_required">Two invoices in one file (split required)</NativeSelectOption>
                <NativeSelectOption value="other">Other (duplicate, unreadable…)</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reject-comment">Comment</Label>
              <Textarea id="reject-comment" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Payment reminder for invoice CR-0921-77310, not a new invoice" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim() || !!busy} data-testid="confirm-reject">
              {busy === "reject" ? "Rejecting…" : "Reject document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}

function BackLink() {
  return (
    <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="back-to-queue">
      <ArrowLeft /> Queue
    </Link>
  );
}
