"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCheck, ChevronRight, FilterX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlagBadges, StatusBadge } from "@/components/status-badge";
import { date, money, num, UTILITY_LABEL } from "@/lib/format";
import { QA_STATUSES, UTILITY_TYPES, type InvoiceWithFlags, type Property } from "@/lib/types";
import { cn } from "@/lib/utils";

type Meta = { properties: Property[]; suppliers: string[]; user: string; mode: "mock" | "sql" };

const FILTER_KEYS = ["status", "from", "to", "supplier", "utility", "property", "flagged"] as const;

export function QueueView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // Default view = the work queue (Pending). "all" shows every status.
  const status = sp.get("status") ?? "Pending";
  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) ?? ""])), [sp]);

  const [meta, setMeta] = useState<Meta | null>(null);
  // Results are stored with the query they answer, so a filter change shows the skeleton until
  // the matching response arrives (no setState-in-effect reset).
  const [data, setData] = useState<{ key: string; rows: InvoiceWithFlags[]; all: InvoiceWithFlags[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => (m.error ? setError(m.error) : setMeta(m)))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const base = new URLSearchParams();
    for (const k of ["from", "to", "supplier", "utility", "property"] as const) if (filters[k]) base.set(k, filters[k]);
    const withStatus = new URLSearchParams(base);
    if (status !== "all") withStatus.set("status", status);
    if (filters.flagged) withStatus.set("flagged", "1");
    const key = `${withStatus}|${base}|${tick}`;
    let cancelled = false;
    Promise.all([
      fetch(`/api/invoices?${withStatus}`).then((r) => r.json()),
      fetch(`/api/invoices?${base}`).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        if (a.error || b.error) return setError(a.error ?? b.error);
        setError(null);
        setData({ key, rows: a.invoices, all: b.invoices });
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [filters, status, tick]);

  const currentKey = useMemo(() => {
    const base = new URLSearchParams();
    for (const k of ["from", "to", "supplier", "utility", "property"] as const) if (filters[k]) base.set(k, filters[k]);
    const withStatus = new URLSearchParams(base);
    if (status !== "all") withStatus.set("status", status);
    if (filters.flagged) withStatus.set("flagged", "1");
    return `${withStatus}|${base}|${tick}`;
  }, [filters, status, tick]);
  const rows = data?.key === currentKey ? data.rows : null;
  const all = data?.key === currentKey ? data.all : null;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { Pending: 0, Approved: 0, Corrected: 0, Rejected: 0, flagged: 0 };
    for (const r of all ?? []) {
      c[r.qa_status] = (c[r.qa_status] ?? 0) + 1;
      if (r.qa_status === "Pending" && r.flags.length) c.flagged++;
    }
    return c;
  }, [all]);

  const cards = [
    { key: "Pending", label: "Needs review", value: counts.Pending, hint: `${counts.flagged} flagged`, onClick: () => setParam("status", "") },
    { key: "Corrected", label: "Corrected", value: counts.Corrected, onClick: () => setParam("status", "Corrected") },
    { key: "Approved", label: "Approved", value: counts.Approved, onClick: () => setParam("status", "Approved") },
    { key: "Rejected", label: "Rejected", value: counts.Rejected, onClick: () => setParam("status", "Rejected") },
  ];

  const clean = (rows ?? []).filter((r) => r.qa_status === "Pending" && r.flags.length === 0);

  // Approve every clean Pending invoice in the current view, one at a time (parallel UPDATEs on the
  // same Delta table conflict), through the same review API the review page uses.
  async function approveAllClean() {
    if (!clean.length || !window.confirm(`Approve ${clean.length} clean invoice${clean.length === 1 ? "" : "s"} as extracted?`)) return;
    let ok = 0;
    let failed = 0;
    for (const [i, r] of clean.entries()) {
      setBulk({ done: i, total: clean.length });
      try {
        const res = await fetch(`/api/invoices/${encodeURIComponent(r.invoice_id)}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulk(null);
    if (failed) toast.error(`Approved ${ok} invoice${ok === 1 ? "" : "s"}, ${failed} failed`);
    else toast.success(`Approved ${ok} clean invoice${ok === 1 ? "" : "s"}`);
    setTick((t) => t + 1);
  }

  const hasFilters = FILTER_KEYS.some((k) => k !== "status" && filters[k]) || sp.has("status");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoice QA queue</h1>
          <p className="text-sm text-muted-foreground">
            Utility invoices extracted by <code className="rounded bg-muted px-1">ai_extract</code> on arrival. Review the flagged
            fields against the PDF, correct them, and every change is logged.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {meta?.mode === "mock" && <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Mock data</span>}
          {meta && <span data-testid="current-user">Signed in as {meta.user}</span>}
          <Button size="sm" onClick={approveAllClean} disabled={!clean.length || !!bulk} data-testid="approve-all-clean">
            <CheckCheck />
            {bulk ? `Approving ${bulk.done + 1}/${bulk.total}…` : `Approve ${clean.length} clean`}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button key={c.key} onClick={c.onClick} className="text-left" data-testid={`card-${c.key}`}>
            <Card className={cn("transition-shadow hover:shadow-md", status === c.key && "ring-2 ring-primary")}>
              <CardContent className="space-y-1">
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="text-3xl font-semibold tabular-nums">{all ? c.value : <Skeleton className="h-9 w-12" />}</div>
                {c.hint && (
                  <div className="flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="size-3" /> {c.hint}
                  </div>
                )}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Field label="Status" id="f-status">
            <NativeSelect id="f-status" className="w-full" value={status} onChange={(e) => setParam("status", e.target.value === "Pending" ? "" : e.target.value)}>
              {QA_STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
              ))}
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Received from" id="f-from">
            <Input id="f-from" type="date" value={filters.from} onChange={(e) => setParam("from", e.target.value)} />
          </Field>
          <Field label="Received to" id="f-to">
            <Input id="f-to" type="date" value={filters.to} onChange={(e) => setParam("to", e.target.value)} />
          </Field>
          <Field label="Supplier" id="f-supplier">
            <NativeSelect id="f-supplier" className="w-full" value={filters.supplier} onChange={(e) => setParam("supplier", e.target.value)}>
              <NativeSelectOption value="">All suppliers</NativeSelectOption>
              {meta?.suppliers.map((s) => (
                <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Utility" id="f-utility">
            <NativeSelect id="f-utility" className="w-full" value={filters.utility} onChange={(e) => setParam("utility", e.target.value)}>
              <NativeSelectOption value="">All utilities</NativeSelectOption>
              {UTILITY_TYPES.map((u) => (
                <NativeSelectOption key={u} value={u}>{UTILITY_LABEL[u]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Property" id="f-property">
            <NativeSelect id="f-property" className="w-full" value={filters.property} onChange={(e) => setParam("property", e.target.value)}>
              <NativeSelectOption value="">All properties</NativeSelectOption>
              <NativeSelectOption value="unmatched">Unmatched</NativeSelectOption>
              {meta?.properties.map((p) => (
                <NativeSelectOption key={p.property_id} value={String(p.property_id)}>{p.property_name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Flags" id="f-flagged">
            <NativeSelect id="f-flagged" className="w-full" value={filters.flagged} onChange={(e) => setParam("flagged", e.target.value)}>
              <NativeSelectOption value="">All invoices</NativeSelectOption>
              <NativeSelectOption value="1">Flagged only</NativeSelectOption>
            </NativeSelect>
          </Field>
          {hasFilters && (
            <div className="col-span-full flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
                <FilterX /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="text-sm text-destructive" role="alert">
            Couldn&apos;t load invoices: {error}
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <Table data-testid="queue-table">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Received</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="hidden md:table-cell">Property</TableHead>
              <TableHead className="hidden lg:table-cell">Utility</TableHead>
              <TableHead className="hidden lg:table-cell">Invoice no.</TableHead>
              <TableHead className="hidden xl:table-cell text-right">Consumption</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows == null &&
              !error &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10} className="pl-4">
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  No invoices match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((r) => (
              <TableRow
                key={r.invoice_id}
                data-testid="queue-row"
                data-invoice-id={r.invoice_id}
                className="cursor-pointer"
                onClick={() => router.push(`/invoices/${encodeURIComponent(r.invoice_id)}`)}
              >
                <TableCell className="pl-4 whitespace-nowrap tabular-nums">{date(r.received_date)}</TableCell>
                <TableCell className="max-w-[14rem]">
                  <Link href={`/invoices/${encodeURIComponent(r.invoice_id)}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {r.supplier_name ?? <span className="italic text-muted-foreground">Unknown supplier</span>}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">{r.invoice_id}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell max-w-[12rem] truncate">
                  {r.property_name ?? <span className="text-orange-700 dark:text-orange-300">Unmatched</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{r.utility_type ? UTILITY_LABEL[r.utility_type] ?? r.utility_type : "—"}</TableCell>
                <TableCell className="hidden lg:table-cell font-mono text-xs">{r.invoice_number ?? <span className="text-orange-700 dark:text-orange-300">missing</span>}</TableCell>
                <TableCell className="hidden xl:table-cell text-right tabular-nums whitespace-nowrap">
                  {r.consumption == null ? "—" : `${num(r.consumption, 2)} ${r.consumption_unit ?? ""}`}
                </TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{money(r.amount_total, r.currency)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={r.qa_status} />
                </TableCell>
                <TableCell>
                  <FlagBadges flags={r.flags} compact />
                </TableCell>
                <TableCell className="pr-3 text-muted-foreground">
                  <ChevronRight className="size-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {rows && <p className="text-xs text-muted-foreground" data-testid="row-count">{rows.length} invoice{rows.length === 1 ? "" : "s"}</p>}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
