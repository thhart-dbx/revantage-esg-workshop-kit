# Databricks notebook source
# /// script
# [tool.databricks.environment]
# environment_version = "4"
# ///
# MAGIC %md
# MAGIC # Module 0 · Build your own copy of the workshop data
# MAGIC
# MAGIC Run this notebook from your Git folder (**Run all**, serverless). In about 2 minutes it builds the
# MAGIC starting state in **your** schema `<shared schema>_<your name>`:
# MAGIC
# MAGIC * **Survey journey (UJ1):** the 6 Delta tables the survey app and dashboard read (`properties`, `tenants`,
# MAGIC   `survey_contacts`, `survey_questions`, `survey_campaigns`, `survey_requests`). Your Lakebase tables come in Module 1a.
# MAGIC * **Invoice journey (UJ2):** the volume `utility_invoices` with the synthetic invoice PDFs in dated drop folders,
# MAGIC   plus `utility_meters` and `emission_factors`.
# MAGIC
# MAGIC Same data as the shared workshop schema, value for value, so every expected result in the module guides holds
# MAGIC for your copy too. Type the two names shared at the start of the session into the next cell, then **Run all**.
# MAGIC Safe to re-run: it rebuilds your copy.

# COMMAND ----------

CATALOG = ""        # 1. the workshop catalog
SHARED_SCHEMA = ""  # 2. the shared workshop schema
MY_SCHEMA = ""      # 3. leave blank: becomes <SHARED_SCHEMA>_<your name>

# COMMAND ----------

import re


def param(name, typed):
    """What you typed above; a job run can pass the same names as parameters instead."""
    try:
        return dbutils.widgets.get(name).strip() or typed
    except Exception:
        return typed


catalog, shared = param("catalog", CATALOG).strip(), param("shared_schema", SHARED_SCHEMA).strip()
assert catalog and shared, "Type the catalog and shared schema names into the first code cell, then Run all again."
me = spark.sql("SELECT current_user()").first()[0]
name = re.sub(r"[^a-z0-9]+", "_", me.split("@")[0].lower()).strip("_")
my_schema = param("my_schema", MY_SCHEMA).strip() or f"{shared}_{name}"  # same rule as the sandbox job
assert my_schema != shared, "MY_SCHEMA must not be the shared schema: leave it blank."
print(f"{me} -> {catalog}.{my_schema}")

# COMMAND ----------

# MAGIC %md ## 1. Your schema

# COMMAND ----------

spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{my_schema}` COMMENT 'Revantage ESG workshop copy for {me}'")
display(spark.sql(f"DESCRIBE SCHEMA `{catalog}`.`{my_schema}`"))

# COMMAND ----------

# MAGIC %md ## 2. Survey starting state (UJ1)
# MAGIC The same script the facilitator's setup job runs (`setup_starting_state.py`), pointed at your schema.
# MAGIC It generates the dataset with a fixed seed and checks the planted facts before it writes anything.

# COMMAND ----------

import os
import runpy
import sys
from pathlib import Path

code_dir = Path(os.getcwd()).parent  # this notebook lives in <Git folder>/code/setup


def run_script(script, *argv):
    sys.argv = [script.name, *argv]
    runpy.run_path(str(script), run_name="__main__")


run_script(code_dir / "setup" / "setup_starting_state.py",
           "--catalog", catalog, "--schema", my_schema, "--bundle-root", str(code_dir))

# COMMAND ----------

# MAGIC %md ## 3. Invoice starting state (UJ2)
# MAGIC Copies the invoice files into your volume `utility_invoices` (`incoming/<received date>/` plus `live_drop/` for
# MAGIC the live demo in Module 5) and loads `utility_meters` and `emission_factors`.

# COMMAND ----------

run_script(code_dir / "invoices" / "setup_invoices.py",
           "--catalog", catalog, "--schema", my_schema, "--bundle-root", str(code_dir))

# COMMAND ----------

# MAGIC %md ## 4. Check your copy
# MAGIC Every line should say PASS.

# COMMAND ----------

import json

T = f"`{catalog}`.`{my_schema}`"
V = Path(f"/Volumes/{catalog}/{my_schema}/utility_invoices")
docs = code_dir / "documents" / "out"
facts = json.loads((code_dir / "data-gen" / "facts.json").read_text())
count = lambda t: spark.table(f"{T}.{t}").count()
files = lambda p: sum(1 for f in p.rglob("*") if f.is_file()) if p.exists() else 0
n_req = spark.sql(f"SELECT count(*) n FROM {T}.survey_requests WHERE campaign_id = '2026-Q4'").first().n
open_c = [r.campaign_id for r in spark.sql(f"SELECT campaign_id FROM {T}.survey_campaigns WHERE status = 'open'").collect()]
checks = [(f"{t}: {n} rows", count(t) == n)
          for t, n in facts["counts"].items() if t not in ("survey_responses", "survey_answers")]
checks += [
    ("open campaign 2026-Q4, 60 requests sent", (open_c, n_req) == (["2026-Q4"], 60)),
    (f"utility_meters: {sum(1 for _ in open(docs / 'utility_meters.csv')) - 1} rows",
     count("utility_meters") == sum(1 for _ in open(docs / "utility_meters.csv")) - 1),
    (f"emission_factors: {sum(1 for _ in open(docs / 'emission_factors.csv')) - 1} rows",
     count("emission_factors") == sum(1 for _ in open(docs / "emission_factors.csv")) - 1),
    (f"volume utility_invoices/incoming: {files(docs / 'incoming')} invoice files",
     files(V / "incoming") == files(docs / "incoming")),
    (f"volume utility_invoices/live_drop: {files(docs / 'live_drop')} files for the live drop",
     files(V / "live_drop") == files(docs / "live_drop")),
]
for label, ok in checks:
    print("PASS" if ok else "FAIL", " ", label)
assert all(ok for _, ok in checks), "Some checks failed: re-run the notebook, then ask your facilitator."
print(f"\nDone. In the module guides:\n  <my_schema>   = {my_schema}   (so <catalog>.<my_schema> = {catalog}.{my_schema})"
      f"\n  <your_name>   = {name}\n  <pg_schema>   = survey_{name}   (your Postgres schema in Module 1a)")
