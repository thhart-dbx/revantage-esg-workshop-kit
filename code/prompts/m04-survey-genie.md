# Module 4: Survey Genie space — "Ask the survey, read the comments, connect the two"

**Session:** 10:20–10:40 (20 min) · **You build:** Genie space "ESG Survey Genie – <your_name>" · **Reference:** "Revantage ESG Survey Genie (Reference)" (folder `spaces`)
**Starting state:** in `<catalog>.<schema>`: `ref_survey_answer_facts` (2,127 answers: Likert 1–5 + free text, with theme, property, campaign), `ref_survey_comment_insights` (399 comments with AI `sentiment` from `ai_analyze_sentiment` and `topic` from `ai_classify`), `ref_survey_request_status` (300 requests), metric views `ref_mv_survey_scores`, `ref_mv_survey_completion`
**Where:** Genie → **New** (Genie space); the space's **Instructions** and **SQL queries** tabs

## Stage 1: Create the space (3 min)

Genie → **New** → add tables `ref_survey_answer_facts`, `ref_survey_comment_insights`, `ref_survey_request_status` from `<catalog>.<schema>` → title "ESG Survey Genie – <your_name>", warehouse = the workshop warehouse. Leave instructions empty for now.
**Checkpoint:** the space opens with 3 tables in **Data**.

## Stage 2: Analyse the scores (4 min)

**Prompt** (in your space):
> What is the average score by theme for the 2026-Q4 campaign?

**Expected:** 8 themes, 31 responses each; highest **Communication 3.94**, lowest **Indoor comfort 3.35** (Energy & carbon 3.58).

**Prompt:**
> Which property has the lowest Energy & carbon score?

**Expected:** **Castellana Tower, 1.85** (27 answers over 5 quarters; portfolio 3.45).
**Checkpoint:** click **Show code**: an `AVG(likert_value)` over `ref_survey_answer_facts` with `theme = 'Energy & carbon'` grouped by property.

## Stage 3: Summarise the free text (4 min)

**Prompt:**
> Summarise what tenants at Castellana Tower are saying in their comments

**Expected:** Genie reads `ref_survey_comment_insights`: 47 comments, dominated by **HVAC & temperature** and negative sentiment (pre-build run: 38 negative HVAC comments), with example quotes such as *"Air conditioning broke down twice in October, we had to send staff home one afternoon."* AI labels vary by a few between runs.
Talk track: `sentiment` and `topic` were computed once with `ai_analyze_sentiment` / `ai_classify` in SQL (`code/sql/survey_comment_insights.sql`); Genie can also call `ai_summarize` itself (Stage 4).

## Stage 4: Combine the two (7 min)

**Prompt:**
> Why is Energy & carbon low at Castellana Tower, and what are tenants saying?

**Expected without instructions (seen in pre-build):** the score (1.85 vs portfolio 3.45) but **no comments**: Genie either ignores the comments table or filters it on `question_theme = 'Energy & carbon'`, which never matches (comments answer the free-text questions *Improvement / Recent changes / Collaboration*). That's the teaching moment.

Open **Instructions** → add this text instruction:
> When asked WHY a score is low or high at a property, combine both sources: (1) the average likert_value by theme for that property vs the portfolio average from ref_survey_answer_facts (question_type = 'likert'), and (2) what tenants say at that property: ref_survey_comment_insights filtered on property_name only (comments are answers to the free-text questions, so their question_theme is never a Likert theme; use the topic column to spot the cause), count comments by topic and sentiment and summarise them with ai_summarize(array_join(collect_list(comment), '\n'), 60). Quote 2 representative comments.

Ask the same question again in a **new chat**.
**Expected:** score **1.85 vs 3.45** *and* the tenant voice: **31 negative HVAC & temperature comments** (plus ~5 mixed), an `ai_summarize` line like *"Staff complain about poor ventilation and temperature, with HVAC issues causing discomfort and increased energy bills, prompting reconsideration of the lease."* and two quotes.
**Checkpoint:** **Show code** contains `ai_summarize(` and `ref_survey_comment_insights` with a `property_name` filter only.
**If stuck:** ask the reference space the same question; it also has the two metric views, a combined example SQL and 8 sample questions.

## Stage 5: Try more (2 min, optional)
> How has the Energy & carbon score at Amstel Logistics Park changed since the solar project?

**Expected:** 2.60 (2025-Q4) → 3.00 → 3.80 → 3.83 → **4.50** (2026-Q4); favourable share 0 % → 100 %.
> Which property has the lowest survey completion rate this quarter?

**Expected:** **Vltava Business Centre, 16.7 %** (1 of 6) in 2026-Q4.
> Who has not completed the 2026-Q4 survey yet?

**Expected:** **29** contacts (e.g. Joost de Vries and Femke Bakker at Amstel Logistics Park; 5 at Vltava Business Centre).

## Wrap-up
- **So what:** the ESG team asks in plain language and gets both the number and the reason, straight from what tenants wrote, without reading 400 comments.
- **Snowflake equivalent:** Cortex Analyst for the SQL + Cortex functions (SENTIMENT, SUMMARIZE) in separate steps; here one Genie space combines governed tables, metric views and AI functions in a single answer.
