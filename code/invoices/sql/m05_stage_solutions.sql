-- M5 "if stuck" answers, one block per stage of code/prompts/m05-ai-extract.md.
-- Run in the SQL editor after replacing <catalog>.<my_schema> (Find & Replace), or with named parameters
-- :catalog / :my_schema in a SQL file task. Writes only <my_schema>.invoices_extracted.

USE CATALOG IDENTIFIER(:catalog);
USE SCHEMA IDENTIFIER(:my_schema);

-- Stage 1: what is in the volume? (one row per file, received date = drop folder)
SELECT regexp_extract(path, '/incoming/([0-9-]+)/', 1) AS received_date,
       regexp_extract(path, '([^/]+)$', 1) AS file_name, length AS bytes
FROM read_files('/Volumes/' || :catalog || '/' || :my_schema || '/utility_invoices/incoming/',
                format => 'binaryFile', recursiveFileLookup => 'true')
ORDER BY received_date, file_name;

-- Stage 2: one file. ai_extract v2 needs the ai_parse_document output, not the raw bytes.
SELECT ai_extract(
  ai_parse_document(content, map('version', '2.0')),
  '{"supplier_name": {"type": "string"}, "invoice_number": {"type": "string"},
    "invoice_date": {"type": "string", "description": "YYYY-MM-DD"},
    "consumption": {"type": "number"}, "consumption_unit": {"type": "string"},
    "amount_total": {"type": "number"}, "currency": {"type": "string", "description": "ISO 4217 code"}}',
  options => map('version', '2.0')) AS extracted
FROM read_files('/Volumes/' || :catalog || '/' || :my_schema || '/utility_invoices/incoming/2026-08-04/nl-elec-2026-07-noordzee.pdf',
                format => 'binaryFile');

-- Stage 3: every file into a Delta table (CTAS), typed columns + the raw JSON.
CREATE OR REPLACE TABLE invoices_extracted AS
WITH files AS (
  SELECT path, content
  FROM read_files('/Volumes/' || :catalog || '/' || :my_schema || '/utility_invoices/incoming/',
                  format => 'binaryFile', recursiveFileLookup => 'true')
),
x AS (
  SELECT path,
    try_to_date(regexp_extract(path, '/incoming/([0-9]{4}-[0-9]{2}-[0-9]{2})/', 1)) AS received_date,
    ai_extract(ai_parse_document(content, map('version', '2.0')),
      '{"document_type": {"type": "string", "enum": ["invoice", "credit_note", "reminder", "other"]},
        "invoices_in_document": {"type": "integer", "description": "Number of separate invoices in the document"},
        "supplier_name": {"type": "string"},
        "invoice_number": {"type": "string", "description": "Invoice number as printed; not the customer number. null if none"},
        "invoice_date": {"type": "string", "description": "YYYY-MM-DD"},
        "billing_period_start": {"type": "string", "description": "YYYY-MM-DD"},
        "billing_period_end": {"type": "string", "description": "YYYY-MM-DD"},
        "meter_id": {"type": "string", "description": "Meter / supply point id; several separated by ; "},
        "utility_type": {"type": "string", "enum": ["electricity", "gas", "water", "district_heating"]},
        "consumption": {"type": "number", "description": "Total billed consumption, all meters"},
        "consumption_unit": {"type": "string", "description": "kWh, MWh, GJ, m3, Smc"},
        "amount_net": {"type": "number"}, "vat_amount": {"type": "number"},
        "amount_total": {"type": "number", "description": "Invoice total incl. VAT for this period only"},
        "currency": {"type": "string", "description": "ISO 4217 code"}}',
      options => map('version', '2.0')) AS r
  FROM files
)
SELECT
  regexp_extract(path, '([^/]+)\\.[A-Za-z0-9]+$', 1) AS invoice_id,
  regexp_replace(path, '^dbfs:', '') AS file_path,
  received_date,
  r:response.document_type::string AS document_type,
  r:response.invoices_in_document::int AS invoices_in_document,
  r:response.supplier_name::string AS supplier_name,
  r:response.invoice_number::string AS invoice_number,
  try_to_date(r:response.invoice_date::string) AS invoice_date,
  try_to_date(r:response.billing_period_start::string) AS billing_period_start,
  try_to_date(r:response.billing_period_end::string) AS billing_period_end,
  r:response.meter_id::string AS meter_id,
  r:response.utility_type::string AS utility_type,
  try_variant_get(r, '$.response.consumption', 'double') AS consumption,
  r:response.consumption_unit::string AS consumption_unit,
  CAST(try_variant_get(r, '$.response.amount_net', 'double') AS DECIMAL(14,2)) AS amount_net,
  CAST(try_variant_get(r, '$.response.vat_amount', 'double') AS DECIMAL(14,2)) AS vat_amount,
  CAST(try_variant_get(r, '$.response.amount_total', 'double') AS DECIMAL(14,2)) AS amount_total,
  upper(r:response.currency::string) AS currency,
  CAST(r AS STRING) AS extraction_json,
  current_timestamp() AS extracted_at,
  'Pending' AS qa_status
