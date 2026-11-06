# Module 6: QA/QC app — "Your invoice QA app, your queue, one new feature"

**Session:** 11:35–11:50 (15 min) · **You build:** your copy of the invoice QA app (deployed in Module 0) pointed at a QA queue built from your Module 5 table, plus an **"Approve N clean"** bulk action added with Genie Code · **Reference:** app `revantage-invoice-qa` (Next.js + TypeScript, `code/app-invoice-qa/`) on `ref_invoices_extracted` + `ref_invoice_corrections`; the finished feature file `code/prompts/solutions/m06-queue-view.tsx`
**Starting state:** your app `invoice-qa-<your_name>` deployed from `<your Git folder>/code/app-invoice-qa` in Module 0 (resource `sql-warehouse`); your `<catalog>.<my_schema>.invoices_extracted` from Module 5 (34 rows, `qa_status = 'Pending'`, `file_path` in your volume `<my_schema>.utility_invoices`); `utility_meters`, `emission_factors`, `properties` in `<my_schema>` (Module 0); the facilitator has run `code/scripts/grant_participant_apps.py` (your app's service principal: `USE SCHEMA`, `SELECT`, `MODIFY`, `READ VOLUME` on `<my_schema>`)
**Where:** Workspace (your Git folder `revantage-esg-workshop-kit`: `code/invoices/sql/m06_qa_queue.sql` in the SQL file editor, `code/app-invoice-qa/app.yaml`, `code/app-invoice-qa/src/components/queue-view.tsx`) with Genie Code; Apps (your app page → **Deploy**)

In Module 0 your app went live on the reference queue (read-only). Your Module 5 table has the extracted fields but
not everything the QA app reads and writes (matched property, kWh, validation flags, reviewer columns), and its
incremental INSERT has no column list, so we don't add columns to it. Stage 1 builds a QA queue table next to it.

Expected numbers (fresh Module 5 run, measured 2026-11-05 on a scratch copy): **34** invoices, all Pending; **3** without a property match (`nl-elec-2026-09-noordzee-rotterdam`, `fr-elec-2026-10-rhone-fax`, `nl-water-2026-09-amstelwater-reminder`); the app flags **8** of them (total ≠ net + VAT on `es-elec-2026-08-castellana`, missing invoice number on `lu-water-2026-q3-vdleau`, the 3 unmatched, the credit note, …) and **26 are clean**. Your counts can differ by one or two (ai_extract varies slightly between runs).

## Stage 1: Build your QA queue and point the app at it (5 min)

Workspace → your Git folder → `code` → `invoices` → `sql` → open **`m06_qa_queue.sql`** (it opens in the SQL file editor, attached to `Serverless Starter Warehouse`). Change the one line `USE <catalog>.<my_schema>;` to your names (e.g. `USE <catalog>.revantage_20261105_jane_doe;`) → **Run** (▶, top left: it runs all 4 statements, ~10 s).
**Expected:** `invoices_qa` (34 rows) and an empty `invoice_corrections` in `<my_schema>`; the result grid: `invoices 34 · pending 34 · unmatched_property 3 · extraction_flags 5`.
Then Workspace → your Git folder → `code` → `app-invoice-qa` → **`app.yaml`**. Under `# ---- Workshop settings` change three values:
- `DATABRICKS_SCHEMA` → `<my_schema>`
- `INVOICES_TABLE` → `invoices_qa`
- `CORRECTIONS_TABLE` → `invoice_corrections`

Apps → your QA app → **Deploy** (after the first deployment it redeploys the same folder straight away, no dialog). About **1 min** (measured 63 s).
**Checkpoint:** the app shows **Needs review 34**, **8 flagged**, the Castellana Tower invoice with **Total ≠ net + VAT**; open any invoice: the PDF from *your* volume shows on the left.
**If stuck:** `[UNRESOLVED_COLUMN]` in `USE` / `TABLE_OR_VIEW_NOT_FOUND` → the USE line still has the placeholders. In the app, `UNRESOLVED_COLUMN … property_id` → `INVOICES_TABLE` still points at `invoices_extracted` (use `invoices_qa`). `PERMISSION_DENIED` / `INSUFFICIENT_PERMISSIONS` → ask the facilitator to re-run the grant script for your app. No Module 5 table? Run the Stage 3 block of `code/invoices/sql/m05_stage_solutions.sql` first (~2 min).

## Stage 2: "Approve all clean" with Genie Code (6 min)

Open `code/app-invoice-qa/src/components/queue-view.tsx`, then **Genie Code** → **New chat**:

**Prompt** (Genie Code, file editor):
> Edit only this file (queue-view.tsx, a Next.js client component with shadcn/ui). Add an "Approve N clean" button next to the Refresh button in the page header, where N is the number of rows currently shown with qa_status 'Pending' and no flags (r.flags.length === 0); disable it when N is 0. On click, ask for confirmation with window.confirm, then approve those invoices one at a time, not in parallel (parallel Delta updates conflict), by POSTing {"action":"approve"} as JSON to /api/invoices/<invoice_id>/review (encodeURIComponent the id), showing progress on the button ("Approving 3/26..."). Afterwards show a sonner toast with how many were approved and how many failed, and refresh the queue with setTick. Use the CheckCheck icon from lucide-react and add data-testid="approve-all-clean" to the button. Don't change anything else.

**Expected:** one edit: the `CheckCheck` and `toast` imports, a progress state, an `approveAllClean` function and the button (≈ 35 lines). Genie Code took ~1.5 min. **Accept all**, then **Deploy** (≈ 1 min).
**Checkpoint:** the header shows **Approve 26 clean** → click → **OK** → the button counts up (≈ 5 s per invoice: **~2 min** for 26, measured 127 s; talk through what "clean" means meanwhile) → toast **Approved 26 invoices** → the queue shows the **8** flagged invoices that need a human. In the SQL editor: `SELECT qa_status, count(*), max(reviewed_by) FROM <catalog>.<my_schema>.invoices_qa GROUP BY 1` → `Approved 26 <your email>`, `Pending 8`.
**Watch for:** the button text says **Approve 0 clean** while the queue is still loading; it's correct once the rows appear. Build failure → **Deployments** tab → paste the error into the same Genie Code chat.
**If stuck:** copy `code/prompts/solutions/m06-queue-view.tsx` over `code/app-invoice-qa/src/components/queue-view.tsx` and Deploy.

## Stage 3: Review what's left (4 min)

Open the Castellana Tower invoice (received 2026-09-02): the PDF shows a printed total of **14,302.32** but the extraction says **13,402.32** (a €900 gap). Correct `Total` (error type *Wrong value*) → **Save 1 correction** → status **Corrected**. Open the Amstelwater payment reminder (2026-09-30) → **Reject** → reason *Not an invoice*.
**Checkpoint:**
```sql
SELECT c.field_name, c.extracted_value, c.corrected_value, c.error_type, c.corrected_by
FROM <catalog>.<my_schema>.invoice_corrections c ORDER BY c.corrected_at DESC;
```
→ `amount_total 13402.32 → 14302.32 wrong_value <your email>` and `document … rejected not_an_invoice`. Module 7's dashboard reads exactly this kind of table.

## Wrap-up
- **So what:** ai_extract does the keying, the app approves the clean majority in one click, and people only look at the handful that need judgement; every correction is captured as data (field, error type, who, when).
- **Why Delta here (not Lakebase):** the corrections are analytical data the dashboard and the extraction scoring read directly, and the write volume is small; the survey app (Module 1) writes to Lakebase because it takes many small concurrent transactional writes.
- **Facilitator:** Stages 1–3 rehearsed on 2026-11-05 on a scratch copy (timings above: redeploy 63 s, Genie Code edit ~1.5 min, 26 approvals 127 s). Not tested with a non-admin participant.
