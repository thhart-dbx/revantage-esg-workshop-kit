# Module 5: ai_extract on arrival — "Drop an invoice, get a row"

**Session:** 10:50–11:15 (25 min) · **You build:** `<my_schema>.invoices_extracted` + a job that extracts every new invoice when it lands · **Reference:** table `<catalog>.<schema>.ref_invoices_extracted`, job "[Revantage ESG] Extract utility invoices (Reference)" (file-arrival trigger) and its fallback "[Revantage ESG] Extract utility invoices (Reference, 1-min poll fallback)"
**Starting state:** volume `<catalog>.<my_schema>.utility_invoices` with 34 invoices in 16 drop folders `incoming/2026-08-04/` … `incoming/2026-11-04/` (folder = received date), 5 more in `live_drop/`; tables `utility_meters` (28 meters), `emission_factors`, `properties` (10). Answer key: `<catalog>.<schema>.ref_invoice_ground_truth` (edge case + expected outcome per file).
**Where:** Catalog Explorer (volume), SQL editor with the Genie Code panel, Jobs & Pipelines

**Timing reality (measured 2026-11-05, serverless warehouse):** one file `ai_parse_document` + `ai_extract` ≈ 13–20 s; all 34 ≈ 50–90 s;
an incremental run with 1 new file ≈ 20–40 s. Start Stage 3 and talk while it runs.

## Stage 1: Look at the volume (3 min)

Catalog Explorer → `<catalog>` → `<my_schema>` → Volumes → `utility_invoices` → `incoming`. Open `2026-08-04/nl-elec-2026-07-noordzee.pdf` (preview), then `2026-11-03/fr-elec-2026-10-rhone-fax.pdf` (a fax) and `2026-11-02/se-heat-2026-10-fjarrvarme-photo.jpg` (a phone photo).

**Prompt** (Genie Code, SQL editor):
> List every file under /Volumes/<catalog>/<my_schema>/utility_invoices/incoming/ with read_files (binaryFile, recursive): the received date taken from the folder name, the file name and the size in bytes, ordered by received date.

**Expected:** **34 rows**, 2026-08-04 (de-heat-2026-07-fernwaerme.pdf, nl-elec-2026-07-noordzee.pdf) … 2026-11-04 (ie-gas, lu-gas). Nine languages, four currencies (EUR, CZK, SEK, PLN), electricity / gas / water / district heating.
**Watch for:** without `recursiveFileLookup => 'true'` read_files returns no columns (the folder only has sub-folders).
**Checkpoint:** the query above returns 34 rows.
**If stuck:** Stage 1 block of `code/invoices/sql/m05_stage_solutions.sql`.

## Stage 2: ai_extract one invoice (5 min)

**Prompt:**
> Run ai_parse_document and then ai_extract (version 2.0, with a JSON schema) on /Volumes/<catalog>/<my_schema>/utility_invoices/incoming/2026-08-04/nl-elec-2026-07-noordzee.pdf. Extract supplier_name, invoice_number, invoice_date (YYYY-MM-DD), consumption (number), consumption_unit, amount_total (number) and currency (ISO code).

**Expected:** one VARIANT `{"error_message":null,"metadata":{"version":"2.0"},"response":{...}}` with **Noordzee Energie B.V., NZE-2026-0718442, 2026-08-01, 48210, kWh, 15464.28, EUR**. The Dutch PDF prints `48.210 kWh` and `15.464,28 €`: ai_extract returns plain numbers.
**Watch for:** `ai_extract(content, …)` on the raw bytes doesn't fail, it returns `"error_message":"The input content is invalid."`. v2 needs the `ai_parse_document(content, map('version','2.0'))` output. The old form `ai_extract(text, array('total'))` returns strings like "USD 41,000.00".
**Checkpoint:** `extracted:response.amount_total` = 15464.28.
**If stuck:** Stage 2 block of `m05_stage_solutions.sql`.

## Stage 3: Every invoice into a table (5 min)

**Prompt:**
> Turn this into CREATE OR REPLACE TABLE <my_schema>.invoices_extracted over every file under incoming/ (recursive). One row per file: invoice_id (file name without extension), file_path, received_date (from the folder name, try_to_date), and typed columns from the response: document_type (enum invoice, credit_note, reminder, other), invoices_in_document (integer), supplier_name, invoice_number (not the customer number; null if none), invoice_date, billing_period_start, billing_period_end, meter_id (several separated by ;), utility_type (enum electricity, gas, water, district_heating), consumption (total of all meters), consumption_unit, amount_net, vat_amount, amount_total (this period only, without previous unpaid balances), currency (ISO). Keep the raw output as extraction_json and add extracted_at and qa_status = 'Pending'.

**Expected:** **34 rows** in ~50–90 s. The reference (a slightly longer schema with more descriptions) gets **576 of 596 fields right (96.6 %)**.
**Checkpoint:** `SELECT count(*) FROM <my_schema>.invoices_extracted` → 34.
**If stuck:** Stage 3 block of `m05_stage_solutions.sql`, or compare with `<catalog>.<schema>.ref_invoices_extracted`.

## Stage 4: The edge cases (5 min)

