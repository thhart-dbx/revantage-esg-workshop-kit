-- Module 6, Stage 1: turn your Module 5 table into the QA app's work queue.
-- Open this file from your Git folder (it opens in the SQL file editor on a warehouse), change the USE line below
-- to your names, then click Run (it runs every statement in the file).
-- Reads <my_schema>.invoices_extracted (Module 5) + utility_meters + emission_factors; writes two tables:
--   invoices_qa          one row per invoice with the columns the QA app reads and updates (property matched via
--                        meter_id, kWh, validation flags, qa_status = Pending). Re-running it resets your reviews.
--   invoice_corrections  the QA app's corrections log (created empty if missing; never dropped).
-- Why a new table: Module 5's incremental INSERT has no column list, so adding columns to invoices_extracted
-- would break your file-arrival job.

USE <catalog>.<my_schema>; -- EDIT THIS LINE, e.g. USE my_catalog.revantage_20261105_jane_doe;

CREATE OR REPLACE TABLE invoices_qa
COMMENT 'Module 6: QA work queue built from invoices_extracted (Module 5); the QA app updates it.'
TBLPROPERTIES ('delta.enableDeletionVectors' = 'true', 'delta.enableRowTracking' = 'true')
AS
WITH e AS (
  SELECT *, try_parse_json(extraction_json) AS j FROM invoices_extracted
),
n AS (
  SELECT
    invoice_id, file_path, try_cast(received_date AS DATE) AS received_date,
    nullif(trim(supplier_name), '') AS supplier_name, nullif(trim(invoice_number), '') AS invoice_number,
    try_cast(invoice_date AS DATE) AS invoice_date,
    try_cast(billing_period_start AS DATE) AS billing_period_start,
    try_cast(billing_period_end AS DATE) AS billing_period_end,
    nullif(trim(try_variant_get(j, '$.response.site_address', 'string')), '') AS site_address,
    nullif(trim(meter_id), '') AS meter_id,
    lower(utility_type) AS utility_type,
    try_cast(consumption AS DOUBLE) AS consumption,
    CASE
      WHEN lower(regexp_replace(consumption_unit, '[\\s.]', '')) = 'kwh' THEN 'kWh'
      WHEN lower(regexp_replace(consumption_unit, '[\\s.]', '')) = 'mwh' THEN 'MWh'
      WHEN lower(regexp_replace(consumption_unit, '[\\s.]', '')) = 'gj' THEN 'GJ'
      WHEN lower(regexp_replace(consumption_unit, '[\\s.]', '')) IN ('m3', 'm³', 'smc', 'sm3', 'sm³', 'cbm') THEN 'm3'
      ELSE consumption_unit
    END AS consumption_unit,
    try_cast(amount_net AS DECIMAL(14,2)) AS amount_net,
    try_cast(vat_amount AS DECIMAL(14,2)) AS vat_amount,
    try_cast(amount_total AS DECIMAL(14,2)) AS amount_total,
    CASE
      WHEN upper(trim(currency)) IN ('€', 'EURO', 'EUR') THEN 'EUR'
      WHEN upper(trim(currency)) IN ('KČ', 'KC', 'CZK') THEN 'CZK'
      WHEN upper(trim(currency)) IN ('KR', 'SEK') THEN 'SEK'
      WHEN upper(trim(currency)) IN ('ZŁ', 'ZL', 'PLN') THEN 'PLN'
      ELSE upper(trim(currency))
    END AS currency,
    lower(document_type) AS document_type,
    try_cast(invoices_in_document AS INT) AS invoices_in_document,
    lower(try_variant_get(j, '$.response.reading_type', 'string')) AS reading_type,
    try_cast(extracted_at AS TIMESTAMP) AS extracted_at,
    regexp_replace(upper(trim(split(meter_id, ';')[0])), '[^A-Z0-9]', '') AS meter_key
  FROM e
),
k AS (
  SELECT n.*, m.property_id, m.country,
    ROUND(CASE n.consumption_unit
      WHEN 'kWh' THEN n.consumption
      WHEN 'MWh' THEN n.consumption * 1000
      WHEN 'GJ' THEN n.consumption * 1000 / 3.6
      WHEN 'm3' THEN CASE WHEN n.utility_type = 'gas' THEN n.consumption * 10.55 END
    END, 1) AS consumption_kwh
  FROM n
  LEFT JOIN (SELECT regexp_replace(upper(meter_id), '[^A-Z0-9]', '') AS meter_key, property_id, country FROM utility_meters) m
    ON n.meter_key = m.meter_key
)
SELECT
  k.invoice_id, k.file_path, k.received_date, k.supplier_name, k.invoice_number, k.invoice_date,
  k.billing_period_start, k.billing_period_end, k.property_id, k.site_address, k.meter_id, k.utility_type,
  k.consumption, k.consumption_unit, k.consumption_kwh, k.amount_net, k.vat_amount, k.amount_total, k.currency,
  k.document_type, k.invoices_in_document, k.reading_type,
  ROUND(CASE WHEN k.utility_type = 'water' THEN k.consumption ELSE k.consumption_kwh END * ef.kgco2e_per_unit, 1) AS emissions_kgco2e,
  -- the extraction-side checks the app shows as "Extraction check: …" (the app adds total / property / consumption rules itself)
  nullif(concat_ws(',',
    CASE WHEN k.document_type IN ('reminder', 'other') THEN 'not_an_invoice' END,
    CASE WHEN k.document_type = 'credit_note' OR k.amount_total < 0 THEN 'credit_note' END,
    CASE WHEN k.invoices_in_document > 1 THEN 'multiple_invoices' END,
    CASE WHEN k.meter_id LIKE '%;%' THEN 'multiple_meters' END,
    CASE WHEN k.consumption_kwh IS NULL AND k.utility_type <> 'water' THEN 'unit_unknown' END,
    CASE WHEN k.reading_type = 'estimated' THEN 'estimated_reading' END
  ), '') AS validation_flags,
  k.extracted_at,
  'Pending' AS qa_status,
  CAST(NULL AS STRING) AS reviewed_by,
  CAST(NULL AS TIMESTAMP) AS reviewed_at
FROM k
LEFT JOIN emission_factors ef ON ef.country = k.country AND ef.utility_type = k.utility_type;

CREATE TABLE IF NOT EXISTS invoice_corrections (
  correction_id STRING, invoice_id STRING, field_name STRING, extracted_value STRING, corrected_value STRING,
  error_type STRING, comment STRING, corrected_by STRING, corrected_at TIMESTAMP, received_date DATE)
COMMENT 'Module 6: one row per field a QA reviewer corrected (written by your QA app).';

-- Checkpoint: 34 rows, all Pending; how many have no property match / an extraction flag.
SELECT count(*) AS invoices, count_if(qa_status = 'Pending') AS pending,
       count_if(property_id IS NULL) AS unmatched_property, count_if(validation_flags IS NOT NULL) AS extraction_flags
FROM invoices_qa;
