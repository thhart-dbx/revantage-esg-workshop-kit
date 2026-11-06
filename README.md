# Revantage ESG hands-on workshop kit (Databricks)

Everything you need for the morning of **6 November 2026, 9:00–12:00**. You build two ESG journeys yourself, in your
own copy of the data, with **Genie Code**:

* **UJ1 Quarterly tenant ESG survey:** a survey app on Lakebase Postgres, Lakehouse Sync to Delta, a SQL alert, an
  AI/BI dashboard and a Genie space.
* **UJ2 Utility invoice extraction:** `ai_parse_document` + `ai_extract` on invoices in five currencies and eight
  languages, a QA/QC app with write-back, and a QA errors dashboard.

Each module has a guide with the exact Genie Code prompt per stage, the expected result, a checkpoint, and what to do
if you're stuck (every asset also exists as a finished reference: objects named `ref_…` or titled "(Reference)").

## How to start (Module 0)

1. **Workspace** → **Home** → **Create** → **Git folder** → Git repository URL
   `https://github.com/thhart-dbx/revantage-esg-workshop-kit` → **Create Git folder**. The repo is public: no Git
   credential needed.
2. Follow [`code/prompts/m00-getting-started.md`](code/prompts/m00-getting-started.md): create your two apps, run
   `code/setup/participant_setup` (type the catalog and shared schema your facilitator gives you into the first cell,
   **Run all** on Serverless), then deploy the apps from your Git folder.
3. Write down the names the notebook prints (`<my_schema>`, `<your_name>`, `<pg_schema>`): every guide uses them.

## Agenda

| Time | Min | Module | Guide |
|---|---|---|---|
| 9:00–9:25 | 25 | **M0** Welcome, Git folder, your own data copy, start deploying both apps (Stage 5 optional) | [m00-getting-started.md](code/prompts/m00-getting-started.md) |
| 9:25–9:45 | 20 | **M1a** Lakebase schema, Lakehouse Sync, survey tables | [m01a-lakebase-tables.md](code/prompts/m01a-lakebase-tables.md) |
| 9:45–10:00 | 15 | **M1b** Point your survey app at your data, add one feature with Genie Code | [m01b-survey-app.md](code/prompts/m01b-survey-app.md) |
| 10:00–10:15 | 15 | **M2** Quarterly survey alert (query by prompt, alert as a checklist) | [m02-survey-alert.md](code/prompts/m02-survey-alert.md) |
| 10:15–10:40 | 25 | **M3** Survey dashboard: Stages 1–3 (Stages 4–5 optional, take-home) | [m03-survey-dashboard.md](code/prompts/m03-survey-dashboard.md) |
| 10:40–10:50 | 10 | Break | |
| 10:50–11:10 | 20 | **M4** Survey Genie space: Stages 1–4 (Stage 5 optional) | [m04-survey-genie.md](code/prompts/m04-survey-genie.md) |
| 11:10–11:35 | 25 | **M5** `ai_extract`: Stages 1–4 hands-on; Stages 5–6 (job + live drop) shown by the facilitator on the reference job | [m05-ai-extract.md](code/prompts/m05-ai-extract.md) |
| 11:35–11:50 | 15 | **M6** Point your QA app at your table, add one feature with Genie Code | [m06-qa-app.md](code/prompts/m06-qa-app.md) |
| 11:50–11:55 | 5 | **M7** QA errors dashboard: facilitator demo of "Revantage Invoice QA (Reference)" (build it yourself: take-home) | [m07-qa-dashboard.md](code/prompts/m07-qa-dashboard.md) |
| 11:55–12:00 | 5 | Wrap-up | |

All guides in one document: [`participant-handout.md`](participant-handout.md) (also as `.docx`).

## What's in here

| Path | What |
|---|---|
| `code/prompts/` | One guide per module (`mNN-*.md`); `solutions/` holds the finished feature files for M1b and M6 |
| `code/setup/participant_setup` | Module 0 notebook: builds your copy `<schema>_<your name>` and checks it (PASS lines) |
| `code/data-gen/`, `code/documents/out/` | Seeded survey data generator; the synthetic invoice PDFs (`incoming/`, `live_drop/`) and master data CSVs |
| `code/app/` | Tenant survey app (Next.js, Databricks Apps), deployed in Module 0, extended in Module 1b |
| `code/app-invoice-qa/` | Invoice QA app, deployed in Module 0, extended in Module 6 |
| `code/lakebase/`, `code/sql/`, `code/invoices/` | SQL used in the "if stuck" steps (Lakebase DDL, survey reference views, invoice extraction and QA queue) |

All data is synthetic. To get guide updates during the session: Git folder → branch button (**main**) → **Pull**.