**Prompt:**
> Which rows in <my_schema>.invoices_extracted need a human? Flag document_type other than invoice, more than one invoice in the document, no invoice number, amount_net + vat_amount not equal to amount_total (tolerance 1), several meters, or missing consumption / total. Show invoice_id, the values and a needs_qa_because column.

**Expected (measured on the reference run, may vary by a row):** 7 rows: `it-elec-2026-07-lombardia` (several meters), `es-elec-2026-08-castellana` (13,402.32 printed ≠ base + IVA 14,302.32), `fr-gas-2026-08-gazlyon-avoir` (credit_note, −349.69), `nl-water-2026-09-amstelwater-reminder` (reminder), `fr-water-2026-07-08-eauxlyon-2in1` (invoices_in_document = 2), `lu-water-2026-q3-vdleau` (no invoice number), `fr-elec-2026-10-rhone-fax` (missing values).
Then the point of the module, from the answer key:
> Join <my_schema>.invoices_extracted to <catalog>.<schema>.ref_invoice_ground_truth on invoice_id and show, per invoice, edge_case, expected_outcome and where consumption or amount_total differ from the truth.

**Expected:** what ai_extract **handled** that we expected to break: credit note, ambiguous date 09/10/2026 (it read 9 Oct, correct), CZK + EUR columns, arrears in "Totale da pagare", the phone photo. What it got **wrong without any flag**: `es-water-2026-09-meseta-handwritten` (took the crossed-out printed 1,640 m³ / 5,088.82 instead of the handwritten 1,046 m³ / 3,269.10), `de-water-2026-08-ffmwasser-scan` (2.724 instead of 1,362 m³, in one of two runs). **Not handled:** the fax (invoice number "AE.1026 120561", most fields null). The reference adds a price-plausibility rule (`unit_price_implausible`) that catches the scan; nothing catches the handwriting: that is what the QA app (M6) is for.
**Watch for:** `enum` is not enforced: one reference run returned `document_type = 'district_heating'` for `de-heat-2026-10-fernwaerme`; the Stage 3 test run returned `'water'` for `lu-water-2026-q3-vdleau`. Results differ slightly between runs (4 of 612 values changed on a re-run).
**Checkpoint:** `SELECT edge_case, expected_outcome, actual_outcome FROM <catalog>.<schema>.ref_invoice_edge_case_results_v` → 23 handled / 10 needs_qa / 1 not_handled.

## Stage 5: Run it when a file arrives (4 min)

**Prompt:**
> Write an INSERT INTO <my_schema>.invoices_extracted that extracts only the files under incoming/ whose file_path is not yet in the table, with the same columns as before, and save it as a SQL file invoices_incremental.sql in my workspace folder.

Then **Jobs & Pipelines → Create job**: task type **SQL**, source **File** → `invoices_incremental.sql`, SQL warehouse = the workshop warehouse. **Schedules & Triggers → Add trigger → File arrival**, storage location `/Volumes/<catalog>/<my_schema>/utility_invoices/incoming/` → **Test connection** → Save.
**Expected:** the job shows "File arrival" as trigger; a manual **Run now** finishes in ~20 s with 0 new rows.
**Watch for (file events):** on the pre-build workspace the file-arrival trigger was accepted (`using_file_events: true`) but **never fired** in five drops over an hour (the external location has no file events configured). If **Test connection** warns, or Stage 6 shows no run after 2 minutes, use the fallback: replace the trigger with **Scheduled → every 1 minute** (cron `0 * * * * ?`), or simply click **Run now**. The facilitator unpauses "[Revantage ESG] Extract utility invoices (Reference, 1-min poll fallback)" for the reference demo.
**If stuck:** Stage 5 block of `m05_stage_solutions.sql`; reference SQL `code/invoices/sql/extract_invoices.sql` (insert + normalisation + validation flags).

## Stage 6: Drop an invoice live (3 min)

Catalog Explorer → `utility_invoices` → `live_drop` → download `nl-elec-2026-10-noordzee.pdf` (or take it from the Git folder `code/documents/out/live_drop/`) → `incoming` → **Create directory** `2026-11-06` → **Upload to this volume**.
**Expected:** a run starts within ~1 minute (file arrival) or at the next minute (fallback schedule); the row is in the table **~60–90 s after the drop** (measured with the 1-min schedule: 89 s for one file, ~60 s for four). `nl-elec-2026-10-noordzee`: 51,120 kWh, 16,394.91 EUR. Drop `de-elec-2026-10-mainstrom-mahnung.pdf` next: it comes back as `document_type = reminder` (a payment reminder for an invoice already loaded).
**Checkpoint:** `SELECT invoice_id, received_date, amount_total FROM <my_schema>.invoices_extracted WHERE received_date = current_date()`.
**If stuck:** Run now on your job; if the job fails, open the run's SQL output.

## Wrap-up
- **So what:** a utility invoice dropped in a folder becomes a governed, typed Delta row in about a minute, in nine languages and four currencies, with no template per supplier; the hard cases are visible, not hidden.
- **Snowflake equivalent:** Document AI (`!PREDICT`) on a stage + a stream/task. Here it is two SQL functions on a governed volume, triggered by file arrival.