FROM x;

-- Stage 4: the edge cases. Rule checks that send a row to QA.
SELECT invoice_id, document_type, invoices_in_document, invoice_number, amount_net, vat_amount, amount_total,
  concat_ws(', ',
    CASE WHEN document_type <> 'invoice' THEN 'not a plain invoice: ' || document_type END,
    CASE WHEN invoices_in_document > 1 THEN 'several invoices in one file' END,
    CASE WHEN invoice_number IS NULL THEN 'no invoice number' END,
    CASE WHEN abs(amount_net + vat_amount - amount_total) > 1 THEN 'net + VAT <> total' END,
    CASE WHEN meter_id LIKE '%;%' THEN 'several meters' END,
    CASE WHEN amount_total IS NULL OR consumption IS NULL THEN 'missing values' END) AS needs_qa_because
FROM invoices_extracted
WHERE document_type <> 'invoice' OR invoices_in_document > 1 OR invoice_number IS NULL
   OR abs(amount_net + vat_amount - amount_total) > 1 OR meter_id LIKE '%;%'
   OR amount_total IS NULL OR consumption IS NULL
ORDER BY received_date;

-- Stage 5: the incremental statement the file-arrival job runs (only files not yet in the table).
INSERT INTO invoices_extracted
WITH files AS (
  SELECT path, content
  FROM read_files('/Volumes/' || :catalog || '/' || :my_schema || '/utility_invoices/incoming/',
                  format => 'binaryFile', recursiveFileLookup => 'true')
  WHERE regexp_replace(path, '^dbfs:', '') NOT IN (SELECT file_path FROM invoices_extracted)
),
x AS (
  SELECT path, try_to_date(regexp_extract(path, '/incoming/([0-9]{4}-[0-9]{2}-[0-9]{2})/', 1)) AS received_date,
    ai_extract(ai_parse_document(content, map('version', '2.0')),
      '{"document_type": {"type": "string", "enum": ["invoice", "credit_note", "reminder", "other"]},
        "invoices_in_document": {"type": "integer", "description": "Number of separate invoices in the document"},
        "supplier_name": {"type": "string"},
        "invoice_number": {"type": "string", "description": "Invoice number as printed; not the customer number. null if none"},
        "invoice_date": {"type": "string", "description": "YYYY-MM-DD"},
        "billing_period_start": {"type": "string", "description": "YYYY-MM-DD"},
        "billing_period_end": {"type": "string", "description": "YYYY-MM-DD"},
        "meter_id": {"type": "string", "description": "Meter / supply point id; several separated by ; "},
        "utility_type": {"type": "string", "enum": ["electricity", "gas", "water", "district_heating"]},
        "consumption": {"type": "number", "description": "Total billed consumption, all meters"},
        "consumption_unit": {"type": "string", "description": "kWh, MWh, GJ, m3, Smc"},
        "amount_net": {"type": "number"}, "vat_amount": {"type": "number"},
        "amount_total": {"type": "number", "description": "Invoice total incl. VAT for this period only"},
        "currency": {"type": "string", "description": "ISO 4217 code"}}',
      options => map('version', '2.0')) AS r
  FROM files
)
SELECT regexp_extract(path, '([^/]+)\\.[A-Za-z0-9]+$', 1), regexp_replace(path, '^dbfs:', ''), received_date,
  r:response.document_type::string, r:response.invoices_in_document::int, r:response.supplier_name::string,
  r:response.invoice_number::string, try_to_date(r:response.invoice_date::string),
  try_to_date(r:response.billing_period_start::string), try_to_date(r:response.billing_period_end::string),
  r:response.meter_id::string, r:response.utility_type::string, try_variant_get(r, '$.response.consumption', 'double'),
  r:response.consumption_unit::string, CAST(try_variant_get(r, '$.response.amount_net', 'double') AS DECIMAL(14,2)),
  CAST(try_variant_get(r, '$.response.vat_amount', 'double') AS DECIMAL(14,2)),
  CAST(try_variant_get(r, '$.response.amount_total', 'double') AS DECIMAL(14,2)), upper(r:response.currency::string),
  CAST(r AS STRING), current_timestamp(), 'Pending'
FROM x;
