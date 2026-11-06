-- M5 reference: extract new utility invoices with ai_parse_document + ai_extract (v2), then normalise.
-- Runs as a SQL file task on the SQL warehouse (job "[Revantage ESG] Extract utility invoices (Reference)",
-- file-arrival trigger on /Volumes/<catalog>/<schema>/utility_invoices/incoming/).
-- Parameters: :catalog, :schema. Incremental: only files whose path is not yet in the table are parsed.
-- Rows are inserted once and never re-extracted, so QA edits (QA app) are not overwritten.

USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:schema);

CREATE TABLE IF NOT EXISTS ref_invoices_extracted (
  invoice_id STRING NOT NULL COMMENT 'File name without extension (stable key)',
  file_path STRING COMMENT 'Full /Volumes path of the invoice file',
  received_date DATE COMMENT 'Date the invoice was received = the incoming/<YYYY-MM-DD>/ drop folder',
  supplier_name STRING,
  invoice_number STRING COMMENT 'NULL when the document has no invoice number',
  invoice_date DATE,
  billing_period_start DATE,
  billing_period_end DATE,
  property_id INT COMMENT 'Matched via meter_id -> utility_meters; NULL = unmatched',
  site_address STRING,
  meter_id STRING COMMENT 'Meter / supply point id as printed; several meters separated by "; "',
  utility_type STRING COMMENT 'electricity | gas | water | district_heating',
  consumption DOUBLE COMMENT 'Billed consumption in consumption_unit',
  consumption_unit STRING COMMENT 'Normalised unit: kWh | MWh | GJ | m3',
  consumption_kwh DOUBLE COMMENT 'Energy in kWh (MWh x1000, GJ x277.78, gas m3 = stated kWh or x10.55); NULL for water',
  amount_net DECIMAL(14,2),
  vat_amount DECIMAL(14,2),
  amount_total DECIMAL(14,2) COMMENT 'Invoice total incl. VAT for this period (excludes arrears)',
  currency STRING COMMENT 'ISO 4217',
  extraction_json STRING COMMENT 'Raw ai_extract v2 output (error_message, metadata, response)',
  extracted_at TIMESTAMP,
  qa_status STRING COMMENT 'Pending | Approved | Corrected | Rejected',
  reviewed_by STRING,
  reviewed_at TIMESTAMP,
  document_type STRING COMMENT 'invoice | credit_note | reminder | other',
  invoices_in_document INT COMMENT 'Number of separate invoices ai_extract saw in the file',
  reading_type STRING COMMENT 'actual | estimated',
  emissions_kgco2e DOUBLE COMMENT 'consumption x emission_factors (illustrative)',
  validation_flags STRING COMMENT 'Comma-separated rule hits for QA; NULL = clean',
  extraction_error STRING COMMENT 'ai_extract error_message, if any',
  normalized_at TIMESTAMP
)
COMMENT 'UJ2 reference: one row per utility invoice file, extracted by ai_extract on file arrival, edited by the QA app.'
-- row-level concurrency: the QA app, the extraction job and participants update different rows at the same time
TBLPROPERTIES ('delta.enableDeletionVectors' = 'true', 'delta.enableRowTracking' = 'true');

