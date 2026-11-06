# Revantage ESG workshop: participant handout

6 November 2026, 9:00–12:00. You build every asset yourself in **your own schema** with **Genie Code**. For each step: type the prompt, compare with the expected result and the checkpoint; if you're stuck, open the finished reference (objects named `ref_…` or titled "(Reference)") and carry on.

| Placeholder | Means |
|---|---|
| `<catalog>.<schema>` | the shared workshop data (your facilitator gives you the names) |
| `<my_schema>` | your copy: `<schema>_<your_name>` (Module 0 prints it) |
| `<your_name>` | the name Module 0 prints (lower case, no spaces) |
| `<pg_schema>` | your Postgres schema `survey_<your_name>` in Lakebase database `esg_survey` (Module 1a) |
| `<your app url>`, `<app_sp>` | your app's URL and service principal ID (app page → Overview) |

**Tips.** Open a query tab before you prompt Genie Code in the SQL editor. End every prompt that builds something with *"run it and check the result"*. App links need a workspace login: you play the tenant.

| Time | Module |
|---|---|
| 9:00–9:25 | Module 0: Getting started |
| 9:25–9:45 | Module 1a: Lakebase tables synced to Delta |
| 9:45–10:00 | Module 1b: Survey app on Lakebase |
| 10:00–10:15 | Module 2: Quarterly survey alert |
| 10:15–10:40 | Module 3: Survey dashboard |
| 10:40–10:50 | Break |
| 10:50–11:10 | Module 4: Survey Genie space |
| 11:10–11:35 | Module 5: ai_extract on arrival |
| 11:35–11:50 | Module 6: QA/QC app |
| 11:50–11:55 | Module 7: QA errors dashboard |
| 11:55–12:00 | Wrap-up |

## Module 0: Getting started — "Your own copy of the workshop, and two apps warming up"

**Session:** 9:00–9:25 (25 min: 5 min welcome and ESG context, 20 min hands-on) · **You build:** a Git folder with the workshop repo, your own copy of the workshop data in `<catalog>.<my_schema>`, and two running Databricks Apps deployed from your Git folder: the tenant survey app (`code/app`, used in Module 1b) and the invoice QA app (`code/app-invoice-qa`, Module 6) · **Reference:** the shared starting state in `<catalog>.<schema>`; the reference apps `revantage-esg-survey` and `revantage-invoice-qa`
**Where:** Workspace (Git folder), Apps (**Create app**), notebook on Serverless, Genie Code side panel

### Stage 1: Create the Git folder (3 min)

