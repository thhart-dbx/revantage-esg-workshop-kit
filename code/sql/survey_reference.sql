-- UJ1 reference layer over the Lakehouse Sync history tables (lb_survey_*_history) + Delta starting state.
-- ${catalog}.${schema} substituted by code/sql/run_sql.py (job `survey_reference`). Runs on the SQL warehouse.

-- Current state of the Lakebase tables (latest change per key, deletes removed). Same columns as Postgres.
CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_survey_responses
COMMENT 'Survey responses (one per contact per campaign) written by the survey app to Lakebase survey.survey_responses, synced to Delta by Lakehouse Sync. Current state of lb_survey_responses_history.'
AS SELECT
  lower(regexp_replace(hex(response_id), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5')) AS response_id,
  campaign_id, contact_id, contact_email, property_id, submitted_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY response_id ORDER BY _pg_lsn DESC, _sort_by DESC) AS rn
  FROM ${catalog}.${schema}.lb_survey_responses_history
  WHERE _pg_change_type IN ('insert', 'update_postimage', 'delete'))
WHERE rn = 1 AND _pg_change_type <> 'delete';

CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_survey_answers
COMMENT 'Survey answers (one per response per question): likert_value 1-5 for Likert questions, text_value for free-text questions. From Lakebase survey.survey_answers via Lakehouse Sync (current state of lb_survey_answers_history).'
AS SELECT
  lower(regexp_replace(hex(response_id), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5')) AS response_id,
  question_id, CAST(likert_value AS INT) AS likert_value, text_value
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY response_id, question_id ORDER BY _pg_lsn DESC, _sort_by DESC) AS rn
  FROM ${catalog}.${schema}.lb_survey_answers_history
  WHERE _pg_change_type IN ('insert', 'update_postimage', 'delete'))
WHERE rn = 1 AND _pg_change_type <> 'delete';

-- One row per survey request: who was asked, and whether / when they completed.
CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_survey_request_status
COMMENT 'One row per survey request (contact x campaign) with completion status. completed = the contact submitted a response for that campaign. Use for requests sent, completed, completion rate and the completed / not completed contact lists.'
AS WITH first_response AS (
  SELECT campaign_id, contact_id, response_id, submitted_at
  FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY campaign_id, contact_id ORDER BY submitted_at) AS rn
        FROM ${catalog}.${schema}.ref_survey_responses)
  WHERE rn = 1)
SELECT q.request_id, q.campaign_id, c.campaign_name, c.status AS campaign_status, c.quarter_start, q.sent_at,
       q.contact_id, k.contact_name, k.contact_email, k.job_title, t.tenant_id, t.tenant_name, t.sector,
       p.property_id, p.property_name, p.city, p.country, p.property_type,
       r.response_id IS NOT NULL AS completed, r.response_id, r.submitted_at,
       ROUND((unix_timestamp(r.submitted_at) - unix_timestamp(q.sent_at)) / 86400.0, 1) AS days_to_complete
FROM ${catalog}.${schema}.survey_requests q
JOIN ${catalog}.${schema}.survey_campaigns c ON c.campaign_id = q.campaign_id
JOIN ${catalog}.${schema}.survey_contacts k ON k.contact_id = q.contact_id
JOIN ${catalog}.${schema}.tenants t ON t.tenant_id = k.tenant_id
JOIN ${catalog}.${schema}.properties p ON p.property_id = k.property_id
LEFT JOIN first_response r ON r.campaign_id = q.campaign_id AND r.contact_id = q.contact_id;

-- One row per answer with every dimension the dashboard and Genie slice by.
CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_survey_answer_facts
COMMENT 'One row per survey answer joined to question (theme, type), campaign (quarter), contact, tenant and property. likert_value 1 = strongly disagree ... 5 = strongly agree; text_value holds free-text answers.'
AS SELECT a.response_id, r.campaign_id, c.quarter_start, r.submitted_at,
       r.contact_id, k.contact_name, t.tenant_name, t.sector,
       p.property_id, p.property_name, p.city, p.country, p.property_type,
       q.question_id, q.question_order, q.question_type, q.theme, q.question_text,
       a.likert_value, a.text_value