-- 1. Parse + extract only the new files.
INSERT INTO ref_invoices_extracted (invoice_id, file_path, received_date, extraction_json, extracted_at, qa_status)
WITH files AS (
  SELECT regexp_replace(path, '^dbfs:', '') AS file_path, content, modificationTime
  FROM read_files('/Volumes/' || :catalog || '/' || :schema || '/utility_invoices/incoming/',
                  format => 'binaryFile', recursiveFileLookup => 'true')
  WHERE lower(path) RLIKE '\\.(pdf|jpg|jpeg|png)$'
),
new_files AS (
  SELECT * FROM files f
  WHERE NOT EXISTS (SELECT 1 FROM ref_invoices_extracted t
                    WHERE t.file_path = f.file_path
                       OR t.invoice_id = regexp_extract(f.file_path, '([^/]+)\\.[A-Za-z0-9]+$', 1))  -- same file name again = duplicate, skipped
)
SELECT
  regexp_extract(file_path, '([^/]+)\\.[A-Za-z0-9]+$', 1) AS invoice_id,
  file_path,
  coalesce(try_to_date(regexp_extract(file_path, '/incoming/([0-9]{4}-[0-9]{2}-[0-9]{2})/', 1)),
           to_date(modificationTime)) AS received_date,
  CAST(ai_extract(
    ai_parse_document(content, map('version', '2.0')),
    '{
      "document_type": {"type": "string", "enum": ["invoice", "credit_note", "reminder", "other"],
        "description": "invoice = a bill for a period; credit_note = a credit or refund (Gutschrift, avoir, creditnota, nota di credito, kreditfaktura); reminder = a payment reminder or dunning letter about an earlier invoice (Zahlungserinnerung, Mahnung, betalingsherinnering, rappel); other = anything else"},
      "invoices_in_document": {"type": "integer", "description": "How many separate invoices (each with its own invoice number and total) the document contains"},
      "supplier_name": {"type": "string", "description": "Legal name of the utility company that issued the document"},
      "invoice_number": {"type": "string", "description": "Invoice number exactly as printed. Not the customer number, contract number or payment reference. null if there is no invoice number"},
      "invoice_date": {"type": "string", "description": "Issue date of the invoice, YYYY-MM-DD"},
      "billing_period_start": {"type": "string", "description": "First day of the billing / consumption period, YYYY-MM-DD"},
      "billing_period_end": {"type": "string", "description": "Last day of the billing / consumption period, YYYY-MM-DD"},
      "site_address": {"type": "string", "description": "Supply address where the utility is delivered (not the billing address)"},
      "meter_id": {"type": "string", "description": "Meter or supply point identifier (EAN, PDL, PCE, POD, PDR, CUPS, MPRN, GPRN, PPE, Zaehlernummer, meter number). If there are several, separate them with ; "},
      "utility_type": {"type": "string", "enum": ["electricity", "gas", "water", "district_heating"]},
      "consumption": {"type": "number", "description": "Total billed consumption for the period, summed over all meters, in the billing unit. Negative on a credit note"},
      "consumption_unit": {"type": "string", "description": "Unit of the consumption as printed, e.g. kWh, MWh, GJ, m3, Smc"},
      "energy_kwh_stated": {"type": "number", "description": "Only for gas measured in m3 or Smc: the energy in kWh stated on the invoice after conversion; otherwise null"},
      "reading_type": {"type": "string", "enum": ["actual", "estimated"], "description": "Whether the meter reading was actually read or estimated"},
      "amount_net": {"type": "number", "description": "Total of this invoice before VAT"},
      "vat_amount": {"type": "number", "description": "VAT amount of this invoice"},
      "amount_total": {"type": "number", "description": "Total of this invoice including VAT for this billing period only; exclude previous unpaid balances"},
      "currency": {"type": "string", "description": "ISO 4217 currency code of the amounts, e.g. EUR, CZK, SEK, PLN"}
    }',
    options => map('version', '2.0',
      'instructions', 'European utility invoices in local languages. Numbers may use a decimal comma and dot or space thousands separators: return plain JSON numbers. Return dates as YYYY-MM-DD. Use null when a value is not on the document; do not guess.')
  ) AS STRING) AS extraction_json,
  current_timestamp() AS extracted_at,
  'Pending' AS qa_status
FROM new_files;

