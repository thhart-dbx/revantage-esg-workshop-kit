# Module 0: Getting started — "Your own copy of the workshop, and two apps warming up"

**Session:** 9:00–9:25 (25 min: 5 min welcome and ESG context, 20 min hands-on) · **You build:** a Git folder with the workshop repo, your own copy of the workshop data in `<catalog>.<my_schema>`, and two running Databricks Apps deployed from your Git folder: the tenant survey app (`code/app`, used in Module 1b) and the invoice QA app (`code/app-invoice-qa`, Module 6) · **Reference:** the shared starting state in `<catalog>.<schema>`; the reference apps `revantage-esg-survey` and `revantage-invoice-qa`
**Starting state:** the public GitHub repo `thhart-dbx/revantage-esg-workshop-kit` (no GitHub account needed); `USE CATALOG` on `<catalog>`, read on `<catalog>.<schema>`, and either `CREATE SCHEMA` on `<catalog>` or a pre-created `<my_schema>` (sandbox job); a serverless SQL warehouse; permission to create apps; Lakebase project `Revantage ESG survey (Lakebase)` usable by participants
**Where:** Workspace (Git folder), Apps (**Create app**), notebook on Serverless, Genie Code side panel

Everything for the morning lives in one public Git repo, the workshop kit: one guide per module with the exact prompts
(`code/prompts/`), the source of both apps, and a notebook that builds the workshop data. You clone it as a **Git
folder**, start your two apps right away (their compute takes 2–3 minutes to start, so they warm up while you work),
build your own copy of the data, and then deploy the apps from your Git folder. In Modules 1b and 6 you point them at
your own data and add a feature with Genie Code.

**The story you'll find in the data** (facilitator, 5 min): Revantage's European ESG portfolio, 10 properties in 9
countries. **UJ1:** every quarter tenants get an ESG & satisfaction survey: Castellana Tower (Madrid) scores lowest on
Energy and Indoor comfort, and its comments are about the HVAC; Amstel Logistics Park's Energy score climbs after the
LED + solar retrofit; Vltava Business Centre (Prague) barely answers. **UJ2:** utility invoices in five currencies and
eight languages are keyed in by hand today; `ai_extract` reads them as they land, a QA app catches what it gets wrong.

## Stage 1: Create the Git folder (3 min)

