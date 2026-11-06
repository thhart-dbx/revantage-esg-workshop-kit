# Utility invoice QA app (UJ2, Module 6 reference)

Next.js (App Router, TypeScript, shadcn/ui) on Databricks Apps. In the workshop you deploy it from your Git folder (Module 0, source path `code/app-invoice-qa`).

- `/`: QA queue over `INVOICES_TABLE` (default `ref_invoices_extracted`) with filters (status, received
  date, supplier, utility, property, flagged) and flags (missing fields, total ≠ net + VAT with whole-unit
  rounding for SEK/CZK, unmatched property, unusual kWh/day vs the property/utility median, plus the
  extraction job's `validation_flags`).
- `/invoices/<id>`: the PDF/JPG (streamed from the volume via the Files API through
  `/api/invoices/<id>/pdf`) beside an editable form. Save → INSERT one `CORRECTIONS_TABLE` row per changed
  field + UPDATE the row (`Corrected`, `reviewed_by` = `x-forwarded-email`, `reviewed_at`). Approve as
  extracted, or Reject (one `field_name = 'document'` row). All SQL is parameterised; table names come
  from env vars and are validated.

Server code only (`src/lib/*.ts` import `server-only`): `databricks.ts` (warehouse), `files.ts` (Files API,
SP OAuth M2M or `DATABRICKS_TOKEN` locally), `invoices.ts` (queries + write-back), `flags.ts`.

## Local

`.env.local` (not committed): `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`,
`DATABRICKS_CATALOG`, `DATABRICKS_SCHEMA`, `DATABRICKS_PROFILE` (for the e2e SQL helper), and optionally
`QA_DATA_MODE=mock` (in-memory data + generated PDFs, no workspace needed). `npm run dev` serves on port 3001.

## Tests

`npx playwright test` (local) or with `BASE_URL=<app url> DATABRICKS_TOKEN=<token>` (deployed). The
write-back specs run serially on the desktop project against one Pending invoice received on/after
2026-10-21, check the rows in SQL (`e2e/db.ts`), then restore the invoice row and delete the
`[e2e]` corrections rows.
