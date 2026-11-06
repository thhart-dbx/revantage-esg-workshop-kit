-- UJ1 reference: AI enrichment of the free-text answers (sentiment + topic), precomputed on the SQL warehouse
-- so the dashboard and Genie don't re-run AI functions per query. Rebuild after new submissions (job survey_reference).
CREATE OR REPLACE TABLE ${catalog}.${schema}.ref_survey_comment_insights
COMMENT 'Free-text survey answers enriched with ai_analyze_sentiment (positive/negative/neutral/mixed) and ai_classify topic. One row per comment; rebuilt by the survey_reference job.'
AS SELECT c.*,
  ai_analyze_sentiment(comment) AS sentiment,
  ai_classify(comment, ARRAY('HVAC & temperature', 'Energy & lighting', 'Solar & renewables', 'Waste & recycling', 'Water',
                             'Transport & EV charging', 'Wellbeing & amenities', 'Communication', 'Green lease & collaboration',
                             'General praise')) AS topic
FROM ${catalog}.${schema}.ref_survey_comments c;