-- 2. "What the AI said", normalised. Always computed from extraction_json, so it is the unedited AI output
--    (scoring and the QA history use this view; QA edits live in the table).
CREATE OR REPLACE VIEW ref_invoices_ai_output_v
COMMENT 'Normalised ai_extract output per invoice (before QA edits). Source: ref_invoices_extracted.extraction_json.'
AS
WITH r AS (
  SELECT invoice_id, received_date, parse_json(extraction_json) AS j FROM ref_invoices_extracted
),
f AS (
  SELECT
    invoice_id, received_date,
    try_variant_get(j, '$.error_message', 'string') AS extraction_error,
    try_variant_get(j, '$.response.document_type', 'string') AS document_type,
    try_variant_get(j, '$.response.invoices_in_document', 'int') AS invoices_in_document,
    nullif(trim(try_variant_get(j, '$.response.supplier_name', 'string')), '') AS supplier_name,
    nullif(trim(try_variant_get(j, '$.response.invoice_number', 'string')), '') AS invoice_number,
    try_variant_get(j, '$.response.invoice_date', 'string') AS invoice_date_s,
    try_variant_get(j, '$.response.billing_period_start', 'string') AS ps_s,
    try_variant_get(j, '$.response.billing_period_end', 'string') AS pe_s,
    nullif(trim(try_variant_get(j, '$.response.site_address', 'string')), '') AS site_address,
    nullif(trim(try_variant_get(j, '$.response.meter_id', 'string')), '') AS meter_id,
    lower(try_variant_get(j, '$.response.utility_type', 'string')) AS utility_type,
    try_variant_get(j, '$.response.consumption', 'double') AS consumption,
    try_variant_get(j, '$.response.consumption_unit', 'string') AS unit_raw,
    try_variant_get(j, '$.response.energy_kwh_stated', 'double') AS energy_kwh_stated,
    lower(try_variant_get(j, '$.response.reading_type', 'string')) AS reading_type,
    try_variant_get(j, '$.response.amount_net', 'double') AS amount_net,
    try_variant_get(j, '$.response.vat_amount', 'double') AS vat_amount,
    try_variant_get(j, '$.response.amount_total', 'double') AS amount_total,
    upper(trim(try_variant_get(j, '$.response.currency', 'string'))) AS currency_raw
  FROM r
),
n AS (
  SELECT f.*,
    coalesce(try_to_date(invoice_date_s), try_to_date(invoice_date_s, 'dd.MM.yyyy'), try_to_date(invoice_date_s, 'dd/MM/yyyy'), try_to_date(invoice_date_s, 'dd-MM-yyyy')) AS invoice_date,
    coalesce(try_to_date(ps_s), try_to_date(ps_s, 'dd.MM.yyyy'), try_to_date(ps_s, 'dd/MM/yyyy'), try_to_date(ps_s, 'dd-MM-yyyy')) AS billing_period_start,
    coalesce(try_to_date(pe_s), try_to_date(pe_s, 'dd.MM.yyyy'), try_to_date(pe_s, 'dd/MM/yyyy'), try_to_date(pe_s, 'dd-MM-yyyy')) AS billing_period_end,
    CASE
      WHEN lower(regexp_replace(unit_raw, '[\\s.]', '')) = 'kwh' THEN 'kWh'
      WHEN lower(regexp_replace(unit_raw, '[\\s.]', '')) = 'mwh' THEN 'MWh'
      WHEN lower(regexp_replace(unit_raw, '[\\s.]', '')) = 'gj' THEN 'GJ'
      WHEN lower(regexp_replace(unit_raw, '[\\s.]', '')) IN ('m3', 'm³', 'smc', 'sm3', 'sm³', 'cbm', 'kubikmeter') THEN 'm3'
      ELSE unit_raw
    END AS consumption_unit,
    CASE
      WHEN currency_raw IN ('€', 'EURO', 'EUR') THEN 'EUR'
      WHEN currency_raw IN ('KČ', 'KC', 'CZK') THEN 'CZK'
      WHEN currency_raw IN ('KR', 'SEK', 'KRONOR') THEN 'SEK'
      WHEN currency_raw IN ('ZŁ', 'ZL', 'PLN') THEN 'PLN'
      ELSE currency_raw
    END AS currency,
    regexp_replace(upper(trim(split(meter_id, ';')[0])), '[^A-Z0-9]', '') AS meter_key
  FROM f
),
m AS (
  SELECT regexp_replace(upper(meter_id), '[^A-Z0-9]', '') AS meter_key, property_id, country FROM utility_meters
)
SELECT
  n.invoice_id, n.received_date, n.extraction_error, n.document_type, n.invoices_in_document,
  n.supplier_name, n.invoice_number, n.invoice_date, n.billing_period_start, n.billing_period_end,
  m.property_id, n.site_address, n.meter_id, n.utility_type, n.consumption, n.consumption_unit,
  ROUND(CASE n.consumption_unit
    WHEN 'kWh' THEN n.consumption
    WHEN 'MWh' THEN n.consumption * 1000
    WHEN 'GJ' THEN n.consumption * 1000 / 3.6
    WHEN 'm3' THEN CASE WHEN n.utility_type = 'gas' THEN coalesce(n.energy_kwh_stated, n.consumption * 10.55) END
  END, 1) AS consumption_kwh,
  CAST(n.amount_net AS DECIMAL(14,2)) AS amount_net,
  CAST(n.vat_amount AS DECIMAL(14,2)) AS vat_amount,
  CAST(n.amount_total AS DECIMAL(14,2)) AS amount_total,
  n.currency, n.reading_type,
  m.country
