# Module 3: Survey dashboard — "Who answered, and what did they say?"

**Session:** 10:00–10:20 (20 min) · **You build:** AI/BI dashboard "ESG Survey – <your_name>" · **Reference:** "Revantage ESG Survey (Reference)" (folder `dashboards`; pages Survey completion, Results analysis, Tenant comments)
**Starting state:** in `<catalog>.<schema>`: `ref_survey_request_status` (300 requests = 60 contacts × 5 campaigns, `completed` true/false), `ref_survey_answer_facts` (one row per answer, with theme, property, campaign), `ref_survey_comment_insights` (399 comments with AI `sentiment` + `topic`), metric views `ref_mv_survey_completion` and `ref_mv_survey_scores`. All built on the Lakebase answers synced to Delta (Module 1a).
**Where:** Dashboards → **Create dashboard**; Genie Code panel in the dashboard editor

## Stage 1: Data + completion KPIs (5 min)

**Create dashboard** → rename "ESG Survey – <your_name>". **Data** → **Add data source** → `<catalog>.<schema>.ref_survey_request_status`, `ref_survey_answer_facts`, `ref_survey_comment_insights`.

**Prompt** (Genie Code, dashboard editor):
> Using ref_survey_request_status, add a page "Survey completion" with four counters: Requests sent (count of request_id), Completed (requests where completed is true), Not completed, and Completion rate (completed / requests, as a percentage with one decimal). Add a global single-select filter on campaign_id defaulting to 2026-Q4 and a multi-select filter on property_name. Run the datasets and check the numbers.

**Expected (2026-Q4):** **60 · 31 · 29 · 51.7 %**. Clear the campaign filter → 300 · 216 · 84 · 72.0 %.
**Watch for:** a completion-rate counter built as the *average of per-property rates* gives a different number once properties have unequal counts; it must be completed ÷ requests (a ratio of sums), which is how `ref_mv_survey_completion.completion_rate` defines it.
**Checkpoint:** `SELECT MEASURE(requests_sent), MEASURE(completed), MEASURE(completion_rate) FROM <catalog>.<schema>.ref_mv_survey_completion WHERE campaign_id = '2026-Q4'` → 60, 31, 0.5167.
**If stuck:** open the reference dashboard → Data tab → copy `ds_requests` (its measures are the `columns` at the bottom).

## Stage 2: Completed / not completed list (4 min)

**Prompt:**
> On the same page add a bar chart of completion rate by property_name (sorted ascending) and a table of contacts with status ('Completed' or 'Not completed' from completed), contact_name, contact_email, tenant_name, property_name, sent_at and submitted_at, not completed first.

**Expected (2026-Q4):** lowest bar **Vltava Business Centre 16.7 %** (1 of 6), then Grand Rue Retail Quarter and Vistula Logistics Centre 33.3 %; highest Docklands Studios 83.3 %. The table has 60 rows, the first 29 "Not completed" (e.g. Joost de Vries, Femke Bakker at Amstel Logistics Park).
**Checkpoint:** set Property = Vltava Business Centre → 6 rows, 5 not completed. Across all campaigns Vltava is the outlier: **26.7 %** vs 63–90 % elsewhere.

## Stage 3: Results analysis (6 min)

**Prompt:**
> Add a page "Results analysis" from ref_survey_answer_facts where question_type = 'likert' (likert_value 1 = strongly disagree to 5 = strongly agree): counters for average score (2 decimals), favourable share (likert_value 4 or 5, percent) and number of responses (distinct response_id); a bar chart of average score by theme and one by property_name; and a heatmap of average score with theme on x and property_name on y. Bind the campaign and property filters to this dataset too.

**Expected (2026-Q4):** **3.73 · 66.5 % · 31 responses**; lowest theme Indoor comfort 3.35. Clear the campaign filter (all quarters): **3.64 · 61.1 % · 216**; lowest property **Castellana Tower 2.85**, highest Docklands Studios 4.23. In the heatmap, Castellana Tower × Energy & carbon **1.85** and × Indoor comfort **1.63** are the two darkest cells (portfolio 3.45 / 3.44).
**Watch for:** if the filters don't change the new page, Genie Code bound them only to the first dataset; ask "make the campaign and property filters apply to the results dataset as well".

## Stage 4: Trend (3 min)

**Prompt:**
> Add a line chart of average score by campaign_id (x) and theme (color) from a second dataset over the same Likert answers that is NOT bound to the campaign filter, so it always shows all five quarters. Keep the property filter on it.

**Expected:** set Property = **Amstel Logistics Park**: Energy & carbon climbs **2.60 → 3.00 → 3.80 → 3.83 → 4.50** (2025-Q4 → 2026-Q4) after the LED retrofit + rooftop solar went live in March 2026. Castellana Tower stays at the bottom on Energy & carbon (1.5–2.2) in every quarter.
**If stuck:** copy `ds_scores_trend` and the "Score trend by theme and quarter" widget from the reference.

## Stage 5: Comments (2 min)

**Prompt:**
> Add a page "Tenant comments" from ref_survey_comment_insights: a bar chart of comment count by topic colored by sentiment, and a table of campaign_id, property_name, tenant_name, sentiment, topic and comment.

**Expected:** 399 comments overall; filter Property = Castellana Tower → 47 comments, most of them topic **HVAC & temperature** and negative (pre-build run: 39 HVAC, 31 negative; AI labels can vary by a few). Then **Publish**.

## Wrap-up
- **So what:** the survey owner sees response progress (who to chase) and the results (which buildings and themes need action) in one governed dashboard, refreshed seconds after a tenant submits.
- **Snowflake equivalent:** Snowsight dashboards / a BI tool on top; here the dashboard, the metric definitions and the AI enrichment all live in Unity Catalog.