FROM ${catalog}.${schema}.ref_survey_answers a
JOIN ${catalog}.${schema}.ref_survey_responses r ON r.response_id = a.response_id
JOIN ${catalog}.${schema}.survey_questions q ON q.question_id = a.question_id
JOIN ${catalog}.${schema}.survey_campaigns c ON c.campaign_id = r.campaign_id
JOIN ${catalog}.${schema}.survey_contacts k ON k.contact_id = r.contact_id
JOIN ${catalog}.${schema}.tenants t ON t.tenant_id = k.tenant_id
JOIN ${catalog}.${schema}.properties p ON p.property_id = r.property_id;

-- Free-text answers only (for Genie and the dashboard comments table).
CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_survey_comments
COMMENT 'Free-text survey answers (questions 9-11: Improvement, Recent changes, Collaboration) with property, tenant, contact and campaign. Summarise with ai_summarize / ai_analyze_sentiment / ai_classify.'
AS SELECT response_id, campaign_id, quarter_start, submitted_at, contact_name, tenant_name, property_id, property_name,
       city, question_id, theme AS question_theme, question_text, text_value AS comment
FROM ${catalog}.${schema}.ref_survey_answer_facts
WHERE question_type = 'text' AND text_value IS NOT NULL AND trim(text_value) <> '';

-- Business metrics shared by the dashboard, Genie and the app.
CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_mv_survey_completion
WITH METRICS LANGUAGE YAML
COMMENT 'Survey completion KPIs: requests sent, completed, not completed, completion rate. Grain: survey request.'
AS $$
version: 1.1
source: ${catalog}.${schema}.ref_survey_request_status
dimensions:
  - name: campaign_id
    expr: campaign_id
    comment: "Quarterly campaign, e.g. 2026-Q4"
  - name: campaign_status
    expr: campaign_status
    comment: "open (current quarter) or closed"
  - name: quarter_start
    expr: quarter_start
  - name: property_name
    expr: property_name
  - name: city
    expr: city
  - name: country
    expr: country
  - name: property_type
    expr: property_type
  - name: tenant_name
    expr: tenant_name
measures:
  - name: requests_sent
    expr: COUNT(1)
    comment: "Number of survey requests sent (contacts x campaigns)"
  - name: completed
    expr: COUNT_IF(completed)
    comment: "Requests with a submitted response"
  - name: not_completed
    expr: COUNT_IF(NOT completed)
    comment: "Requests without a response yet"
  - name: completion_rate
    expr: COUNT_IF(completed) / COUNT(1)
    comment: "completed / requests_sent (fraction 0-1)"
  - name: avg_days_to_complete
    expr: AVG(days_to_complete)
    comment: "Average days between the request email and the response"
$$;

CREATE OR REPLACE VIEW ${catalog}.${schema}.ref_mv_survey_scores
WITH METRICS LANGUAGE YAML
COMMENT 'Survey score KPIs over Likert answers (1 = strongly disagree ... 5 = strongly agree): average score, favourable share (4-5), unfavourable share (1-2), net score. Grain: Likert answer.'
AS $$
version: 1.1
source: ${catalog}.${schema}.ref_survey_answer_facts
filter: question_type = 'likert'
dimensions:
  - name: campaign_id
    expr: campaign_id
    comment: "Quarterly campaign, e.g. 2026-Q4"
  - name: quarter_start
    expr: quarter_start
  - name: theme
    expr: theme
    comment: "ESG theme of the statement (Energy & carbon, Indoor comfort, ...)"
  - name: question_text
    expr: question_text
  - name: property_name
    expr: property_name
  - name: city
    expr: city
  - name: country
    expr: country
  - name: property_type
    expr: property_type
  - name: tenant_name
    expr: tenant_name
  - name: sector
    expr: sector
measures:
  - name: avg_score
    expr: AVG(likert_value)
    comment: "Average agreement score 1-5"
  - name: favourable_share
    expr: AVG(CASE WHEN likert_value >= 4 THEN 1.0 ELSE 0.0 END)
    comment: "Share of answers 4 or 5 (agree / strongly agree)"
  - name: unfavourable_share
    expr: AVG(CASE WHEN likert_value <= 2 THEN 1.0 ELSE 0.0 END)
    comment: "Share of answers 1 or 2 (disagree / strongly disagree)"
  - name: net_score
    expr: AVG(CASE WHEN likert_value >= 4 THEN 1.0 WHEN likert_value <= 2 THEN -1.0 ELSE 0.0 END)
    comment: "favourable_share - unfavourable_share (-1 to +1)"
  - name: responses
    expr: COUNT(DISTINCT response_id)
    comment: "Number of survey responses"
  - name: answers
    expr: COUNT(1)
    comment: "Number of Likert answers"
$$;
