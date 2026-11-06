"""Load the workshop starting state (shared `properties` + UJ1 survey Delta tables) into <catalog>.<schema>.

Serverless job task (resources/setup.yml, key `setup_starting_state`). Parameterised by catalog/schema so
Module 0 can build a participant copy (<schema>_<name>) with the same code. Idempotent: CREATE OR REPLACE.
The Lakebase response history is loaded by the separate `lakebase_setup` job from the same generator.
"""
import argparse
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--catalog", required=True)
ap.add_argument("--schema", required=True)
ap.add_argument("--bundle-root", required=True, help="${workspace.file_path}")
args = ap.parse_args()

root = Path(args.bundle_root if args.bundle_root.startswith("/Workspace") else "/Workspace" + args.bundle_root)
sys.path.insert(0, str(root / "data-gen"))
import generate  # noqa: E402

from pyspark.sql import SparkSession  # noqa: E402

spark = SparkSession.builder.getOrCreate()
data = generate.generate()  # runs the planted-fact assertions
fq = f"`{args.catalog}`.`{args.schema}`"
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {fq}")

TABLES = {
    "properties": (
        "Revantage European ESG portfolio: one row per property (10). Shared by the survey (UJ1) and invoice (UJ2) journeys.",
        [("property_id", "INT", "Property id (1-10), primary key"),
         ("property_name", "STRING", "Property name"),
         ("city", "STRING", "City"),
         ("country", "STRING", "ISO-2 country code"),
         ("property_type", "STRING", "Logistics, Office, Residential, Retail or Mixed-use"),
         ("local_currency", "STRING", "Currency of local utility invoices (EUR, CZK, SEK, PLN)"),
         ("invoice_language", "STRING", "Language(s) of local utility invoices"),
         ("gross_floor_area_sqm", "INT", "Gross floor area in square metres"),
         ("year_built", "INT", "Year of construction"),
         ("epc_rating", "STRING", "Energy Performance Certificate rating (A best ... G worst)"),
         ("green_certification", "STRING", "Green building certification (BREEAM/LEED level) or 'none'")]),
    "tenants": (
        "Tenant companies (45) leasing space in the portfolio properties.",
        [("tenant_id", "INT", "Tenant id, primary key"),
         ("tenant_name", "STRING", "Tenant company name"),
         ("property_id", "INT", "Property the tenant occupies (FK properties)"),
         ("sector", "STRING", "Tenant business sector"),
         ("leased_area_sqm", "INT", "Leased area in square metres"),
         ("lease_start", "DATE", "Lease start date")]),
    "survey_contacts": (
        "Tenant contacts (60) who receive the quarterly tenant ESG & satisfaction survey. 6 per property.",
        [("contact_id", "INT", "Contact id, primary key"),
         ("contact_name", "STRING", "Contact full name"),
         ("contact_email", "STRING", "Contact email (respondents identify themselves with it in the survey app)"),
         ("job_title", "STRING", "Contact job title"),
         ("tenant_id", "INT", "Tenant company (FK tenants)"),
         ("property_id", "INT", "Property (FK properties)")]),
    "survey_questions": (
        "Survey questions: 8 Likert statements (1 = strongly disagree ... 5 = strongly agree), one per ESG theme, plus 3 free-text questions.",
        [("question_id", "INT", "Question id, primary key"),
         ("question_order", "INT", "Display order in the survey"),
         ("question_type", "STRING", "'likert' (1-5 agreement) or 'text' (free text)"),
         ("theme", "STRING", "ESG theme, e.g. Energy & carbon, Indoor comfort, Waste & recycling, Water, Sustainable transport, Wellbeing, Communication, Overall satisfaction"),
         ("question_text", "STRING", "Statement or question shown to the respondent"),
         ("is_required", "BOOLEAN", "Whether an answer is required (Likert questions)")]),
    "survey_campaigns": (
        "Quarterly survey campaigns 2025-Q4 ... 2026-Q4. Exactly one campaign has status 'open' (the current quarter).",
        [("campaign_id", "STRING", "Campaign id = quarter, e.g. 2026-Q4 (used in the survey link ?campaign=)"),
         ("campaign_name", "STRING", "Campaign display name"),
         ("quarter_start", "DATE", "First day of the quarter"),
         ("opens_at", "TIMESTAMP", "When survey requests were sent and the survey opened"),
         ("closes_at", "TIMESTAMP", "When the survey closes"),
         ("status", "STRING", "'open' or 'closed'")]),
    "survey_requests": (
        "Survey requests sent: one row per contact per campaign (requests sent). Join to ref_survey_responses on (campaign_id, contact_id) for completion.",
        [("request_id", "STRING", "Request id, primary key"),
         ("campaign_id", "STRING", "Campaign (FK survey_campaigns)"),
         ("contact_id", "INT", "Contact the request was sent to (FK survey_contacts)"),
         ("sent_at", "TIMESTAMP", "When the request email was sent")]),
}

for name, (comment, cols) in TABLES.items():
    rows = data[name]
    ddl = ", ".join(f"{c} {t} COMMENT '{d.replace(chr(39), chr(39) * 2)}'" for c, t, d in cols)
    str_schema = ", ".join(f"{c} STRING" if t in ("DATE", "TIMESTAMP") else f"{c} {t}" for c, t, _ in cols)
    df = spark.createDataFrame([tuple(r[c] for c, _, _ in cols) for r in rows], str_schema)
    df.createOrReplaceTempView(f"_src_{name}")
    select = ", ".join(f"CAST({c} AS {t}) AS {c}" for c, t, _ in cols)
    target = f"{fq}.`{name}`"
    spark.sql(f"CREATE OR REPLACE TABLE {target} ({ddl}) COMMENT '{comment.replace(chr(39), chr(39) * 2)}'")
    spark.sql(f"INSERT INTO {target} SELECT {select} FROM _src_{name}")
    n = spark.table(target).count()
    assert n == len(rows), (name, n, len(rows))
    print(f"{name}: {n} rows")

print("planted facts OK:", {k: data["facts"][k] for k in ("counts", "completion_rate_by_campaign")})
