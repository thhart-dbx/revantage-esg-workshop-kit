# Module 1a: Lakebase tables synced to Delta — "Where survey answers land"

**Session:** 9:25–9:45 (20 min) · **You build:** Postgres schema `survey_<your_name>` with tables `survey_responses` + `survey_answers` in Lakebase, replicated to Delta in `<catalog>.<my_schema>` by Lakehouse Sync · **Reference:** Lakebase project `revantage-esg` → branch `production` → database `esg_survey` → schema `survey`; Delta `<catalog>.<schema>.lb_survey_responses_history` / `lb_survey_answers_history` and views `ref_survey_responses` / `ref_survey_answers`
**Starting state:** Lakebase Autoscaling project `revantage-esg` (Postgres 17) with database `esg_survey` (owned by the workspace `users` group, so everyone can create a schema); the reference schema `survey` holds the history: **216 responses, 2,127 answers** (5 campaigns 2025-Q4 … 2026-Q4); your Delta copy `<catalog>.<my_schema>` from Module 0
**Where:** Catalog / Compute → **Lakebase Postgres** → project `revantage-esg` → **SQL editor** (database `esg_survey`) with Genie Code; branch page → **Lakehouse sync**

Why Lakebase: the survey app writes one response at a time, in a transaction, with constraints (one answer per question, scores 1–5). That's OLTP: Postgres. The analysis (dashboard, Genie) runs on Delta. Lakehouse Sync streams every insert/update/delete from Postgres into Delta within seconds, no pipeline to build.

## Stage 1: Create your schema (3 min)

Open the SQL editor on project `revantage-esg` (shown as **Revantage ESG survey (Lakebase)** in the project list). Clear the sample SQL in the editor, then set the database dropdown to **`esg_survey`** (it opens on `databricks_postgres`):
```sql
CREATE SCHEMA survey_<your_name>;
```
**Checkpoint:** `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'survey%'` lists `survey` and `survey_<your_name>`.

## Stage 2: Turn on Lakehouse Sync for the (still empty) schema (5 min)

Project `revantage-esg` → branch **production** → **Overview** → tab **Lakebase CDF** (the UI name for Lakehouse Sync) → **Start**: Database `esg_survey`, Schema `survey_<your_name>`; destination Catalog `<catalog>` (type the name: the dropdown lists every catalog in the metastore), Schema `<my_schema>`. The schema list only shows `survey_<your_name>` once Stage 1 has run, and it appears as an option only after you pick the database.
Facilitator CLI equivalent (same thing, verified):
`databricks postgres create-cdf-config projects/revantage-esg/branches/production/databases/esg-survey <catalog> <my_schema> survey_<your_name> --cdf-config-id survey_<your_name>_to_delta`

**Expected:** the sync appears for schema `survey_<your_name>`; it syncs *every* current and future table in that schema.
**Watch for (seen in pre-build):** we turned the sync on *after* creating and filling the tables in one scratch schema and both tables stayed **Skipped** ("No configuration found …"), even after deleting and recreating the sync; turning the sync on first (this order) worked every time. If you see Skipped: delete the sync, create a new schema (`survey_<your_name>2`), and repeat Stages 2–3 there.

## Stage 3: Create the two tables (9 min)

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

## Stage 4: Current state in Delta (3 min, show)

The change log becomes "the table" with a view that keeps the latest change per key and drops deletes. Show `ref_survey_responses` in `code/sql/survey_reference.sql` (also converts the `response_id` binary back to a UUID string).
**Checkpoint:** `SELECT count(*) FROM <catalog>.<schema>.ref_survey_responses` → **216**; `ref_survey_answers` → **2,127**. Delete your test row (`DELETE FROM survey_<your_name>.survey_responses`) and watch a `delete` row appear in your history table.

## Wrap-up
- **So what:** the survey app gets a real transactional database, and the ESG team gets the same answers in the lakehouse seconds later, governed in Unity Catalog, with no ETL job.
- **Snowflake equivalent:** Hybrid Tables (Unistore) + Streams/Tasks to move rows into analytics tables; here it's full Postgres plus native CDC into Delta.
- **Facilitator notes:** participants need permission to use project `revantage-esg` (Lakebase project permissions) and a Postgres role in the `production` branch; the `esg_survey` database is owned by the `users` group role, so any member can `CREATE SCHEMA`. Reset the reference history with `databricks bundle run lakebase_setup --params mode=reset`.
- **Facilitator:** Stages 1–4 rehearsed in the Lakebase UI on 2026-11-05 (~25 min). In Stage 3 Genie Code may stop to ask which role and database to use: answer "Use <your_email>. Run everything in database esg_survey, not databricks_postgres." Non-owner participant permissions were not tested.
