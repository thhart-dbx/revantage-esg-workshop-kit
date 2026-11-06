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
| 9:00–9:20 | Module 0: Getting started |
| 9:20–9:30 | Module 1a: Lakebase tables synced to Delta |
| 9:30–9:50 | Module 1b: Survey app on Lakebase |
| 9:50–10:00 | Module 2: Quarterly survey alert |
| 10:00–10:20 | Module 3: Survey dashboard |
| 10:20–10:40 | Module 4: Survey Genie space |
| 10:40–10:50 | Break |
| 10:50–11:15 | Module 5: ai_extract on arrival |
| 11:15–11:35 | Module 6: QA/QC app |
| 11:35–11:50 | Module 7: QA errors dashboard |
| 11:50–12:00 | Wrap-up |

## Module 0: Getting started — "Your own copy of the workshop"

**Session:** 9:00–9:20 (20 min: 5 min welcome and ESG context, 15 min hands-on) · **You build:** a Git folder with the workshop repo, and your own copy of the workshop data in `<catalog>.<my_schema>` · **Reference:** the shared starting state in `<catalog>.<schema>` (same data, value for value)
**Where:** Settings (Linked accounts), Workspace (Git folder), notebook on Serverless, Catalog Explorer, SQL editor, Genie Code side panel

### Stage 1: Link GitHub and create the Git folder (5 min)

Profile (top right) → **Settings** → **Linked accounts** → **Git integration** → **Add Git credential** → provider **GitHub** → **Link Git account** and approve (or **Personal access token** with the `repo` scope).
Then **Workspace** → **Home** → **Create** → **Git folder** → Git repository URL `https://github.com/thhart-dbx/revantage-esg-workshop-kit` (provider and folder name fill in) → **Create Git folder**.
**Checkpoint:** the folder shows branch **main** and contains `README.md`, `RUNBOOK.md`, `assets/` and `code/`.
**If stuck:** "Repository not found" / "Invalid Git credentials": your GitHub user hasn't accepted the repo invitation (github.com → notifications) or the link in Settings is missing. Fix it and create the Git folder again. Still stuck: follow along on the shared data in `<catalog>.<schema>` (every module works there too) and fix it at the break.

### Stage 2: Build your copy of the data, and ask Genie Code what it does (7 min)

Open `code/setup/participant_setup`. In the first code cell type `CATALOG = "<catalog>"` and `SHARED_SCHEMA = "<schema>"` (the names shared at the start of the session); leave `MY_SCHEMA` blank (it becomes `<schema>_<your name>`). Compute **Serverless** → **Run all**. (A banner "This file is part of a bundle" can be dismissed.)
While it runs (~2 min), open the **Genie Code** panel (top right):

**Prompt** (Genie Code, notebook):
> Explain what this notebook does, step by step, and list every object it creates.

**Expected:** Genie Code walks through the cells (your settings and schema name, `setup_starting_state.py` generating the survey dataset with a fixed seed, `setup_invoices.py` copying the invoice files and loading the master data, the PASS/FAIL checks) and lists **1 schema**, **9 tables** (`properties`, `tenants`, `survey_contacts`, `survey_questions`, `survey_campaigns`, `survey_requests`, `utility_meters`, `emission_factors`, `ref_invoice_ground_truth`), **1 volume** `utility_invoices` with **34** invoice files in `incoming/<received date>/` and **5** in `live_drop/`.
The notebook's last cell prints **11 PASS** lines (properties 10, tenants 45, survey_contacts 60, survey_questions 11, survey_campaigns 5, survey_requests 300, open campaign 2026-Q4 with 60 requests, utility_meters 28, emission_factors 37, 34 invoice files, 5 live-drop files) and then your names for the rest of the morning:
`<my_schema> = <schema>_<your name>`, `<your_name>`, `<pg_schema> = survey_<your name>`. **Write them down.**
**Checkpoint:** 11 PASS, then "Done. In the module guides: …".
**If stuck:** `AssertionError: Type the catalog and shared schema names…` → the first code cell is still empty; type both names, keep the quotes. `PERMISSION_DENIED` on CREATE SCHEMA → your schema hasn't been created for you yet: tell the facilitator (sandbox job), then **Run all** again (safe to re-run). Until then, use `<catalog>.<schema>` wherever a guide says `<my_schema>`.

### Stage 3: Check your copy (3 min)

**SQL Editor** → **+** → **Query**, then the Genie Code panel:

**Prompt** (Genie Code, SQL editor):
> Compare <catalog>.<my_schema>.survey_requests with <catalog>.<schema>.survey_requests: same number of rows, and how many rows differ? Run it and check the result.

**Expected:** Genie Code writes and runs a query (`EXCEPT ALL` or a full outer join on `request_id`) and reports **300** rows in each and **0** rows that differ. Click **Reject** on the suggested edit if you don't want to keep the query.
**Checkpoint:** Catalog → `<catalog>` → `<my_schema>` shows the 9 tables and the volume `utility_invoices` (open it: folders `incoming/2026-08-04` … `incoming/2026-11-04`, and `live_drop`).
**If stuck:**
```sql
SELECT COUNT(*) AS differences FROM (
  SELECT * FROM <catalog>.<my_schema>.survey_requests
  EXCEPT ALL
  SELECT * FROM <catalog>.<schema>.survey_requests)
```

## Module 1a: Lakebase tables synced to Delta — "Where survey answers land"

**Session:** 9:20–9:30 (10 min, first part of Module 1) · **You build:** Postgres schema `survey_<your_name>` with tables `survey_responses` + `survey_answers` in Lakebase, replicated to Delta in `<catalog>.<my_schema>` by Lakehouse Sync · **Reference:** Lakebase project `revantage-esg` → branch `production` → database `esg_survey` → schema `survey`; Delta `<catalog>.<schema>.lb_survey_responses_history` / `lb_survey_answers_history` and views `ref_survey_responses` / `ref_survey_answers`
**Where:** Catalog / Compute → **Lakebase Postgres** → project `revantage-esg` → **SQL editor** (database `esg_survey`) with Genie Code; branch page → **Lakehouse sync**

### Stage 1: Create your schema (1 min)

Open the SQL editor on project `revantage-esg`, database **`esg_survey`**:
```sql
CREATE SCHEMA survey_<your_name>;
```
**Checkpoint:** `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'survey%'` lists `survey` and `survey_<your_name>`.

### Stage 2: Turn on Lakehouse Sync for the (still empty) schema (3 min)

Project `revantage-esg` → branch **production** → **Lakehouse sync** → **Start sync**: source database `esg_survey`, schema `survey_<your_name>`; destination catalog `<catalog>`, schema `<my_schema>`.

**Expected:** the sync appears for schema `survey_<your_name>`; it syncs *every* current and future table in that schema.

### Stage 3: Create the two tables (4 min)

**Prompt** (Genie Code, Lakebase SQL editor):
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
→ `INSERT 0 9`. Within ~10–30 s, in the Databricks SQL editor:
`SELECT count(*) FROM <catalog>.<my_schema>.lb_survey_answers_history` → **9** (and `lb_survey_responses_history` → 1). Each row carries `_pg_change_type` (insert / update_preimage / update_postimage / delete) and `_pg_lsn`: it's a change log (SCD type 2), not a copy.
**If stuck:** run `code/lakebase/survey_ddl.sql` with `${pg_schema}` replaced by `survey_<your_name>`; or look at the reference schema `survey` and its Delta tables in `<catalog>.<schema>`.

### Stage 4: Current state in Delta (2 min, show)

The change log becomes "the table" with a view that keeps the latest change per key and drops deletes. Show `ref_survey_responses` in `code/sql/survey_reference.sql` (also converts the `response_id` binary back to a UUID string).
**Checkpoint:** `SELECT count(*) FROM <catalog>.<schema>.ref_survey_responses` → **216**; `ref_survey_answers` → **2,127**. Delete your test row (`DELETE FROM survey_<your_name>.survey_responses`) and watch a `delete` row appear in your history table.

## Module 1b: Survey app on Lakebase — "Tenant ESG & Satisfaction Survey"

**Session:** 9:30–9:50 (20 min, second half of Module 1) · **You build:** a survey app (Databricks App) that reads the questions from Delta and writes each response to Lakebase in one transaction · **Reference:** app `revantage-esg-survey` (Next.js + TypeScript, `code/app/`)
**Where:** Apps (**New → App**), the app's source folder in the workspace with Genie Code; Lakebase SQL editor for the checkpoints

### Stage 1: Start from a template and add the two resources (4 min)