**Workspace** → **Home** → **Create** → **Git folder** → Git repository URL `https://github.com/thhart-dbx/revantage-esg-workshop-kit` (provider and folder name fill in) → **Create Git folder**. The repo is public, so no Git credential is needed.
**Checkpoint:** the folder `revantage-esg-workshop-kit` shows branch **main** and contains `code/` with `app`, `app-invoice-qa`, `setup` and `prompts`.
**If stuck:** "Invalid Git credentials" or a credential prompt → check the URL (copy it from the slide); a typo makes GitHub ask for a login. Still stuck: do Stage 2 now (it doesn't need the Git folder) and fix it while the apps start.

## Stage 2: Create your two apps, so their compute starts now (4 min)

App switcher (grid icon, top right) → **Apps** → **Create app** → **Create a custom app** (top card, not a template):
1. **App name** `esg-survey-<your name>` (lowercase letters, digits and hyphens, max 30 characters; it can't be changed later) → **Next: Configure Git** → leave the Git repository empty → **Next: Configure**.
2. **App resources** → **Add resource** → **SQL warehouse** → `Serverless Starter Warehouse`, Permission **Can use**, key **`sql-warehouse`** (prefilled).
3. **Add resource** → **Database** → project **Revantage ESG survey (Lakebase)** → branch **production** → database **`esg_survey`** (a third drop-down appears under the first two), Permission **Can connect and create**, key **`postgres`** (prefilled).
4. **Create app**.

Then the same again for the QA app: **Create app** → **Create a custom app** → name `invoice-qa-<your name>` → **Next** → **Next** → **Add resource** → **SQL warehouse** (`Serverless Starter Warehouse`, **Can use**, key `sql-warehouse`) → **Create app** (no database).
**Expected:** each app page says **Compute is starting** ("This process takes 2–3 minutes") and **Deploy** is greyed out until it finishes. Carry on with Stage 3.
**Facilitator:** once everyone has created their apps (~9:12), run `code/scripts/grant_participant_apps.py` from the project repo (see `code/preflight/permissions.md`): it gives every participant app's service principal read access to the shared data and its own schemas. Run it again after Module 1a and before Module 6, and after any `bundle deploy` (a deploy resets the shared schema's grants).
**If stuck:** "Cannot update app … STARTING" when you change resources → wait for compute to finish. Can't see **Revantage ESG survey (Lakebase)** in the Database list → you don't have permission on the Lakebase project yet: tell the facilitator, create the survey app with the SQL warehouse only, and add the database later (app page → **Settings** → **App resources**).

## Stage 3: Build your copy of the data, and ask Genie Code what it does (7 min)

Open `code/setup/participant_setup` in your Git folder. In the first code cell type `CATALOG = "<catalog>"` and `SHARED_SCHEMA = "<schema>"` (the names shared at the start of the session); leave `MY_SCHEMA` blank (it becomes `<schema>_<your name>`). Compute **Serverless** → **Run all**. (A banner "This file is part of a bundle" can be dismissed.)
While it runs (~2 min), open the **Genie Code** panel (top right):

**Prompt** (Genie Code, notebook):
> Explain what this notebook does, step by step, and list every object it creates.

**Expected:** Genie Code walks through the cells (your settings and schema name, `setup_starting_state.py` generating the survey dataset with a fixed seed, `setup_invoices.py` copying the invoice files and loading the master data, the PASS/FAIL checks) and lists **1 schema**, **9 tables** (`properties`, `tenants`, `survey_contacts`, `survey_questions`, `survey_campaigns`, `survey_requests`, `utility_meters`, `emission_factors`, `ref_invoice_ground_truth`), **1 volume** `utility_invoices` with **34** invoice files in `incoming/<received date>/` and **5** in `live_drop/`.
The notebook's last cell prints **11 PASS** lines (properties 10, tenants 45, survey_contacts 60, survey_questions 11, survey_campaigns 5, survey_requests 300, open campaign 2026-Q4 with 60 requests, utility_meters 28, emission_factors 37, 34 invoice files, 5 live-drop files) and then your names for the rest of the morning:
`<my_schema> = <schema>_<your name>`, `<your_name>`, `<pg_schema> = survey_<your name>`. **Write them down.**
**Checkpoint:** 11 PASS, then "Done. In the module guides: …".
**If stuck:** `AssertionError: Type the catalog and shared schema names…` → the first code cell is still empty; type both names, keep the quotes. `PERMISSION_DENIED` on CREATE SCHEMA → your schema hasn't been created for you yet: tell the facilitator (sandbox job), then **Run all** again (safe to re-run). Until then, use `<catalog>.<schema>` wherever a guide says `<my_schema>`.

## Stage 4: Deploy both apps from your Git folder (4 min)

Apps → `esg-survey-<your name>` (the app page now says **Running** / *app not deployed*) → **Deploy** → **Source code path**: `/Workspace/Users/<your email>/revantage-esg-workshop-kit/code/app` (type it, or use the folder button next to the field to browse to `code/app`) → **Deploy**.
Then `invoice-qa-<your name>` → **Deploy** → `/Workspace/Users/<your email>/revantage-esg-workshop-kit/code/app-invoice-qa` → **Deploy**.
The platform runs `npm install` and `npm run build` on your source, then starts the app: about **1.5 minutes** each (measured 84 s), and both can deploy at the same time. The settings come from `app.yaml` in each folder: for now both apps read the **shared** workshop data (read-only); you switch them to your own data in Modules 1b and 6.
**Expected:** the deployment history shows **Active**; the app page shows **Running** and the app URL.
**Checkpoint:** open the survey app URL + `/?campaign=2026-Q4` (approve the one-time **Authorize** screen) → **Q4 2026 survey · Open until 30 November 2026 · Tenant ESG & Satisfaction Survey · 8 statements · 3 open questions** and the work-email box. Open the QA app → **Invoice QA queue** with **6** invoices needing review (the reference queue).
**If stuck:** **Deploy** greyed out → compute is still starting (Stage 2); wait. "Survey unavailable" / "Couldn't load invoices" → the facilitator's grant script hasn't covered your app yet: ask, then reload (no redeploy needed). Deployment **Failed** → the **Deployments** / **Logs** tab shows why; the usual cause is a wrong source path (it must end in `/code/app` or `/code/app-invoice-qa`).

## Stage 5 (if time): Check your copy (2 min)

**SQL Editor** → **+** → **Query**, then the Genie Code panel:

**Prompt** (Genie Code, SQL editor):
> Compare <catalog>.<my_schema>.survey_requests with <catalog>.<schema>.survey_requests: same number of rows, and how many rows differ? Run it and check the result.

**Expected:** Genie Code writes and runs a query (`EXCEPT ALL` or a full outer join on `request_id`) and reports **300** rows in each and **0** rows that differ. Click **Reject** on the suggested edit if you don't want to keep the query.
**Checkpoint:** Catalog → `<catalog>` → `<my_schema>` shows the 9 tables and the volume `utility_invoices` (folders `incoming/2026-08-04` … `incoming/2026-11-04`, and `live_drop`).
**If stuck:**
```sql
SELECT COUNT(*) AS differences FROM (
  SELECT * FROM <catalog>.<my_schema>.survey_requests
  EXCEPT ALL
  SELECT * FROM <catalog>.<schema>.survey_requests)
```

## Reset
Re-run `participant_setup` (**Run all**): it rebuilds your Delta tables from scratch and copies any missing invoice files (files you dropped yourself stay). Get the latest guides with the Git folder's branch button (**main**) → **Pull**; if Pull reports a conflict on `participant_setup`, `code/app/app.yaml` or `code/app-invoice-qa/app.yaml`, discard your local change to that file first (your names are the only edit). An app that misbehaves: app page → **Deploy** again (same source path); to start over, delete the app and repeat Stages 2 and 4.

## Wrap-up
- **So what:** everyone has the material, a private copy of the data and two live apps before the first module, so a broken build only ever breaks your own copy, and nobody waits for compute later.
- **Two schemas from here on:** `<catalog>.<schema>` is the shared workshop data with the answer keys (`ref_*`, "(Reference)" assets); `<catalog>.<my_schema>` is your copy, where you build. Your Lakebase tables (Postgres schema `survey_<your_name>`) come in Module 1a.
- **Facilitator:** Stage 1 against the public kit repo was not rehearsed (the repo was being created); check it once before the session.
