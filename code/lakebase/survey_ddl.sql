-- UJ1 survey write model in Lakebase (Postgres). Idempotent.
-- ${pg_schema} = Postgres schema (reference: survey; participants: survey_<name>).
-- REPLICA IDENTITY FULL is required by Lakehouse Sync (Postgres -> Delta CDF).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS ${pg_schema};

CREATE TABLE IF NOT EXISTS ${pg_schema}.survey_responses (
  response_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   TEXT NOT NULL,
  contact_id    INT  NOT NULL,
  contact_email TEXT NOT NULL,
  property_id   INT  NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${pg_schema}.survey_answers (
  response_id  UUID NOT NULL REFERENCES ${pg_schema}.survey_responses(response_id) ON DELETE CASCADE,
  question_id  INT  NOT NULL,
  likert_value SMALLINT NULL CHECK (likert_value BETWEEN 1 AND 5),
  text_value   TEXT NULL,
  PRIMARY KEY (response_id, question_id)
);

CREATE INDEX IF NOT EXISTS survey_responses_campaign_idx ON ${pg_schema}.survey_responses (campaign_id, contact_id);

ALTER TABLE ${pg_schema}.survey_responses REPLICA IDENTITY FULL;
ALTER TABLE ${pg_schema}.survey_answers REPLICA IDENTITY FULL;
