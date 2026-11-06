# Module 2: Quarterly survey alert — "Ask every tenant, every quarter"

**Session:** 9:50–10:00 (10 min) · **You build:** a SQL alert "Survey request – <your_name>" that runs quarterly and emails the survey link for the open campaign · **Reference:** alert "Quarterly tenant ESG survey request (Reference)" (folder `alerts`) + job "[Revantage ESG workshop] Send survey request email now (Reference)" to send it on demand
**Starting state:** `<catalog>.<schema>.survey_campaigns` (2026-Q4 is `open`, closes 30 Nov 2026), `ref_survey_request_status` (one row per contact × campaign with `completed`); your survey app URL from Module 1b (or the reference app's URL)
**Where:** SQL editor with Genie Code → **Alerts** (New → Alert)

**Scope tip:** saved queries and alerts land in your home folder unless you move them. In the **Save** / **Move** dialog choose the `alerts` folder (`/Users/<you>/alerts`), and create the alert from that folder. **Create alert** from the Alerts page creates a new query in the home root (not inside `alerts`), so start from the saved query's **Create alert** (the query's **⋮ → File** menu lists it) instead. Move the query to `alerts` before you create the alert.

The email isn't personalised (one message to the survey distribution list); the respondent types their email in the app, which matches it to `survey_contacts`. In the workshop you subscribe yourself as the stand-in for the tenant list.

## Stage 1: The alert query (3 min)

**Prompt** (Genie Code, SQL editor):
> Write a query on <catalog>.<schema>.survey_campaigns joined to <catalog>.<schema>.ref_survey_request_status on campaign_id, for the campaign with status 'open' only. Return one row: campaign_id, campaign_name, closes_on (closes_at formatted like '30 November 2026'), survey_link = '<your app url>' || '/?campaign=' || campaign_id, and contacts_pending = number of requests that are not completed. Run it.

**Expected:** 1 row: `2026-Q4` · Tenant ESG & satisfaction survey 2026-Q4 · 30 November 2026 · `<your app url>/?campaign=2026-Q4` · **29** pending (of 60; 31 completed).
**Checkpoint:** open the `survey_link` value in a new tab: your app shows the 2026-Q4 survey.
**If stuck:** copy the query from the reference alert (Alerts → "Quarterly tenant ESG survey request (Reference)").

## Stage 2: Create the alert (5 min)

Save the query, then **New → Alert** (or the query's **Schedule / Create alert** menu):
- **Condition:** `contacts_pending` **>** `0` (the alert fires while someone still has to answer). If the query returns no rows → OK.
- **Schedule:** cron `0 0 8 6 1,4,7,10 ?`, timezone Europe/Luxembourg = 08:00 on 6 January, April, July, October (first week of each quarter).
- **Notifications:** add yourself. Turn on **custom template**:
  - Subject: `Revantage tenant ESG survey {{#QUERY_RESULT_ROWS}}{{campaign_id}}{{/QUERY_RESULT_ROWS}}: 5 minutes to tell us about your building`
  - Body:
    ```
    Dear tenant,

    Revantage asks every tenant each quarter how the building performs on energy and carbon, indoor comfort, waste, water, sustainable transport, wellbeing and communication.

    Please complete this quarter's survey (about 5 minutes):
    {{#QUERY_RESULT_ROWS}}{{survey_link}}{{/QUERY_RESULT_ROWS}}

    Enter the email address this message was sent to. The survey closes on {{#QUERY_RESULT_ROWS}}{{closes_on}}{{/QUERY_RESULT_ROWS}}.

    Thank you,
    Revantage Asset Management, ESG team
    ```
**Watch for (seen in pre-build):** `{{QUERY_RESULT_ROWS.0.campaign_id}}` renders as empty ("survey : 5 minutes…"); use the section form `{{#QUERY_RESULT_ROWS}}…{{/QUERY_RESULT_ROWS}}` for column values (one row, so it prints once).

## Stage 3: Send it now (2 min)

Don't wait for January: on the alert page **Run now** (or run the reference job **Send survey request email now (Reference)**, which wraps the alert in an *alert task*).
**Expected:** status **Triggered**; within ~30 s an email from Databricks with subject **"Revantage tenant ESG survey 2026-Q4: 5 minutes to tell us about your building"** and the body above, with your link `…/?campaign=2026-Q4` and "closes on 30 November 2026".
**Checkpoint:** click the link in the email: the survey opens on 2026-Q4.
**If stuck:** subscribe to the reference alert and run the reference job.

## Wrap-up
- **So what:** the quarterly survey invitation is a governed, scheduled query: when a campaign opens, every tenant gets the link, with no mailing tool or spreadsheet.
- **Production note:** subscribe a notification destination (the tenant distribution list) instead of yourself; Databricks Apps need a workspace login, so external tenants would need the survey published on a public front end (talk track).