**New → App → Install from templates → Hello world → Streamlit**. Name `esg-survey-<your_name>`, Create, and wait for **Running** (~2–3 min).
Then app page → **Edit → App resources → Add resource**:
- **SQL warehouse** (Can use), resource key **`sql-warehouse`**
- **Lakebase / Postgres database**: project `revantage-esg`, branch `production`, database `esg_survey` (Can connect and create), resource key **`postgres`**

Save. The Postgres resource injects `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` (your app's service principal) and `PGSSLMODE` into the app.
**Checkpoint:** the template renders; **Edit in workspace** shows `app.py`, `app.yaml`, `requirements.txt`. Note your app's **service principal ID** (app page → Authorization / Overview); you need it in Stage 4.
**If stuck:** open the reference app `revantage-esg-survey` and show the flow while the template deploys.

### Stage 2: Questions from Delta (5 min)

Open `app.py` and Genie Code:
> The app has a SQL warehouse resource named sql-warehouse; in app.yaml read it into DATABRICKS_WAREHOUSE_ID with valueFrom: sql-warehouse (no resources block in app.yaml). Using databricks-sql-connector with the Databricks SDK's credentials (Config().authenticate), read <catalog>.<my_schema>.survey_questions ordered by question_order. Show a survey titled "Tenant ESG & Satisfaction Survey": for each question_type 'likert' row show its theme and question_text with a horizontal 1–5 radio scale labelled Strongly disagree, Disagree, Neutral, Agree, Strongly agree (no default selection); then a text area for each question_type 'text' row. Add databricks-sql-connector and databricks-sdk to requirements.txt.

**Expected:** after **Deploy**, 8 statements (Energy & carbon … Overall satisfaction) with 1–5 scales and 3 text areas (Improvement, Recent changes, Collaboration).
**Checkpoint:** the counts on screen match `SELECT question_type, count(*) FROM <catalog>.<my_schema>.survey_questions GROUP BY 1` → likert 8, text 3.
**If stuck:** the reference query is in `code/app/src/lib/survey-data.ts` (`getQuestions`).

### Stage 3: Campaign from the link, contact from the email (4 min)

> Read the campaign id from the URL query parameter campaign (st.query_params); if it's missing use the most recent row of <catalog>.<my_schema>.survey_campaigns with status 'open'. Show the campaign and its closes_at date at the top. Before the questions, ask for the respondent's work email and look it up case-insensitively in <catalog>.<my_schema>.survey_contacts joined to tenants (tenant_name) and properties (property_name, city) using a parameterized query. If there is no match, show a friendly error and hide the survey; if there is a match, show "Welcome, <contact_name>" with the company and property, then the questions.

**Expected:** open `<your app url>/?campaign=2026-Q4`. `joost.devries@amstel1.example` → **Joost de Vries · Amstel Freight Services B.V. · Amstel Logistics Park, Amsterdam**; `nobody@example.com` → the friendly error.
**Checkpoint:** `SELECT contact_name FROM <catalog>.<my_schema>.survey_contacts WHERE lower(contact_email) = 'joost.devries@amstel1.example'` → Joost de Vries.

### Stage 4: Submit to Lakebase in one transaction (5 min)

First let your app write to your Postgres schema. In the **Lakebase SQL editor** (database `esg_survey`), replace `<app_sp>` with the service principal ID from Stage 1:
```sql
GRANT USAGE ON SCHEMA <pg_schema> TO "<app_sp>";
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA <pg_schema> TO "<app_sp>";
```
Then Genie Code:
> Add a Submit button. Connect to Lakebase with psycopg using the PGHOST, PGPORT, PGDATABASE and PGUSER environment variables, sslmode require, and as password a fresh OAuth token from the Databricks SDK (WorkspaceClient().config.oauth_token().access_token); add psycopg[binary] to requirements.txt. Require an answer for every Likert statement and show which ones are missing. On submit, in ONE transaction insert a row into <pg_schema>.survey_responses (campaign_id, contact_id, contact_email, property_id) returning response_id, then one row per answered question into <pg_schema>.survey_answers (response_id, question_id, likert_value for likert, text_value for non-empty text). If this contact already has a response for this campaign, show "You've already completed this survey" instead of the form. After a successful submit show a thank-you message with the response_id.

**Expected:** submit as Joost de Vries (any answers) → thank-you with a UUID; reload and enter the same email → "already completed".
**Checkpoint (Lakebase SQL editor):**
```sql
SELECT r.response_id, r.contact_email, count(a.*) AS answers, round(avg(a.likert_value), 2) AS avg_score
FROM <pg_schema>.survey_responses r JOIN <pg_schema>.survey_answers a USING (response_id)
WHERE r.campaign_id = '2026-Q4' GROUP BY 1, 2 ORDER BY max(r.submitted_at) DESC;
```
→ your row, `joost.devries@amstel1.example`, **8 answers + one per text box you filled** (8–11).
**If stuck:** the reference transaction is `submitResponse` in `code/app/src/lib/lakebase.ts` (advisory lock + duplicate check + both inserts, then COMMIT).

### Stage 5: The response is in Delta (2 min)

Lakehouse Sync (Module 1a) replicates `<pg_schema>` to Delta within seconds.
**Checkpoint (SQL editor):** `SELECT * FROM <catalog>.<my_schema>.lb_survey_responses_history WHERE contact_email = 'joost.devries@amstel1.example' ORDER BY _timestamp DESC` → an insert row with your `response_id` (use the current-state view from Module 1a if you built one).

## Module 2: Quarterly survey alert — "Ask every tenant, every quarter"

**Session:** 9:50–10:00 (10 min) · **You build:** a SQL alert "Survey request – <your_name>" that runs quarterly and emails the survey link for the open campaign · **Reference:** alert "Quarterly tenant ESG survey request (Reference)" (folder `alerts`) + job "[Revantage ESG workshop] Send survey request email now (Reference)" to send it on demand
**Where:** SQL editor with Genie Code → **Alerts** (New → Alert)

### Stage 1: The alert query (3 min)

**Prompt** (Genie Code, SQL editor):
> Write a query on <catalog>.<schema>.survey_campaigns joined to <catalog>.<schema>.ref_survey_request_status on campaign_id, for the campaign with status 'open' only. Return one row: campaign_id, campaign_name, closes_on (closes_at formatted like '30 November 2026'), survey_link = '<your app url>' || '/?campaign=' || campaign_id, and contacts_pending = number of requests that are not completed. Run it.

**Expected:** 1 row: `2026-Q4` · Tenant ESG & satisfaction survey 2026-Q4 · 30 November 2026 · `<your app url>/?campaign=2026-Q4` · **29** pending (of 60; 31 completed).
**Checkpoint:** open the `survey_link` value in a new tab: your app shows the 2026-Q4 survey.
**If stuck:** copy the query from the reference alert (Alerts → "Quarterly tenant ESG survey request (Reference)").

### Stage 2: Create the alert (5 min)

Save the query, then **New → Alert** (or the query's **Schedule / Create alert** menu):
- **Condition:** `contacts_pending` **>** `0` (the alert fires while someone still has to answer). If the query returns no rows → OK.
- **Schedule:** cron `0 0 8 6 1,4,7,10 ?`, timezone Europe/Luxembourg = 08:00 on 6 January, April, July, October (first week of each quarter).
- **Notifications:** add yourself. Turn on **custom template**:
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

### Stage 3: Send it now (2 min)

Don't wait for January: on the alert page **Run now** (or run the reference job **Send survey request email now (Reference)**, which wraps the alert in an *alert task*).
**Expected:** status **Triggered**; within ~30 s an email from Databricks with subject **"Revantage tenant ESG survey 2026-Q4: 5 minutes to tell us about your building"** and the body above, with your link `…/?campaign=2026-Q4` and "closes on 30 November 2026".
**Checkpoint:** click the link in the email: the survey opens on 2026-Q4.
**If stuck:** subscribe to the reference alert and run the reference job.

## Module 3: Survey dashboard — "Who answered, and what did they say?"

**Session:** 10:00–10:20 (20 min) · **You build:** AI/BI dashboard "ESG Survey – <your_name>" · **Reference:** "Revantage ESG Survey (Reference)" (folder `dashboards`; pages Survey completion, Results analysis, Tenant comments)
**Where:** Dashboards → **Create dashboard**; Genie Code panel in the dashboard editor

### Stage 1: Data + completion KPIs (5 min)

**Create dashboard** → rename "ESG Survey – <your_name>". **Data** → **Add data source** → `<catalog>.<schema>.ref_survey_request_status`, `ref_survey_answer_facts`, `ref_survey_comment_insights`.

**Prompt** (Genie Code, dashboard editor):
> Using ref_survey_request_status, add a page "Survey completion" with four counters: Requests sent (count of request_id), Completed (requests where completed is true), Not completed, and Completion rate (completed / requests, as a percentage with one decimal). Add a global single-select filter on campaign_id defaulting to 2026-Q4 and a multi-select filter on property_name. Run the datasets and check the numbers.

**Expected (2026-Q4):** **60 · 31 · 29 · 51.7 %**. Clear the campaign filter → 300 · 216 · 84 · 72.0 %.
**Checkpoint:** `SELECT MEASURE(requests_sent), MEASURE(completed), MEASURE(completion_rate) FROM <catalog>.<schema>.ref_mv_survey_completion WHERE campaign_id = '2026-Q4'` → 60, 31, 0.5167.
**If stuck:** open the reference dashboard → Data tab → copy `ds_requests` (its measures are the `columns` at the bottom).

### Stage 2: Completed / not completed list (4 min)

**Prompt:**
> On the same page add a bar chart of completion rate by property_name (sorted ascending) and a table of contacts with status ('Completed' or 'Not completed' from completed), contact_name, contact_email, tenant_name, property_name, sent_at and submitted_at, not completed first.

**Expected (2026-Q4):** lowest bar **Vltava Business Centre 16.7 %** (1 of 6), then Grand Rue Retail Quarter and Vistula Logistics Centre 33.3 %; highest Docklands Studios 83.3 %. The table has 60 rows, the first 29 "Not completed" (e.g. Joost de Vries, Femke Bakker at Amstel Logistics Park).
**Checkpoint:** set Property = Vltava Business Centre → 6 rows, 5 not completed. Across all campaigns Vltava is the outlier: **26.7 %** vs 63–90 % elsewhere.

### Stage 3: Results analysis (6 min)

**Prompt:**
> Add a page "Results analysis" from ref_survey_answer_facts where question_type = 'likert' (likert_value 1 = strongly disagree to 5 = strongly agree): counters for average score (2 decimals), favourable share (likert_value 4 or 5, percent) and number of responses (distinct response_id); a bar chart of average score by theme and one by property_name; and a heatmap of average score with theme on x and property_name on y. Bind the campaign and property filters to this dataset too.

**Expected (2026-Q4):** **3.73 · 66.5 % · 31 responses**; lowest theme Indoor comfort 3.35. Clear the campaign filter (all quarters): **3.64 · 61.1 % · 216**; lowest property **Castellana Tower 2.85**, highest Docklands Studios 4.23. In the heatmap, Castellana Tower × Energy & carbon **1.85** and × Indoor comfort **1.63** are the two darkest cells (portfolio 3.45 / 3.44).

### Stage 4: Trend (3 min)

**Prompt:**
> Add a line chart of average score by campaign_id (x) and theme (color) from a second dataset over the same Likert answers that is NOT bound to the campaign filter, so it always shows all five quarters. Keep the property filter on it.

**Expected:** set Property = **Amstel Logistics Park**: Energy & carbon climbs **2.60 → 3.00 → 3.80 → 3.83 → 4.50** (2025-Q4 → 2026-Q4) after the LED retrofit + rooftop solar went live in March 2026. Castellana Tower stays at the bottom on Energy & carbon (1.5–2.2) in every quarter.
**If stuck:** copy `ds_scores_trend` and the "Score trend by theme and quarter" widget from the reference.

### Stage 5: Comments (2 min)

**Prompt:**
> Add a page "Tenant comments" from ref_survey_comment_insights: a bar chart of comment count by topic colored by sentiment, and a table of campaign_id, property_name, tenant_name, sentiment, topic and comment.

**Expected:** 399 comments overall; filter Property = Castellana Tower → 47 comments, most of them topic **HVAC & temperature** and negative (pre-build run: 39 HVAC, 31 negative; AI labels can vary by a few). Then **Publish**.

## Module 4: Survey Genie space — "Ask the survey, read the comments, connect the two"

**Session:** 10:20–10:40 (20 min) · **You build:** Genie space "ESG Survey Genie – <your_name>" · **Reference:** "Revantage ESG Survey Genie (Reference)" (folder `spaces`)
**Where:** Genie → **New** (Genie space); the space's **Instructions** and **SQL queries** tabs

### Stage 1: Create the space (3 min)

Genie → **New** → add tables `ref_survey_answer_facts`, `ref_survey_comment_insights`, `ref_survey_request_status` from `<catalog>.<schema>` → title "ESG Survey Genie – <your_name>", warehouse = the workshop warehouse. Leave instructions empty for now.
**Checkpoint:** the space opens with 3 tables in **Data**.

### Stage 2: Analyse the scores (4 min)

**Prompt** (in your space):
> What is the average score by theme for the 2026-Q4 campaign?

**Expected:** 8 themes, 31 responses each; highest **Communication 3.94**, lowest **Indoor comfort 3.35** (Energy & carbon 3.58).

**Prompt:**
> Which property has the lowest Energy & carbon score?

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

Open **Instructions** → add this text instruction:
> When asked WHY a score is low or high at a property, combine both sources: (1) the average likert_value by theme for that property vs the portfolio average from ref_survey_answer_facts (question_type = 'likert'), and (2) what tenants say at that property: ref_survey_comment_insights filtered on property_name only (comments are answers to the free-text questions, so their question_theme is never a Likert theme; use the topic column to spot the cause), count comments by topic and sentiment and summarise them with ai_summarize(array_join(collect_list(comment), '\n'), 60). Quote 2 representative comments.

Ask the same question again in a **new chat**.
**Expected:** score **1.85 vs 3.45** *and* the tenant voice: **31 negative HVAC & temperature comments** (plus ~5 mixed), an `ai_summarize` line like *"Staff complain about poor ventilation and temperature, with HVAC issues causing discomfort and increased energy bills, prompting reconsideration of the lease."* and two quotes.
**Checkpoint:** **Show code** contains `ai_summarize(` and `ref_survey_comment_insights` with a `property_name` filter only.
**If stuck:** ask the reference space the same question; it also has the two metric views, a combined example SQL and 8 sample questions.

### Stage 5: Try more (2 min, optional)

> How has the Energy & carbon score at Amstel Logistics Park changed since the solar project?

**Expected:** 2.60 (2025-Q4) → 3.00 → 3.80 → 3.83 → **4.50** (2026-Q4); favourable share 0 % → 100 %.
> Which property has the lowest survey completion rate this quarter?

**Expected:** **Vltava Business Centre, 16.7 %** (1 of 6) in 2026-Q4.
> Who has not completed the 2026-Q4 survey yet?

**Expected:** **29** contacts (e.g. Joost de Vries and Femke Bakker at Amstel Logistics Park; 5 at Vltava Business Centre).

## Module 5: ai_extract on arrival — "Drop an invoice, get a row"

**Session:** 10:50–11:15 (25 min) · **You build:** `<my_schema>.invoices_extracted` + a job that extracts every new invoice when it lands · **Reference:** table `<catalog>.<schema>.ref_invoices_extracted`, job "[Revantage ESG] Extract utility invoices (Reference)" (file-arrival trigger) and its fallback "[Revantage ESG] Extract utility invoices (Reference, 1-min poll fallback)"
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

### Stage 5: Run it when a file arrives (4 min)

**Prompt:**
> Write an INSERT INTO <my_schema>.invoices_extracted that extracts only the files under incoming/ whose file_path is not yet in the table, with the same columns as before, and save it as a SQL file invoices_incremental.sql in my workspace folder.

Then **Jobs & Pipelines → Create job**: task type **SQL**, source **File** → `invoices_incremental.sql`, SQL warehouse = the workshop warehouse. **Schedules & Triggers → Add trigger → File arrival**, storage location `/Volumes/<catalog>/<my_schema>/utility_invoices/incoming/` → **Test connection** → Save.
**Expected:** the job shows "File arrival" as trigger; a manual **Run now** finishes in ~20 s with 0 new rows.
**If stuck:** Stage 5 block of `m05_stage_solutions.sql`; reference SQL `code/invoices/sql/extract_invoices.sql` (insert + normalisation + validation flags).

### Stage 6: Drop an invoice live (3 min)

Catalog Explorer → `utility_invoices` → `live_drop` → download `nl-elec-2026-10-noordzee.pdf` (or take it from the Git folder `code/documents/out/live_drop/`) → `incoming` → **Create directory** `2026-11-06` → **Upload to this volume**.
**Expected:** a run starts within ~1 minute (file arrival) or at the next minute (fallback schedule); the row is in the table **~60–90 s after the drop** (measured with the 1-min schedule: 89 s for one file, ~60 s for four). `nl-elec-2026-10-noordzee`: 51,120 kWh, 16,394.91 EUR. Drop `de-elec-2026-10-mainstrom-mahnung.pdf` next: it comes back as `document_type = reminder` (a payment reminder for an invoice already loaded).
**Checkpoint:** `SELECT invoice_id, received_date, amount_total FROM <my_schema>.invoices_extracted WHERE received_date = current_date()`.
**If stuck:** Run now on your job; if the job fails, open the run's SQL output.

## Module 6: QA/QC app — "Utility invoice QA"

**Session:** 11:15–11:35 (20 min) · **You build:** a Databricks App where a QA/QC reviewer checks each extracted invoice beside its PDF, corrects fields, and writes the corrections back to Delta · **Reference:** app `revantage-invoice-qa` (Next.js + TypeScript, `code/app-invoice-qa/`) on `ref_invoices_extracted` + `ref_invoice_corrections`
**Where:** SQL editor (Stage 1), Apps (**New → App**), the app's source folder in the workspace with Genie Code

### Stage 1: Corrections table and grants (3 min)

SQL editor, Genie Code:
> Create the table <catalog>.<my_schema>.invoice_corrections if it doesn't exist, with columns correction_id STRING, invoice_id STRING, field_name STRING, extracted_value STRING, corrected_value STRING, error_type STRING, comment STRING, corrected_by STRING, corrected_at TIMESTAMP, received_date DATE, and a table comment saying it holds one row per field a QA reviewer corrected. Run it.

**Expected:** `invoice_corrections` exists, 0 rows (same columns as `ref_invoice_corrections`).
**Checkpoint:** `DESCRIBE TABLE <catalog>.<my_schema>.invoice_corrections` → 10 columns.
**If stuck:** `CREATE TABLE IF NOT EXISTS <catalog>.<my_schema>.invoice_corrections LIKE <catalog>.<schema>.ref_invoice_corrections` (copies the columns, no rows).

### Stage 2: Start from a template (3 min)

**New → App → Install from templates → Hello world → Streamlit**. Name `invoice-qa-<your_name>`, Create, wait for **Running** (~2–3 min).
Then app page → **Edit → App resources → Add resource → SQL warehouse** (Can use), resource key **`sql-warehouse`**, Save.
Note your app's **service principal ID** (app page → Overview / Authorization). The facilitator (or you, if you own the schema) grants it:
```sql
GRANT USE CATALOG ON CATALOG <catalog> TO `<app_sp>`;
GRANT USE SCHEMA, SELECT, MODIFY ON SCHEMA <catalog>.<my_schema> TO `<app_sp>`;
GRANT READ VOLUME ON VOLUME <catalog>.<schema>.utility_invoices TO `<app_sp>`;   -- the volume your file_path points at
```
**Checkpoint:** the template renders; **Edit in workspace** shows `app.py`, `app.yaml`, `requirements.txt`.
**If stuck:** open the reference app `revantage-invoice-qa` and walk the flow while the template deploys.

### Stage 3: The QA queue (5 min)

Open `app.py` and Genie Code:
> The app has a SQL warehouse resource named sql-warehouse; in app.yaml read it into DATABRICKS_WAREHOUSE_ID with valueFrom: sql-warehouse (no resources block in app.yaml). Using databricks-sql-connector with the Databricks SDK's credentials (Config().authenticate), show a page "Invoice QA queue" listing <catalog>.<my_schema>.invoices_extracted left-joined to properties (property_name): received_date, supplier_name, property_name, utility_type, invoice_number, consumption with consumption_unit, amount_total with currency, qa_status. Add sidebar filters for qa_status (default Pending), received date range, supplier, utility type and property, applied in SQL with named parameters, never string formatting. Add a Flags column listing: "Missing invoice number" when invoice_number is null, "Total ≠ net + VAT" when abs(amount_net + vat_amount - amount_total) > 0.5, "Unmatched property" when property_id is null, and "Unusual consumption" when consumption_kwh per day of the billing period is negative or more than twice / less than half the median for the same property and utility type. Sort newest first. Add databricks-sql-connector and databricks-sdk to requirements.txt.

**Expected:** after **Deploy**, the Pending queue newest first. On a fresh extraction: **34** Pending rows, **6** with a flag; the Castellana Tower electricity invoice (received 2026-09-02) shows **Total ≠ net + VAT**, the Luxembourg water invoice (2026-10-14) **Missing invoice number**, the Rotterdam invoice (2026-10-28) **Unmatched property**.
**Checkpoint:** `SELECT count(*) FROM <catalog>.<my_schema>.invoices_extracted WHERE qa_status = 'Pending'` = the row count in the app.
**If stuck:** compare with the reference query (`baseCte` + `listInvoices` in `code/app-invoice-qa/src/lib/invoices.ts`) and flag rules (`code/app-invoice-qa/src/lib/flags.ts`).

### Stage 4: Review beside the PDF and save corrections (6 min)

> Add a review view: selecting an invoice in the queue shows its PDF on the left and an editable form of the extracted fields on the right (supplier_name, invoice_number, invoice_date, billing_period_start, billing_period_end, property_id as a dropdown of properties, meter_id, utility_type, consumption, consumption_unit, consumption_kwh, amount_net, vat_amount, amount_total, currency). Read the PDF bytes with the Databricks SDK Files API (WorkspaceClient().files.download(file_path).contents.read()) and show them with st.pdf (add streamlit[pdf] to requirements.txt). For every field the reviewer changed, ask for an error type (wrong_value, missing, unit, date_format, currency, other) and an optional comment. On "Save corrections": take the reviewer from st.context.headers["X-Forwarded-Email"]; INSERT one row per changed field into <catalog>.<my_schema>.invoice_corrections (a Python uuid4 string as correction_id: Spark rejects uuid() inside INSERT … VALUES, invoice_id, field_name, the old value as extracted_value, the new value as corrected_value, error_type, comment, the reviewer as corrected_by, current_timestamp() as corrected_at, the invoice's received_date); then UPDATE the invoice row with the new values, qa_status = 'Corrected', reviewed_by = the reviewer, reviewed_at = current_timestamp(). Use named parameters for every value. Disable Save when nothing changed.

**Expected:** open the Castellana Tower invoice, read the printed total on the PDF, correct `amount_total` (error type `wrong_value`), Save → status **Corrected**, the row leaves the Pending queue.
**Checkpoint:**
```sql
SELECT c.field_name, c.extracted_value, c.corrected_value, c.error_type, c.corrected_by, i.qa_status, i.reviewed_by
FROM <catalog>.<my_schema>.invoice_corrections c
JOIN <catalog>.<my_schema>.invoices_extracted i USING (invoice_id)
ORDER BY c.corrected_at DESC LIMIT 5;
```
→ one row per field you changed, `corrected_by` = your email, `qa_status = 'Corrected'`.
**If stuck:** the reference write-back is `review()` in `code/app-invoice-qa/src/lib/invoices.ts` (server-side diff against the current row, allow-listed columns, typed `CAST(:v AS …)` parameters).

### Stage 5: Approve and reject (3 min)

> Add two more buttons in the review view. "Approve as extracted" (only when nothing was changed) sets qa_status = 'Approved', reviewed_by and reviewed_at without writing corrections. "Reject" asks for a required comment and a reason (not_an_invoice, split_required, other), inserts one invoice_corrections row with field_name 'document', the document_type (or 'invoice') as extracted_value, 'rejected' as corrected_value, the reason as error_type, and sets qa_status = 'Rejected'. Show the corrections already logged for the selected invoice under the form.

**Expected:** Reject the Amstelwater **payment reminder** (2026-09-30) as `not_an_invoice`; Approve a clean invoice (e.g. Docklands / Leinster gas, 2026-11-04).
**Checkpoint:** `SELECT qa_status, count(*) FROM <catalog>.<my_schema>.invoices_extracted GROUP BY 1` → Pending 31, Corrected 1, Approved 1, Rejected 1 on a fresh copy of the reference data (your counts: whatever you reviewed).
**If stuck:** use the reference app for the rest of the module; Module 7's dashboard reads `ref_invoice_corrections`.

## Module 7: QA errors dashboard — "Where do the invoice errors come from?"

**Session:** 11:35–11:50 (15 min) · **You build:** AI/BI dashboard "Invoice QA – <your_name>" · **Reference:** "Revantage Invoice QA (Reference)" (folder `dashboards`; pages Errors by received date, Where errors come from, Extraction accuracy, Backlog & log)
**Where:** Dashboards → **Create dashboard**; Genie Code panel in the dashboard editor

### Stage 1: Data + KPIs (4 min)

**Create dashboard** → rename "Invoice QA – <your_name>". **Data** → **Add data source** → `<catalog>.<schema>.ref_mv_invoice_qa`, `ref_mv_invoice_corrections`, `ref_invoice_edge_case_results_v`.

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