FROM n LEFT JOIN m ON n.meter_key = m.meter_key;

-- 3. Normalise the rows that were just inserted (and only those): derived columns + validation flags.
MERGE INTO ref_invoices_extracted t
USING (
  SELECT v.*,
    ROUND(CASE WHEN v.utility_type = 'water' THEN v.consumption ELSE v.consumption_kwh END * ef.kgco2e_per_unit, 1) AS emissions_kgco2e,
    nullif(concat_ws(',',
      CASE WHEN v.extraction_error IS NOT NULL THEN 'extraction_error' END,
      CASE WHEN v.document_type IN ('reminder', 'other') THEN 'not_an_invoice' END,
      CASE WHEN v.document_type IS NULL OR v.document_type NOT IN ('invoice', 'credit_note', 'reminder', 'other') THEN 'invalid_document_type' END,
      CASE WHEN v.document_type = 'credit_note' OR v.amount_total < 0 THEN 'credit_note' END,
      CASE WHEN v.invoices_in_document > 1 THEN 'multiple_invoices' END,
      CASE WHEN v.invoice_number IS NULL THEN 'missing_invoice_number' END,
      CASE WHEN abs(coalesce(v.amount_net, 0) + coalesce(v.vat_amount, 0) - coalesce(v.amount_total, 0)) > 1.00 THEN 'total_mismatch' END,
      CASE WHEN v.property_id IS NULL THEN 'property_unmatched' END,
      CASE WHEN v.meter_id LIKE '%;%' THEN 'multiple_meters' END,
      CASE WHEN v.consumption_kwh IS NULL AND v.utility_type <> 'water' THEN 'unit_unknown' END,
      CASE WHEN v.invoice_date > v.received_date THEN 'date_after_received' END,
      CASE WHEN v.billing_period_end < v.billing_period_start THEN 'period_invalid' END,
      CASE WHEN v.reading_type = 'estimated' THEN 'estimated_reading' END,
      -- plausibility: net price per kWh (per m3 for water) in EUR outside a generous band
      CASE WHEN v.document_type IN ('invoice', 'credit_note') AND abs(v.amount_net) > 0
             AND abs(CASE WHEN v.utility_type = 'water' THEN v.consumption ELSE v.consumption_kwh END) > 0
             AND NOT (abs(v.amount_net) / CASE v.currency WHEN 'CZK' THEN 25.0 WHEN 'SEK' THEN 11.5 WHEN 'PLN' THEN 4.3 ELSE 1.0 END
                      / abs(CASE WHEN v.utility_type = 'water' THEN v.consumption ELSE v.consumption_kwh END)
                      BETWEEN CASE WHEN v.utility_type = 'water' THEN 1.0 ELSE 0.03 END
                          AND CASE WHEN v.utility_type = 'water' THEN 12.0 ELSE 0.60 END)
           THEN 'unit_price_implausible' END
    ), '') AS validation_flags
  FROM ref_invoices_ai_output_v v
  LEFT JOIN emission_factors ef ON ef.country = v.country AND ef.utility_type = v.utility_type
) s
ON t.invoice_id = s.invoice_id
WHEN MATCHED AND t.normalized_at IS NULL THEN UPDATE SET
  t.supplier_name = s.supplier_name, t.invoice_number = s.invoice_number, t.invoice_date = s.invoice_date,
  t.billing_period_start = s.billing_period_start, t.billing_period_end = s.billing_period_end,
  t.property_id = s.property_id, t.site_address = s.site_address, t.meter_id = s.meter_id,
  t.utility_type = s.utility_type, t.consumption = s.consumption, t.consumption_unit = s.consumption_unit,
  t.consumption_kwh = s.consumption_kwh, t.amount_net = s.amount_net, t.vat_amount = s.vat_amount,
  t.amount_total = s.amount_total, t.currency = s.currency, t.document_type = s.document_type,
  t.invoices_in_document = s.invoices_in_document, t.reading_type = s.reading_type,
  t.emissions_kgco2e = s.emissions_kgco2e, t.validation_flags = s.validation_flags,
  t.extraction_error = s.extraction_error, t.normalized_at = current_timestamp();
