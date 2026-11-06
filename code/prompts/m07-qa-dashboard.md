# Module 7: QA errors dashboard — "Where do the invoice errors come from?"

**Session:** 11:50–11:55 (5 min: facilitator demo of the reference dashboard "Revantage Invoice QA (Reference)"; participants: take-home) · **You build:** AI/BI dashboard "Invoice QA – <your_name>" · **Reference:** "Revantage Invoice QA (Reference)" (folder `dashboards`; pages Errors by received date, Where errors come from, Extraction accuracy, Backlog & log)
**Starting state:** in `<catalog>.<schema>` (shared, so everyone sees the same numbers): metric views `ref_mv_invoice_qa` (one row per invoice: QA status, error rate, backlog) and `ref_mv_invoice_corrections` (one row per corrected field), views `ref_invoice_correction_facts_v`, `ref_invoice_edge_case_results_v`, table `ref_invoice_extraction_scores`. History: 34 invoices received 2026-08-04 … 2026-11-04, QA reviewed everything received before 2026-11-02.
**Where:** Dashboards → **Create dashboard**; Genie Code panel in the dashboard editor

**Facilitator demo (participants: take-home).** In the session the facilitator walks through the reference dashboard **"Revantage Invoice QA (Reference)"** (folder `dashboards`). The stages below are for building your own copy after the workshop.
**Facilitator:** this module was not run in the UI rehearsal (the dashboard was created and moved to `dashboards`, then the session stopped before the datasets were added). The expected numbers come from the checkpoint queries and the reference datasets, run by SQL; the Genie Code prompts and the widgets were not checked in the UI.

## Stage 1: Data + KPIs (4 min)

**Create dashboard** → rename "Invoice QA – <your_name>" → **More actions (⋮) → File actions → Move…** → your `dashboards` folder. **Data** → **Add data source** → `<catalog>.<schema>.ref_mv_invoice_qa`, `ref_mv_invoice_corrections`, `ref_invoice_edge_case_results_v`.

**Prompt** (Genie Code, dashboard editor):
> Using the metric view ref_mv_invoice_qa, add a page "Errors by received date" with six counters: Invoices received (invoices), Backlog (pending_invoices), Error rate (error_rate, percent with one decimal), Straight-through rate (straight_through_rate, percent), Fields corrected (corrections) and ai_extract field accuracy (field_accuracy, percent).

**Expected:** **34 · 6 · 21.4 % · 78.6 % · 9 · 96.6 %** (6 of 28 reviewed invoices were corrected or rejected; 576 of 596 fields right before QA).
**Watch for:** an error rate computed as errors ÷ *all* invoices gives 17.6 %; the metric view divides by *reviewed* invoices (pending ones can't have errors yet).
**Checkpoint:** `SELECT MEASURE(invoices), MEASURE(pending_invoices), MEASURE(error_rate) FROM <catalog>.<schema>.ref_mv_invoice_qa` → 34, 6, 0.2143.
**If stuck:** open the reference dashboard → Data tab → copy dataset `kpis`.

## Stage 2: Errors by received date (4 min)

**Prompt:**
> Add a bar chart from ref_mv_invoice_corrections: corrections by received_date (x, as a date), coloured by error_type. Below it, a stacked bar chart from ref_mv_invoice_qa of invoices by received_date coloured by qa_status (Approved, Corrected, Rejected, Pending).

**Expected:** corrections on six received dates: **2026-09-02: 1, 09-23: 1, 09-30: 1, 10-14: 1, 10-21: 4, 10-28: 1**; the 10-21 bar is the handwritten water bill (4 fields). Error types: wrong_value 6, not_an_invoice 1, split_required 1, not_in_portfolio 1. The status chart is grey (Pending) from 2026-11-02.
**Checkpoint:** `SELECT received_date, MEASURE(corrections) FROM <catalog>.<schema>.ref_mv_invoice_corrections GROUP BY ALL ORDER BY 1` → 6 rows as above.

## Stage 3: Where errors come from (4 min)

**Prompt:**
> Add a page "Where errors come from" with horizontal bar charts from ref_mv_invoice_corrections of corrections by field_name, by error_type, by supplier_name and by edge_case (each sorted descending), plus invoices_with_errors by utility_type from ref_mv_invoice_qa, and a multi-select filter on utility_type.

**Expected:** by field **document 3** (the three rejected files), consumption 2, amount_total 2, amount_net 1, vat_amount 1; top supplier **Aguas de la Meseta S.A.** (4 fields, the handwritten correction); by utility **water 4 of 5 reviewed** invoices had errors (scans, a reminder, a 2-in-1 PDF, handwriting) vs electricity 2 of 14, gas 0 of 4, district heating 0 of 5.
**So what for the room:** the errors cluster in paper-born documents (scans, handwriting, municipal water bills), not in a language or currency.

## Stage 4: Accuracy, edge cases and backlog (3 min)

**Prompt:**
> Add a page "Extraction accuracy" with a table from ref_invoice_edge_case_results_v (edge_case, invoice_id, expected_outcome, actual_outcome, fields_correct, fields_scored, wrong_fields, validation_flags, silent_error), not_handled first, and a bar chart of invoices by actual_outcome coloured by expected_outcome.

**Expected:** measured **23 handled / 10 needs_qa / 1 not_handled** vs expected 20 / 11 / 3. First row `fr-elec-2026-10-rhone-fax` (scan_unreadable, 6 / 18). Two **silent errors** (wrong field, no flag): the handwritten correction and the PL gas m³/kWh unit.
**Checkpoint:** `SELECT actual_outcome, count(*) FROM <catalog>.<schema>.ref_invoice_edge_case_results_v GROUP BY 1` → handled 23, needs_qa 10, not_handled 1.
**If stuck:** copy pages from the reference dashboard (it also has "Backlog & log": the 6 Pending invoices and the correction log).

## Wrap-up
- **So what:** the QA lead sees error volume by the day invoices arrived, which fields and suppliers cause them, and which documents should never have gone straight through, from the same metric definitions the app and Genie use.
- **Snowflake equivalent:** Snowsight dashboards over views; here the KPIs are UC metric views shared by dashboard, Genie and app.
- **Facilitator:** every checkpoint query and all 9 reference datasets ran by SQL; the reference dashboard is deployed from the bundle. Genie Code prompts and widgets: not run in the UI. Numbers change if someone approves/corrects invoices in the QA app (M6) on the shared reference tables; the history before 2026-11-02 is rebuilt by `bundle run invoices_reference_qa`.
