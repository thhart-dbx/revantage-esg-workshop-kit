# Module 1b: Survey app on Lakebase — "Your survey app, your data, one new feature"

**Session:** 9:45–10:00 (15 min) · **You build:** your own copy of the tenant survey app (deployed in Module 0) pointed at your Delta copy and your Lakebase schema, plus one new feature added with Genie Code · **Reference:** app `revantage-esg-survey` (Next.js + TypeScript, `code/app/`); the finished feature file `code/prompts/solutions/m01b-survey-flow.tsx`
**Starting state:** your app `esg-survey-<your_name>` deployed from `<your Git folder>/code/app` in Module 0 (resources `sql-warehouse` and `postgres` → `esg_survey`); your Delta copy `<catalog>.<my_schema>` (Module 0: `survey_campaigns` 5, `survey_questions` 11 = 8 Likert + 3 free text, `survey_contacts` 60); your Postgres schema `survey_<your_name>` with `survey_responses` + `survey_answers` and Lakehouse Sync to `<my_schema>` (Module 1a); the facilitator has run `code/scripts/grant_participant_apps.py` after Module 1a
**Where:** Workspace (your Git folder `revantage-esg-workshop-kit`: `code/app/app.yaml`, `code/app/src/components/survey-flow.tsx`) with Genie Code; Apps (your app page → **Deploy**); Lakebase SQL editor; SQL editor

In Module 0 your app went live on the shared workshop data (read-only). Now you switch it to your own data in one
place, `app.yaml`, add a feature with one Genie Code prompt, and submit a response that lands in your Lakebase
tables and, seconds later, in Delta.

## Stage 1: Point the app at your data (5 min)

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

## Stage 2: Add "Your answers at a glance" with Genie Code (6 min)

Open `code/app/src/components/survey-flow.tsx` in your Git folder, then the **Genie Code** panel (right edge) → **New chat**:

**Prompt** (Genie Code, file editor):
> Edit only this file (survey-flow.tsx, a Next.js client component with shadcn/ui and Tailwind). Add a "Your answers at a glance" card just above the row with the "Submit my answers" button, shown once at least one statement is answered. List every Likert statement (likertQs) in order: its number, its theme, and the chosen score from the likert state as a small Badge with the label from LIKERT_LABELS (import it from the same survey-types module as formatCampaign), coloured by score (1-2 red, 3 amber, 4-5 green), or an outline "Not answered" badge. Clicking a row scrolls to that statement (element id q-<question_id>). In the card title show the average of the answered scores with one decimal, e.g. "Average 3.8 / 5". Use the existing Card, CardHeader, CardTitle, CardDescription, CardContent and Badge components; add data-testid="answer-summary" to the card. Don't change anything else.

**Expected:** Genie Code reads the file (and the badge/card components) for ~2–3 minutes, then proposes one edit, shown as a diff: `LIKERT_LABELS` added to the existing import, a few helper lines, and a new `<Card data-testid="answer-summary">` block before the Submit row (+67 −2 in the rehearsal). **Accept all**. Then **Deploy** again (≈ 1 min).
**Checkpoint:** open the survey as Joost, answer a few statements: the card appears above **Submit my answers**, one row per statement with its theme (Energy & carbon, Indoor comfort, Waste & recycling, Water, Sustainable transport, Wellbeing, Communication, Overall satisfaction), red/amber/green badges, and the average (e.g. scores 2, 4, 5, 3, 4, 1, 5, 4 → **Average 3.5 / 5**).
**Watch for:** typing `@` in the Genie Code box opens the object picker (that's why the prompt doesn't say `@/lib/...`). If the deployment fails, the app's **Deployments** tab shows the `npm run build` error: paste it into the same Genie Code chat ("The build fails with: … fix it").
**If stuck:** copy `code/prompts/solutions/m01b-survey-flow.tsx` over `code/app/src/components/survey-flow.tsx` (same folder in your Git folder) and Deploy.

## Stage 3: Submit, and see it in Lakebase and Delta (4 min)

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

## Facilitator demo: the reference app (any time)

`<reference app url>/?campaign=2026-Q4`, `joost.devries@amstel1.example` → 8 statements + 3 open questions → Submit → thank-you. `michal.kaminski@warsaw45.example` → "You've already completed this survey". `?campaign=2026-Q3` → "This survey is closed". Reset after a live submit on the reference: `DELETE FROM survey.survey_responses WHERE contact_email = '<email>' AND submitted_at > now() - interval '1 day';` (answers cascade), so the dashboard keeps 2026-Q4 at **31** of **60**.

## Wrap-up
- **So what:** the same app runs on anyone's data by changing two settings, and a useful feature is one prompt away; the answers land in a transactional database and in the lakehouse seconds later, with no ETL.
- **Snowflake equivalent:** Streamlit in Snowflake + Hybrid Tables. Here: any web framework (this one is Next.js), full Postgres, managed sync to Delta.