**Workspace** → **Home** → **Create** → **Git folder** → Git repository URL `https://github.com/thhart-dbx/revantage-esg-workshop-kit` (provider and folder name fill in) → **Create Git folder**. The repo is public, so no Git credential is needed.
**Checkpoint:** the folder `revantage-esg-workshop-kit` shows branch **main** and contains `code/` with `app`, `app-invoice-qa`, `setup` and `prompts`.
**If stuck:** "Invalid Git credentials" or a credential prompt → check the URL (copy it from the slide); a typo makes GitHub ask for a login. Still stuck: do Stage 2 now (it doesn't need the Git folder) and fix it while the apps start.

### Stage 2: Create your two apps, so their compute starts now (4 min)

App switcher (grid icon, top right) → **Apps** → **Create app** → **Create a custom app** (top card, not a template):
1. **App name** `esg-survey-<your name>` (lowercase letters, digits and hyphens, max 30 characters; it can't be changed later) → **Next: Configure Git** → leave the Git repository empty → **Next: Configure**.
2. **App resources** → **Add resource** → **SQL warehouse** → `Serverless Starter Warehouse`, Permission **Can use**, key **`sql-warehouse`** (prefilled).
3. **Add resource** → **Database** → project **Revantage ESG survey (Lakebase)** → branch **production** → database **`esg_survey`** (a third drop-down appears under the first two), Permission **Can connect and create**, key **`postgres`** (prefilled).
4. **Create app**.

Then the same again for the QA app: **Create app** → **Create a custom app** → name `invoice-qa-<your name>` → **Next** → **Next** → **Add resource** → **SQL warehouse** (`Serverless Starter Warehouse`, **Can use**, key `sql-warehouse`) → **Create app** (no database).
**Expected:** each app page says **Compute is starting** ("This process takes 2–3 minutes") and **Deploy** is greyed out until it finishes. Carry on with Stage 3.
**If stuck:** "Cannot update app … STARTING" when you change resources → wait for compute to finish. Can't see **Revantage ESG survey (Lakebase)** in the Database list → you don't have permission on the Lakebase project yet: tell the facilitator, create the survey app with the SQL warehouse only, and add the database later (app page → **Settings** → **App resources**).

### Stage 3: Build your copy of the data, and ask Genie Code what it does (7 min)

Open `code/setup/participant_setup` in your Git folder. In the first code cell type `CATALOG = "<catalog>"` and `SHARED_SCHEMA = "<schema>"` (the names shared at the start of the session); leave `MY_SCHEMA` blank (it becomes `<schema>_<your name>`). Compute **Serverless** → **Run all**. (A banner "This file is part of a bundle" can be dismissed.)
While it runs (~2 min), open the **Genie Code** panel (top right):

**Prompt** (Genie Code, notebook):
> Explain what this notebook does, step by step, and list every object it creates.

**Expected:** Genie Code walks through the cells (your settings and schema name, `setup_starting_state.py` generating the survey dataset with a fixed seed, `setup_invoices.py` copying the invoice files and loading the master data, the PASS/FAIL checks) and lists **1 schema**, **9 tables** (`properties`, `tenants`, `survey_contacts`, `survey_questions`, `survey_campaigns`, `survey_requests`, `utility_meters`, `emission_factors`, `ref_invoice_ground_truth`), **1 volume** `utility_invoices` with **34** invoice files in `incoming/<received date>/` and **5** in `live_drop/`.
The notebook's last cell prints **11 PASS** lines (properties 10, tenants 45, survey_contacts 60, survey_questions 11, survey_campaigns 5, survey_requests 300, open campaign 2026-Q4 with 60 requests, utility_meters 28, emission_factors 37, 34 invoice files, 5 live-drop files) and then your names for the rest of the morning:
`<my_schema> = <schema>_<your name>`, `<your_name>`, `<pg_schema> = survey_<your name>`. **Write them down.**
**Checkpoint:** 11 PASS, then "Done. In the module guides: …".
**If stuck:** `AssertionError: Type the catalog and shared schema names…` → the first code cell is still empty; type both names, keep the quotes. `PERMISSION_DENIED` on CREATE SCHEMA → your schema hasn't been created for you yet: tell the facilitator (sandbox job), then **Run all** again (safe to re-run). Until then, use `<catalog>.<schema>` wherever a guide says `<my_schema>`.

### Stage 4: Deploy both apps from your Git folder (4 min)

First open `code/app/app.yaml` and `code/app-invoice-qa/app.yaml` in your Git folder and look at the **Workshop settings** block. If `DATABRICKS_CATALOG` / `DATABRICKS_SCHEMA` still read `<catalog>` / `<schema>`, replace them with the workshop catalog and schema the facilitator gives you (the shared data, not yet your own copy) and save. Leave the other lines alone.

Apps → `esg-survey-<your name>` (the app page now says **Running** / *app not deployed*) → **Deploy** → **Source code path**: `/Workspace/Users/<your email>/revantage-esg-workshop-kit/code/app` (type it, or use the folder button next to the field to browse to `code/app`) → **Deploy**.
Then `invoice-qa-<your name>` → **Deploy** → `/Workspace/Users/<your email>/revantage-esg-workshop-kit/code/app-invoice-qa` → **Deploy**.
The platform runs `npm install` and `npm run build` on your source, then starts the app: about **1.5 minutes** each (measured 84 s), and both can deploy at the same time. The settings come from `app.yaml` in each folder: for now both apps read the **shared** workshop data (read-only); you switch them to your own data in Modules 1b and 6.
**Expected:** the deployment history shows **Active**; the app page shows **Running** and the app URL.
**Checkpoint:** open the survey app URL + `/?campaign=2026-Q4` (approve the one-time **Authorize** screen) → **Q4 2026 survey · Open until 30 November 2026 · Tenant ESG & Satisfaction Survey · 8 statements · 3 open questions** and the work-email box. Open the QA app → **Invoice QA queue** with **6** invoices needing review (the reference queue).
**If stuck:** "DATABRICKS_CATALOG must be a plain SQL identifier" → `app.yaml` still has `<catalog>`: fix it (step above) and **Deploy** again. **Deploy** greyed out → compute is still starting (Stage 2); wait. "Survey unavailable" / "Couldn't load invoices" → the facilitator's grant script hasn't covered your app yet: ask, then reload (no redeploy needed). Deployment **Failed** → the **Deployments** / **Logs** tab shows why; the usual cause is a wrong source path (it must end in `/code/app` or `/code/app-invoice-qa`).

### Stage 5: Optional (take-home): Check your copy (2 min)

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

## Module 1a: Lakebase tables synced to Delta — "Where survey answers land"

**Session:** 9:25–9:45 (20 min) · **You build:** Postgres schema `survey_<your_name>` with tables `survey_responses` + `survey_answers` in Lakebase, replicated to Delta in `<catalog>.<my_schema>` by Lakehouse Sync · **Reference:** Lakebase project `revantage-esg` → branch `production` → database `esg_survey` → schema `survey`; Delta `<catalog>.<schema>.lb_survey_responses_history` / `lb_survey_answers_history` and views `ref_survey_responses` / `ref_survey_answers`
**Where:** Catalog / Compute → **Lakebase Postgres** → project `revantage-esg` → **SQL editor** (database `esg_survey`) with Genie Code; branch page → **Lakehouse sync**

### Stage 1: Create your schema (3 min)

Open the SQL editor on project `revantage-esg` (shown as **Revantage ESG survey (Lakebase)** in the project list). Clear the sample SQL in the editor, then set the database dropdown to **`esg_survey`** (it opens on `databricks_postgres`):
```sql
CREATE SCHEMA survey_<your_name>;
```
**Checkpoint:** `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'survey%'` lists `survey` and `survey_<your_name>`.

### Stage 2: Turn on Lakehouse Sync for the (still empty) schema (5 min)

Project `revantage-esg` → branch **production** → **Overview** → tab **Lakebase CDF** (the UI name for Lakehouse Sync) → **Start**: Database `esg_survey`, Schema `survey_<your_name>`; destination Catalog `<catalog>` (type the name: the dropdown lists every catalog in the metastore), Schema `<my_schema>`. The schema list only shows `survey_<your_name>` once Stage 1 has run, and it appears as an option only after you pick the database.

**Expected:** the sync appears for schema `survey_<your_name>`; it syncs *every* current and future table in that schema.

### Stage 3: Create the two tables (9 min)

**Where:** not the SQL editor. Branch **production** → sidebar **Genie** opens Genie Code for Lakebase (the SQL editor has no Genie Code). Start a new chat.

**Prompt** (Genie Code, Lakebase Genie page):
> In database esg_survey, connect as my own role <your_email> (not databricks_postgres) and create two tables in Postgres schema survey_<your_name>. Run the statements and check the result.
>
> The table definitions:
> In Postgres schema survey_<your_name> create two tables for a tenant survey. survey_responses: response_id uuid primary key defaulting to gen_random_uuid(), campaign_id text not null, contact_id int not null, contact_email text not null, property_id int not null, submitted_at timestamptz not null default now(). survey_answers: response_id uuid not null referencing survey_responses on delete cascade, question_id int not null, likert_value smallint null with a check between 1 and 5, text_value text null, primary key (response_id, question_id). Add an index on survey_responses (campaign_id, contact_id) and set REPLICA IDENTITY FULL on both tables (Lakehouse Sync needs it).

**Expected:** DDL like `code/lakebase/survey_ddl.sql` (CREATE TABLE × 2, CREATE INDEX, 2 × ALTER TABLE … REPLICA IDENTITY FULL). If Genie Code adds `CREATE EXTENSION pgcrypto`, that's fine (`gen_random_uuid()` is built into Postgres 17 anyway).
**Checkpoint:** insert a test response and see it in Delta:
```sql
WITH r AS (INSERT INTO survey_<your_name>.survey_responses (campaign_id, contact_id, contact_email, property_id)
           VALUES ('2026-Q4', 48, 'darragh.ryan@ringsend36.example', 8) RETURNING response_id)
INSERT INTO survey_<your_name>.survey_answers (response_id, question_id, likert_value, text_value)
SELECT response_id, q, CASE WHEN q <= 8 THEN 4 END, CASE WHEN q = 9 THEN 'More bike parking please' END
FROM r, generate_series(1, 9) q;
```
→ `INSERT 0 9` (the SQL editor may just say *Statement executed successfully*). Within ~10–30 s, in the Databricks SQL editor:
`SELECT count(*) FROM <catalog>.<my_schema>.lb_survey_answers_history` → **9** (and `lb_survey_responses_history` → 1). Each row carries `_pg_change_type` (insert / update_preimage / update_postimage / delete) and `_pg_lsn`: it's a change log (SCD type 2), not a copy.
**If stuck:** run `code/lakebase/survey_ddl.sql` with `${pg_schema}` replaced by `survey_<your_name>`; or look at the reference schema `survey` and its Delta tables in `<catalog>.<schema>`.

### Stage 4: Current state in Delta (3 min, show)

The change log becomes "the table" with a view that keeps the latest change per key and drops deletes. Show `ref_survey_responses` in `code/sql/survey_reference.sql` (also converts the `response_id` binary back to a UUID string).
**Checkpoint:** `SELECT count(*) FROM <catalog>.<schema>.ref_survey_responses` → **216**; `ref_survey_answers` → **2,127**. Delete your test row (`DELETE FROM survey_<your_name>.survey_responses`) and watch a `delete` row appear in your history table.

## Module 1b: Survey app on Lakebase — "Your survey app, your data, one new feature"

**Session:** 9:45–10:00 (15 min) · **You build:** your own copy of the tenant survey app (deployed in Module 0) pointed at your Delta copy and your Lakebase schema, plus one new feature added with Genie Code · **Reference:** app `revantage-esg-survey` (Next.js + TypeScript, `code/app/`); the finished feature file `code/prompts/solutions/m01b-survey-flow.tsx`
**Where:** Workspace (your Git folder `revantage-esg-workshop-kit`: `code/app/app.yaml`, `code/app/src/components/survey-flow.tsx`) with Genie Code; Apps (your app page → **Deploy**); Lakebase SQL editor; SQL editor

### Stage 1: Point the app at your data (5 min)

Workspace → your Git folder → `code` → `app` → open **`app.yaml`**. Under `# ---- Workshop settings` change two values (type over them; the file saves itself):
- `DATABRICKS_SCHEMA` → `<my_schema>` (e.g. `revantage_20261105_jane_doe`)
- `SURVEY_PG_SCHEMA` → `survey_<your_name>`

Leave `DATABRICKS_CATALOG` as it is. Then give your app's service principal access to your Postgres tables. **Lakebase SQL editor** (project `Revantage ESG survey (Lakebase)`, database **`esg_survey`**); your app's service principal ID is on the app page → **Overview** → *App resources* (or **Authorization**):
```sql
GRANT USAGE ON SCHEMA survey_<your_name> TO "<app_sp>";
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA survey_<your_name> TO "<app_sp>";
```
(The facilitator's grant script normally did this already; running it again is harmless.)
Check the edit is saved (the editor saves as you type: the header says *Last edit was now*). Apps → your app → **Deploy** (top right): after the first deployment it redeploys the same folder (`…/code/app`) straight away, no dialog. About **1 min** (measured 62 s).
**Expected:** the deployment shows **Succeeded**; the app looks the same as before (the questions are the same in your copy).
**Checkpoint:** open `<your app url>/?campaign=2026-Q4`, enter `michal.kaminski@warsaw45.example`: on the shared data (Module 0) he got "You've already completed this survey"; now, on your empty Lakebase schema, you get **Start the survey**. Then `joost.devries@amstel1.example` → **Joost de Vries · Amstel Freight Services B.V. · Amstel Logistics Park, Amsterdam**.
**If stuck:** `Survey unavailable` / `We couldn't reach the survey service` → a typo in the schema names, or the grants are missing: ask the facilitator to re-run the grant script. The app's **Logs** tab shows the exact error (`permission denied for schema …`, `relation … does not exist`).

### Stage 2: Add "Your answers at a glance" with Genie Code (6 min)

Open `code/app/src/components/survey-flow.tsx` in your Git folder, then the **Genie Code** panel (right edge) → **New chat**:

**Prompt** (Genie Code, file editor):
> Edit only this file (survey-flow.tsx, a Next.js client component with shadcn/ui and Tailwind). Add a "Your answers at a glance" card just above the row with the "Submit my answers" button, shown once at least one statement is answered. List every Likert statement (likertQs) in order: its number, its theme, and the chosen score from the likert state as a small Badge with the label from LIKERT_LABELS (import it from the same survey-types module as formatCampaign), coloured by score (1-2 red, 3 amber, 4-5 green), or an outline "Not answered" badge. Clicking a row scrolls to that statement (element id q-<question_id>). In the card title show the average of the answered scores with one decimal, e.g. "Average 3.8 / 5". Use the existing Card, CardHeader, CardTitle, CardDescription, CardContent and Badge components; add data-testid="answer-summary" to the card. Don't change anything else.

**Expected:** Genie Code reads the file (and the badge/card components) for ~2–3 minutes, then proposes one edit, shown as a diff: `LIKERT_LABELS` added to the existing import, a few helper lines, and a new `<Card data-testid="answer-summary">` block before the Submit row (+67 −2 in the rehearsal). **Accept all**. Then **Deploy** again (≈ 1 min).
**Checkpoint:** open the survey as Joost, answer a few statements: the card appears above **Submit my answers**, one row per statement with its theme (Energy & carbon, Indoor comfort, Waste & recycling, Water, Sustainable transport, Wellbeing, Communication, Overall satisfaction), red/amber/green badges, and the average (e.g. scores 2, 4, 5, 3, 4, 1, 5, 4 → **Average 3.5 / 5**).
**If stuck:** copy `code/prompts/solutions/m01b-survey-flow.tsx` over `code/app/src/components/survey-flow.tsx` (same folder in your Git folder) and Deploy.

### Stage 3: Submit, and see it in Lakebase and Delta (4 min)

Answer all 8 statements as Joost (the free-text boxes are optional) → **Submit my answers** → thank-you page with a reference id.
**Checkpoint (Lakebase SQL editor, database `esg_survey`):**
```sql
SELECT r.response_id, r.contact_email, count(a.*) AS answers, round(avg(a.likert_value), 2) AS avg_score
FROM survey_<your_name>.survey_responses r JOIN survey_<your_name>.survey_answers a USING (response_id)
GROUP BY 1, 2;
```
→ one row, `joost.devries@amstel1.example`, **8 answers** (+1 per free-text box you filled), `avg_score` = the average on the card.
Then, a few seconds later, in the **SQL editor** (only if your Lakehouse Sync from Module 1a is on): `SELECT * FROM <catalog>.<my_schema>.lb_survey_responses_history ORDER BY _pg_lsn DESC` → an `insert` row with the same `response_id` (Lakehouse Sync, Module 1a). Reload the survey and enter Joost's email again → **You've already completed this survey**.
**If stuck:** `permission denied for schema survey_<your_name>` on Submit → the GRANT in Stage 1 was run for another service principal.

## Module 2: Quarterly survey alert — "Ask every tenant, every quarter"

**Session:** 10:00–10:15 (15 min) · **You build:** a SQL alert "Survey request – <your_name>" that runs quarterly and emails the survey link for the open campaign · **Reference:** alert "Quarterly tenant ESG survey request (Reference)" (folder `alerts`) + job "[Revantage ESG workshop] Send survey request email now (Reference)" to send it on demand
**Where:** SQL editor with Genie Code → **File → Create alert**

### Stage 1: The alert query (4 min)

**Prompt** (Genie Code, SQL editor):
> Write a query on <catalog>.<schema>.survey_campaigns joined to <catalog>.<schema>.ref_survey_request_status on campaign_id, for the campaign with status 'open' only. Return one row: campaign_id, campaign_name, closes_on (closes_at formatted like '30 November 2026'), survey_link = '<your app url>' || '/?campaign=' || campaign_id, and contacts_pending = number of requests that are not completed. Run it.

**Expected:** 1 row: `2026-Q4` · Tenant ESG & satisfaction survey 2026-Q4 · 30 November 2026 · `<your app url>/?campaign=2026-Q4` · **29** pending (of 60; 31 completed). Genie Code's query is a pending change: click **Accept query** before you save it.
**Checkpoint:** open the `survey_link` value in a new tab: your app shows the 2026-Q4 survey.
**If stuck:** copy the query from the reference alert (Alerts → "Quarterly tenant ESG survey request (Reference)").

### Stage 2: Create the alert (9 min)

Checklist, in this order:
1. **Accept query** (if you haven't), then **Save**. It saves as `New Query <time>` in your home folder.
2. **File → Move…** → folder **`alerts`** → **Move**.
3. **File → Create alert**. The dialog asks for a folder: pick **`alerts`**. Name the alert "Survey request – <your_name>".
4. **Condition:** column `contacts_pending`, operator **>**, threshold **`0`** (the alert fires while someone still has to answer). The threshold field already shows `0`: select it and type `0` over it, then check it reads exactly `0` (typing after the default gives `000`).
5. **Empty result state:** set it to **OK** (the default is Error). With no open campaign the query returns no rows and the alert should stay quiet.
6. **Schedule:** cron `0 0 8 6 1,4,7,10 ?`, timezone Europe/Luxembourg = 08:00 on 6 January, April, July, October (first week of each quarter).
7. **Notifications:** add yourself. Turn on **custom template** and paste:
  - Subject: `Revantage tenant ESG survey {{#QUERY_RESULT_ROWS}}{{campaign_id}}{{/QUERY_RESULT_ROWS}}: 5 minutes to tell us about your building`
  - Body:
    ```
    Dear tenant,

    Revantage asks every tenant each quarter how the building performs on energy and carbon, indoor comfort, waste, water, sustainable transport, wellbeing and communication.

    Please complete this quarter's survey (about 5 minutes):
    {{#QUERY_RESULT_ROWS}}{{survey_link}}{{/QUERY_RESULT_ROWS}}

    Enter the email address this message was sent to. The survey closes on {{#QUERY_RESULT_ROWS}}{{closes_on}}{{/QUERY_RESULT_ROWS}}.

    Thank you,
    Revantage Asset Management, ESG team
    ```
8. **Save** / **Create**.

**Checkpoint:** the alert is in your `alerts` folder and its condition reads `contacts_pending > 0`.

### Stage 3: Send it now (2 min)

Don't wait for January: on the alert page **Run now** (or run the reference job **Send survey request email now (Reference)**, which wraps the alert in an *alert task*).
**Expected:** status **Triggered**; within ~30 s an email from Databricks with subject **"Revantage tenant ESG survey 2026-Q4: 5 minutes to tell us about your building"** and the body above, with your link `…/?campaign=2026-Q4` and "closes on 30 November 2026".
**Checkpoint:** click the link in the email: the survey opens on 2026-Q4.
**If stuck:** subscribe to the reference alert and run the reference job.

## Module 3: Survey dashboard — "Who answered, and what did they say?"

**Session:** 10:15–10:40 (25 min: Stages 1–3; Stages 4–5 optional / take-home) · **You build:** AI/BI dashboard "ESG Survey – <your_name>" · **Reference:** "Revantage ESG Survey (Reference)" (folder `dashboards`; pages Survey completion, Results analysis, Tenant comments)
**Where:** Dashboards → **Create dashboard**; Genie Code panel in the dashboard editor

### Stage 1: Data + completion KPIs (10 min)

**Create dashboard** → rename "ESG Survey – <your_name>" → **More actions (⋮) → File actions → Move…** → your `dashboards` folder (new dashboards land in your home folder). **Data** → **Add data source** → `<catalog>.<schema>.ref_survey_request_status`, `ref_survey_answer_facts`, `ref_survey_comment_insights`. If a dataset shows no fields, refresh it (run the dataset) before you prompt.

**Prompt** (Genie Code, dashboard editor):
> Using ref_survey_request_status, add a page "Survey completion" with four counters: Requests sent (count of request_id), Completed (requests where completed is true), Not completed, and Completion rate (completed / requests, as a percentage with one decimal). Add a global single-select filter on campaign_id defaulting to 2026-Q4 and a multi-select filter on property_name. Run the datasets and check the numbers.

**Expected (2026-Q4):** **60 · 31 · 29 · 51.7 %**. Clear the campaign filter → 300 · 216 · 84 · 72.0 %.
**Checkpoint:** `SELECT MEASURE(requests_sent), MEASURE(completed), MEASURE(completion_rate) FROM <catalog>.<schema>.ref_mv_survey_completion WHERE campaign_id = '2026-Q4'` → 60, 31, 0.5167.
**If stuck:** open the reference dashboard → Data tab → copy `ds_requests` (its measures are the `columns` at the bottom).

### Stage 2: Completed / not completed list (7 min)

**Prompt:**
> On the same page add a bar chart of completion rate by property_name (sorted ascending) and a table of contacts with status ('Completed' or 'Not completed' from completed), contact_name, contact_email, tenant_name, property_name, sent_at and submitted_at, not completed first. Bind the Campaign and Property filters to the chart and the table.

**Expected (2026-Q4):** lowest bar **Vltava Business Centre 16.7 %** (1 of 6), then Grand Rue Retail Quarter and Vistula Logistics Centre 33.3 %; highest Docklands Studios 83.3 %. The table has 60 rows, the first 29 "Not completed" (e.g. Joost de Vries, Femke Bakker at Amstel Logistics Park).
**Checkpoint:** set Property = Vltava Business Centre → 6 rows, 5 not completed. Across all campaigns Vltava is the outlier: **26.7 %** vs 63–90 % elsewhere.

### Stage 3: Results analysis (6 min)

**Prompt:**
> Add a page "Results analysis" from ref_survey_answer_facts where question_type = 'likert' (likert_value 1 = strongly disagree to 5 = strongly agree): counters for average score (2 decimals), favourable share (likert_value 4 or 5, percent) and number of responses (distinct response_id); a bar chart of average score by theme and one by property_name; and a heatmap of average score with theme on x and property_name on y. Bind the campaign and property filters to this dataset too.

**Expected (2026-Q4):** **3.73 · 66.5 % · 31 responses**; lowest theme Indoor comfort 3.35. Clear the campaign filter (all quarters): **3.64 · 61.1 % · 216**; lowest property **Castellana Tower 2.85**, highest Docklands Studios 4.23. In the heatmap, Castellana Tower × Energy & carbon **1.85** and × Indoor comfort **1.63** are the two darkest cells (portfolio 3.45 / 3.44). Then **Publish** (Stages 4–5 are optional).

### Stage 4: Optional (take-home): Trend (3 min)

**Prompt:**
> Add a line chart of average score by campaign_id (x) and theme (color) from a second dataset over the same Likert answers that is NOT bound to the campaign filter, so it always shows all five quarters. Keep the property filter on it.

**Expected:** set Property = **Amstel Logistics Park**: Energy & carbon climbs **2.60 → 3.00 → 3.80 → 3.83 → 4.50** (2025-Q4 → 2026-Q4) after the LED retrofit + rooftop solar went live in March 2026. Castellana Tower stays at the bottom on Energy & carbon (1.5–2.2) in every quarter.
**If stuck:** copy `ds_scores_trend` and the "Score trend by theme and quarter" widget from the reference.

### Stage 5: Optional (take-home): Comments (2 min)

**Prompt:**
> Add a page "Tenant comments" from ref_survey_comment_insights: a bar chart of comment count by topic colored by sentiment, and a table of campaign_id, property_name, tenant_name, sentiment, topic and comment. Bind the Campaign and Property filters to this page.

**Expected:** 399 comments overall; filter Property = Castellana Tower → 47 comments, most of them topic **HVAC & temperature** and negative (pre-build run: 39 HVAC, 31 negative; AI labels can vary by a few). Then **Publish** again.

## Module 4: Survey Genie space — "Ask the survey, read the comments, connect the two"

**Session:** 10:50–11:10 (20 min: Stages 1–4; Stage 5 optional) · **You build:** Genie space "ESG Survey Genie – <your_name>" · **Reference:** "Revantage ESG Survey Genie (Reference)" (folder `spaces`)
**Where:** Genie → **New** (Genie space); the space's **Instructions** and **SQL queries** tabs

### Stage 1: Create the space (3 min)

Genie → **New** → **Select tables manually** → add `ref_survey_answer_facts`, `ref_survey_comment_insights`, `ref_survey_request_status` from `<catalog>.<schema>` → **Create**, warehouse = the workshop warehouse. Leave instructions empty for now.
The space gets an auto-generated name: click the title and rename it to **"ESG Survey Genie – <your_name>"**. Save it in your `spaces` folder (if it was created in your home folder, move it there).
**Checkpoint:** the space is called "ESG Survey Genie – <your_name>" and opens with 3 tables in **Data**.

### Stage 2: Analyse the scores (4 min)

**Prompt** (in your space):
> What is the average score by theme for the 2026-Q4 campaign?

**Expected:** 8 themes, 31 responses each; highest **Communication 3.94**, lowest **Indoor comfort 3.35** (Energy & carbon 3.58).

**Prompt:**
> Which property has the lowest Energy & carbon score across all campaigns?

**Expected:** **Castellana Tower, 1.85** (27 answers over 5 quarters; portfolio 3.45).
**Checkpoint:** click **Show code**: an `AVG(likert_value)` over `ref_survey_answer_facts` with `theme = 'Energy & carbon'` grouped by property.

### Stage 3: Summarise the free text (4 min)

**Prompt:**
> Summarise what tenants at Castellana Tower are saying in their comments

**Expected:** Genie reads `ref_survey_comment_insights`: 47 comments, dominated by **HVAC & temperature** and negative sentiment (pre-build run: 38 negative HVAC comments), with example quotes such as *"Air conditioning broke down twice in October, we had to send staff home one afternoon."* AI labels vary by a few between runs.
Talk track: `sentiment` and `topic` were computed once with `ai_analyze_sentiment` / `ai_classify` in SQL (`code/sql/survey_comment_insights.sql`); Genie can also call `ai_summarize` itself (Stage 4).

### Stage 4: Combine the two (7 min)

**Prompt:**
> Why is Energy & carbon low at Castellana Tower, and what are tenants saying?

**Expected without instructions (seen in pre-build):** the score (1.85 vs portfolio 3.45) but **no comments**: Genie either ignores the comments table or filters it on `question_theme = 'Energy & carbon'`, which never matches (comments answer the free-text questions *Improvement / Recent changes / Collaboration*). That's the teaching moment.

Open **Instructions** → **General Instructions** → click into the instruction editor (not the chat box) → add this text instruction → **Save**:
> When asked WHY a score is low or high at a property, combine both sources: (1) the average likert_value by theme for that property vs the portfolio average from ref_survey_answer_facts (question_type = 'likert'), and (2) what tenants say at that property: ref_survey_comment_insights filtered on property_name only (comments are answers to the free-text questions, so their question_theme is never a Likert theme; use the topic column to spot the cause), count comments by topic and sentiment and summarise them with ai_summarize(array_join(collect_list(comment), '\n'), 60). Quote 2 representative comments.

Ask the same question again in a **new chat**.
**Expected:** score **1.85 vs 3.45** *and* the tenant voice: **31 negative HVAC & temperature comments** (plus ~5 mixed), an `ai_summarize` line like *"Staff complain about poor ventilation and temperature, with HVAC issues causing discomfort and increased energy bills, prompting reconsideration of the lease."* and two quotes.
**Checkpoint:** **Show code** contains `ai_summarize(` and `ref_survey_comment_insights` with a `property_name` filter only.
**If stuck:** ask the reference space **"Revantage ESG Survey Genie (Reference)"** the same question; it also has the two metric views, a combined example SQL and 8 sample questions.

### Stage 5: Optional (take-home): Try more (2 min)

> How has the Energy & carbon score at Amstel Logistics Park changed since the solar project?

**Expected:** 2.60 (2025-Q4) → 3.00 → 3.80 → 3.83 → **4.50** (2026-Q4); favourable share 0 % → 100 %.
> Which property has the lowest survey completion rate this quarter?

**Expected:** **Vltava Business Centre, 16.7 %** (1 of 6) in 2026-Q4.
> Who has not completed the 2026-Q4 survey yet?

**Expected:** **29** contacts (e.g. Joost de Vries and Femke Bakker at Amstel Logistics Park; 5 at Vltava Business Centre).

## Module 5: ai_extract on arrival — "Drop an invoice, get a row"

**Session:** 11:10–11:35 (25 min: Stages 1–4 hands-on; Stages 5–6 facilitator demo on the reference job) · **You build:** `<my_schema>.invoices_extracted` + a job that extracts every new invoice when it lands · **Reference:** table `<catalog>.<schema>.ref_invoices_extracted`, job "[Revantage ESG] Extract utility invoices (Reference)" (file-arrival trigger) and its fallback "[Revantage ESG] Extract utility invoices (Reference, 1-min poll fallback)"
**Where:** Catalog Explorer (volume), SQL editor with the Genie Code panel, Jobs & Pipelines

### Stage 1: Look at the volume (3 min)

Catalog Explorer → `<catalog>` → `<my_schema>` → Volumes → `utility_invoices` → `incoming`. Open `2026-08-04/nl-elec-2026-07-noordzee.pdf` (preview), then `2026-11-03/fr-elec-2026-10-rhone-fax.pdf` (a fax) and `2026-11-02/se-heat-2026-10-fjarrvarme-photo.jpg` (a phone photo).

**Prompt** (Genie Code, SQL editor):
> List every file under /Volumes/<catalog>/<my_schema>/utility_invoices/incoming/ with read_files (binaryFile, recursive): the received date taken from the folder name, the file name and the size in bytes, ordered by received date.

**Expected:** **34 rows**, 2026-08-04 (de-heat-2026-07-fernwaerme.pdf, nl-elec-2026-07-noordzee.pdf) … 2026-11-04 (ie-gas, lu-gas). Nine languages, four currencies (EUR, CZK, SEK, PLN), electricity / gas / water / district heating.
**Checkpoint:** the query above returns 34 rows.
**If stuck:** Stage 1 block of `code/invoices/sql/m05_stage_solutions.sql`.

### Stage 2: ai_extract one invoice (5 min)

**Prompt:**
> Run ai_parse_document and then ai_extract (version 2.0, with a JSON schema) on /Volumes/<catalog>/<my_schema>/utility_invoices/incoming/2026-08-04/nl-elec-2026-07-noordzee.pdf. Extract supplier_name, invoice_number, invoice_date (YYYY-MM-DD), consumption (number), consumption_unit, amount_total (number) and currency (ISO code).

**Expected:** one VARIANT `{"error_message":null,"metadata":{"version":"2.0"},"response":{...}}` with **Noordzee Energie B.V., NZE-2026-0718442, 2026-08-01, 48210, kWh, 15464.28, EUR**. The Dutch PDF prints `48.210 kWh` and `15.464,28 €`: ai_extract returns plain numbers.
**Checkpoint:** `extracted:response.amount_total` = 15464.28.
**If stuck:** Stage 2 block of `m05_stage_solutions.sql`.

### Stage 3: Every invoice into a table (5 min)

**Prompt:**
> Turn this into CREATE OR REPLACE TABLE <my_schema>.invoices_extracted over every file under incoming/ (recursive). One row per file: invoice_id (file name without extension), file_path, received_date (from the folder name, try_to_date), and typed columns from the response: document_type (enum invoice, credit_note, reminder, other), invoices_in_document (integer), supplier_name, invoice_number (not the customer number; null if none), invoice_date, billing_period_start, billing_period_end, meter_id (several separated by ;), utility_type (enum electricity, gas, water, district_heating), consumption (total of all meters), consumption_unit, amount_net, vat_amount, amount_total (this period only, without previous unpaid balances), currency (ISO). Keep the raw output as extraction_json and add extracted_at and qa_status = 'Pending'.

**Expected:** **34 rows** in ~50–90 s. The reference (a slightly longer schema with more descriptions) gets **576 of 596 fields right (96.6 %)**.
**Checkpoint:** `SELECT count(*) FROM <my_schema>.invoices_extracted` → 34.
**If stuck:** Stage 3 block of `m05_stage_solutions.sql`, or compare with `<catalog>.<schema>.ref_invoices_extracted`.

### Stage 4: The edge cases (5 min)

**Prompt:**
> Which rows in <my_schema>.invoices_extracted need a human? Flag document_type other than invoice, more than one invoice in the document, no invoice number, amount_net + vat_amount not equal to amount_total (tolerance 1), several meters, or missing consumption / total. Show invoice_id, the values and a needs_qa_because column.

**Expected (measured on the reference run, may vary by a row):** 7 rows: `it-elec-2026-07-lombardia` (several meters), `es-elec-2026-08-castellana` (13,402.32 printed ≠ base + IVA 14,302.32), `fr-gas-2026-08-gazlyon-avoir` (credit_note, −349.69), `nl-water-2026-09-amstelwater-reminder` (reminder), `fr-water-2026-07-08-eauxlyon-2in1` (invoices_in_document = 2), `lu-water-2026-q3-vdleau` (no invoice number), `fr-elec-2026-10-rhone-fax` (missing values).
Then the point of the module, from the answer key:
> Join <my_schema>.invoices_extracted to <catalog>.<schema>.ref_invoice_ground_truth on invoice_id and show, per invoice, edge_case, expected_outcome and where consumption or amount_total differ from the truth.

**Expected:** what ai_extract **handled** that we expected to break: credit note, ambiguous date 09/10/2026 (it read 9 Oct, correct), CZK + EUR columns, arrears in "Totale da pagare", the phone photo. What it got **wrong without any flag**: `es-water-2026-09-meseta-handwritten` (took the crossed-out printed 1,640 m³ / 5,088.82 instead of the handwritten 1,046 m³ / 3,269.10), `de-water-2026-08-ffmwasser-scan` (2.724 instead of 1,362 m³, in one of two runs). **Not handled:** the fax (invoice number "AE.1026 120561", most fields null). The reference adds a price-plausibility rule (`unit_price_implausible`) that catches the scan; nothing catches the handwriting: that is what the QA app (M6) is for.
**Checkpoint:** `SELECT edge_case, expected_outcome, actual_outcome FROM <catalog>.<schema>.ref_invoice_edge_case_results_v` → 23 handled / 10 needs_qa / 1 not_handled.

### Stage 5: Facilitator demo (participants: take-home): Run it when a file arrives (4 min)

In the session the facilitator shows Stages 5–6 on the reference job **"[Revantage ESG] Extract utility invoices (Reference, 1-min poll fallback)"** (and its file-arrival twin "[Revantage ESG] Extract utility invoices (Reference)"). Build your own job after the workshop.

**Prompt:**
> Write an INSERT INTO <my_schema>.invoices_extracted that extracts only the files under incoming/ whose file_path is not yet in the table, with the same columns as before, and save it as a SQL file invoices_incremental.sql in my workspace folder.

Then **Jobs & Pipelines → Create job**: task type **SQL**, source **File** → `invoices_incremental.sql`, SQL warehouse = the workshop warehouse. **Schedules & Triggers → Add trigger → File arrival**, storage location `/Volumes/<catalog>/<my_schema>/utility_invoices/incoming/` → **Test connection** → Save.
**Expected:** the job shows "File arrival" as trigger; a manual **Run now** finishes in ~20 s with 0 new rows.
**If stuck:** Stage 5 block of `m05_stage_solutions.sql`; reference SQL `code/invoices/sql/extract_invoices.sql` (insert + normalisation + validation flags).

### Stage 6: Facilitator demo (participants: take-home): Drop an invoice live (3 min)

Catalog Explorer → `utility_invoices` → `live_drop` → download `nl-elec-2026-10-noordzee.pdf` (or take it from the Git folder `code/documents/out/live_drop/`) → `incoming` → **Create directory** `2026-11-06` → **Upload to this volume**.
**Expected:** a run starts within ~1 minute (file arrival) or at the next minute (fallback schedule); the row is in the table **~60–90 s after the drop** (measured with the 1-min schedule: 89 s for one file, ~60 s for four). `nl-elec-2026-10-noordzee`: 51,120 kWh, 16,394.91 EUR. Drop `de-elec-2026-10-mainstrom-mahnung.pdf` next: it comes back as `document_type = reminder` (a payment reminder for an invoice already loaded).
**Checkpoint:** `SELECT invoice_id, received_date, amount_total FROM <my_schema>.invoices_extracted WHERE received_date = current_date()`.
**If stuck:** Run now on your job; if the job fails, open the run's SQL output.

## Module 6: QA/QC app — "Your invoice QA app, your queue, one new feature"

**Session:** 11:35–11:50 (15 min) · **You build:** your copy of the invoice QA app (deployed in Module 0) pointed at a QA queue built from your Module 5 table, plus an **"Approve N clean"** bulk action added with Genie Code · **Reference:** app `revantage-invoice-qa` (Next.js + TypeScript, `code/app-invoice-qa/`) on `ref_invoices_extracted` + `ref_invoice_corrections`; the finished feature file `code/prompts/solutions/m06-queue-view.tsx`
**Where:** Workspace (your Git folder `revantage-esg-workshop-kit`: `code/invoices/sql/m06_qa_queue.sql` in the SQL file editor, `code/app-invoice-qa/app.yaml`, `code/app-invoice-qa/src/components/queue-view.tsx`) with Genie Code; Apps (your app page → **Deploy**)

### Stage 1: Build your QA queue and point the app at it (5 min)

Workspace → your Git folder → `code` → `invoices` → `sql` → open **`m06_qa_queue.sql`** (it opens in the SQL file editor, attached to `Serverless Starter Warehouse`). Change the one line `USE <catalog>.<my_schema>;` to your names (e.g. `USE <catalog>.revantage_20261105_jane_doe;`) → **Run** (▶, top left: it runs all 4 statements, ~10 s).
**Expected:** `invoices_qa` (34 rows) and an empty `invoice_corrections` in `<my_schema>`; the result grid: `invoices 34 · pending 34 · unmatched_property 3 · extraction_flags 5`.
Then Workspace → your Git folder → `code` → `app-invoice-qa` → **`app.yaml`**. Under `# ---- Workshop settings` change three values:
- `DATABRICKS_SCHEMA` → `<my_schema>`
- `INVOICES_TABLE` → `invoices_qa`
- `CORRECTIONS_TABLE` → `invoice_corrections`

Apps → your QA app → **Deploy** (after the first deployment it redeploys the same folder straight away, no dialog). About **1 min** (measured 63 s).
**Checkpoint:** the app shows **Needs review 34**, **8 flagged**, the Castellana Tower invoice with **Total ≠ net + VAT**; open any invoice: the PDF from *your* volume shows on the left.
**If stuck:** `[UNRESOLVED_COLUMN]` in `USE` / `TABLE_OR_VIEW_NOT_FOUND` → the USE line still has the placeholders. In the app, `UNRESOLVED_COLUMN … property_id` → `INVOICES_TABLE` still points at `invoices_extracted` (use `invoices_qa`). `PERMISSION_DENIED` / `INSUFFICIENT_PERMISSIONS` → ask the facilitator to re-run the grant script for your app. No Module 5 table? Run the Stage 3 block of `code/invoices/sql/m05_stage_solutions.sql` first (~2 min).

### Stage 2: "Approve all clean" with Genie Code (6 min)

Open `code/app-invoice-qa/src/components/queue-view.tsx`, then **Genie Code** → **New chat**:

**Prompt** (Genie Code, file editor):
> Edit only this file (queue-view.tsx, a Next.js client component with shadcn/ui). Add an "Approve N clean" button next to the Refresh button in the page header, where N is the number of rows currently shown with qa_status 'Pending' and no flags (r.flags.length === 0); disable it when N is 0. On click, ask for confirmation with window.confirm, then approve those invoices one at a time, not in parallel (parallel Delta updates conflict), by POSTing {"action":"approve"} as JSON to /api/invoices/<invoice_id>/review (encodeURIComponent the id), showing progress on the button ("Approving 3/26..."). Afterwards show a sonner toast with how many were approved and how many failed, and refresh the queue with setTick. Use the CheckCheck icon from lucide-react and add data-testid="approve-all-clean" to the button. Don't change anything else.

**Expected:** one edit: the `CheckCheck` and `toast` imports, a progress state, an `approveAllClean` function and the button (≈ 35 lines). Genie Code took ~1.5 min. **Accept all**, then **Deploy** (≈ 1 min).
**Checkpoint:** the header shows **Approve 26 clean** → click → **OK** → the button counts up (≈ 5 s per invoice: **~2 min** for 26, measured 127 s; talk through what "clean" means meanwhile) → toast **Approved 26 invoices** → the queue shows the **8** flagged invoices that need a human. In the SQL editor: `SELECT qa_status, count(*), max(reviewed_by) FROM <catalog>.<my_schema>.invoices_qa GROUP BY 1` → `Approved 26 <your email>`, `Pending 8`.
**If stuck:** copy `code/prompts/solutions/m06-queue-view.tsx` over `code/app-invoice-qa/src/components/queue-view.tsx` and Deploy.

### Stage 3: Review what's left (4 min)

Open the Castellana Tower invoice (received 2026-09-02): the PDF shows a printed total of **14,302.32** but the extraction says **13,402.32** (a €900 gap). Correct `Total` (error type *Wrong value*) → **Save 1 correction** → status **Corrected**. Open the Amstelwater payment reminder (2026-09-30) → **Reject** → reason *Not an invoice*.
**Checkpoint:**
```sql
SELECT c.field_name, c.extracted_value, c.corrected_value, c.error_type, c.corrected_by
FROM <catalog>.<my_schema>.invoice_corrections c ORDER BY c.corrected_at DESC;
```
→ `amount_total 13402.32 → 14302.32 wrong_value <your email>` and `document … rejected not_an_invoice`. Module 7's dashboard reads exactly this kind of table.

## Module 7: QA errors dashboard — "Where do the invoice errors come from?"

**Session:** 11:50–11:55 (5 min: facilitator demo of the reference dashboard "Revantage Invoice QA (Reference)"; participants: take-home) · **You build:** AI/BI dashboard "Invoice QA – <your_name>" · **Reference:** "Revantage Invoice QA (Reference)" (folder `dashboards`; pages Errors by received date, Where errors come from, Extraction accuracy, Backlog & log)
**Where:** Dashboards → **Create dashboard**; Genie Code panel in the dashboard editor

### Stage 1: Data + KPIs (4 min)

**Create dashboard** → rename "Invoice QA – <your_name>" → **More actions (⋮) → File actions → Move…** → your `dashboards` folder. **Data** → **Add data source** → `<catalog>.<schema>.ref_mv_invoice_qa`, `ref_mv_invoice_corrections`, `ref_invoice_edge_case_results_v`.

**Prompt** (Genie Code, dashboard editor):
> Using the metric view ref_mv_invoice_qa, add a page "Errors by received date" with six counters: Invoices received (invoices), Backlog (pending_invoices), Error rate (error_rate, percent with one decimal), Straight-through rate (straight_through_rate, percent), Fields corrected (corrections) and ai_extract field accuracy (field_accuracy, percent).

**Expected:** **34 · 6 · 21.4 % · 78.6 % · 9 · 96.6 %** (6 of 28 reviewed invoices were corrected or rejected; 576 of 596 fields right before QA).
**Checkpoint:** `SELECT MEASURE(invoices), MEASURE(pending_invoices), MEASURE(error_rate) FROM <catalog>.<schema>.ref_mv_invoice_qa` → 34, 6, 0.2143.
**If stuck:** open the reference dashboard → Data tab → copy dataset `kpis`.

### Stage 2: Errors by received date (4 min)

**Prompt:**
> Add a bar chart from ref_mv_invoice_corrections: corrections by received_date (x, as a date), coloured by error_type. Below it, a stacked bar chart from ref_mv_invoice_qa of invoices by received_date coloured by qa_status (Approved, Corrected, Rejected, Pending).

**Expected:** corrections on six received dates: **2026-09-02: 1, 09-23: 1, 09-30: 1, 10-14: 1, 10-21: 4, 10-28: 1**; the 10-21 bar is the handwritten water bill (4 fields). Error types: wrong_value 6, not_an_invoice 1, split_required 1, not_in_portfolio 1. The status chart is grey (Pending) from 2026-11-02.
**Checkpoint:** `SELECT received_date, MEASURE(corrections) FROM <catalog>.<schema>.ref_mv_invoice_corrections GROUP BY ALL ORDER BY 1` → 6 rows as above.

### Stage 3: Where errors come from (4 min)

**Prompt:**
> Add a page "Where errors come from" with horizontal bar charts from ref_mv_invoice_corrections of corrections by field_name, by error_type, by supplier_name and by edge_case (each sorted descending), plus invoices_with_errors by utility_type from ref_mv_invoice_qa, and a multi-select filter on utility_type.

**Expected:** by field **document 3** (the three rejected files), consumption 2, amount_total 2, amount_net 1, vat_amount 1; top supplier **Aguas de la Meseta S.A.** (4 fields, the handwritten correction); by utility **water 4 of 5 reviewed** invoices had errors (scans, a reminder, a 2-in-1 PDF, handwriting) vs electricity 2 of 14, gas 0 of 4, district heating 0 of 5.
**So what for the room:** the errors cluster in paper-born documents (scans, handwriting, municipal water bills), not in a language or currency.

### Stage 4: Accuracy, edge cases and backlog (3 min)

**Prompt:**
> Add a page "Extraction accuracy" with a table from ref_invoice_edge_case_results_v (edge_case, invoice_id, expected_outcome, actual_outcome, fields_correct, fields_scored, wrong_fields, validation_flags, silent_error), not_handled first, and a bar chart of invoices by actual_outcome coloured by expected_outcome.

**Expected:** measured **23 handled / 10 needs_qa / 1 not_handled** vs expected 20 / 11 / 3. First row `fr-elec-2026-10-rhone-fax` (scan_unreadable, 6 / 18). Two **silent errors** (wrong field, no flag): the handwritten correction and the PL gas m³/kWh unit.
**Checkpoint:** `SELECT actual_outcome, count(*) FROM <catalog>.<schema>.ref_invoice_edge_case_results_v GROUP BY 1` → handled 23, needs_qa 10, not_handled 1.
**If stuck:** copy pages from the reference dashboard (it also has "Backlog & log": the 6 Pending invoices and the correction log).
