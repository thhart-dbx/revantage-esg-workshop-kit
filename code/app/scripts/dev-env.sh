#!/usr/bin/env bash
# Writes code/app/.env.local for local dev against the real warehouse + Lakebase, as YOU.
# Tokens last ~1 hour: rerun when queries start failing with 401 / password errors.
# Usage: PROFILE=<p> WAREHOUSE_ID=<id> CATALOG=<c> SCHEMA=<s> [LAKEBASE_PROJECT=revantage-esg] [PGDATABASE=esg_survey] scripts/dev-env.sh
#        scripts/dev-env.sh --mock   # fixtures only, no Databricks access
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" == "--mock" ]]; then echo "SURVEY_DATA_SOURCE=mock" > .env.local; echo "wrote .env.local (mock)"; exit 0; fi
: "${PROFILE:?set PROFILE}" "${WAREHOUSE_ID:?set WAREHOUSE_ID}" "${CATALOG:?set CATALOG}" "${SCHEMA:?set SCHEMA}"
LAKEBASE_PROJECT=${LAKEBASE_PROJECT:-revantage-esg}
PGDATABASE=${PGDATABASE:-esg_survey}
EP="projects/$LAKEBASE_PROJECT/branches/production/endpoints/primary"
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
HOST=$(databricks auth describe -p "$PROFILE" -o json | j "d['details']['host']")
TOKEN=$(databricks auth token -p "$PROFILE" | j "d['access_token']")
ME=$(databricks current-user me -p "$PROFILE" -o json | j "d['userName']")
PGHOST=$(databricks postgres get-endpoint "$EP" -p "$PROFILE" -o json | j "d['status']['hosts']['host']")
PGPASS=$(databricks postgres generate-database-credential "$EP" -p "$PROFILE" -o json | j "d['token']")
cat > .env.local <<ENV
DATABRICKS_HOST=$HOST
DATABRICKS_TOKEN=$TOKEN
DATABRICKS_WAREHOUSE_ID=$WAREHOUSE_ID
DATABRICKS_CATALOG=$CATALOG
DATABRICKS_SCHEMA=$SCHEMA
PGHOST=$PGHOST
PGPORT=5432
PGDATABASE=$PGDATABASE
PGUSER=$ME
PGSSLMODE=require
LAKEBASE_PASSWORD=$PGPASS
LAKEBASE_ENDPOINT=$EP
ENV
echo "wrote .env.local for $ME on $HOST (Lakebase $PGHOST/$PGDATABASE)"
