# Module 2: Quarterly survey alert — "Ask every tenant, every quarter"

**Session:** 10:00–10:15 (15 min) · **You build:** a SQL alert "Survey request – <your_name>" that runs quarterly and emails the survey link for the open campaign · **Reference:** alert "Quarterly tenant ESG survey request (Reference)" (folder `alerts`) + job "[Revantage ESG workshop] Send survey request email now (Reference)" to send it on demand
**Starting state:** `<catalog>.<schema>.survey_campaigns` (2026-Q4 is `open`, closes 30 Nov 2026), `ref_survey_request_status` (one row per contact × campaign with `completed`); your survey app URL from Module 1b (or the reference app's URL)
**Where:** SQL editor with Genie Code → **File → Create alert**

**Folder tip:** saved queries land in your home folder. Move the query to your `alerts` folder (`/Users/<you>/alerts`) and create the alert from the query's **File** menu, not from the Alerts page (that one makes a new query in your home folder).

The email isn't personalised (one message to the survey distribution list); the respondent types their email in the app, which matches it to `survey_contacts`. In the workshop you subscribe yourself as the stand-in for the tenant list.

## Stage 1: The alert query (4 min)

**Prompt** (Genie Code, SQL editor):
> Write a query on <catalog>.<schema>.survey_campaigns joined to <catalog>.<schema>.ref_survey_request_status on campaign_id, for the campaign with status 'open' only. Return one row: campaign_id, campaign_name, closes_on (closes_at formatted like '30 November 2026'), survey_link = '<your app url>' || '/?campaign=' || campaign_id, and contacts_pending = number of requests that are not completed. Run it.

**Expected:** 1 row: `2026-Q4` · Tenant ESG & satisfaction survey 2026-Q4 · 30 November 2026 · `<your app url>/?campaign=2026-Q4` · **29** pending (of 60; 31 completed). Genie Code's query is a pending change: click **Accept query** before you save it.
**Checkpoint:** open the `survey_link` value in a new tab: your app shows the 2026-Q4 survey.
**If stuck:** copy the query from the reference alert (Alerts → "Quarterly tenant ESG survey request (Reference)").

## Stage 2: Create the alert (9 min)

Checklist, in this order:
1. **Accept query** (if you haven't), then **Save**. It saves as `New Query <time>` in your home folder.
2. **File → Move…** → folder **`alerts`** → **Move**.
3. **File → Create alert**. The dialog asks for a folder: pick **`alerts`**. Name the alert "Survey request – <your_name>".
4. **Condition:** column `contacts_pending`, operator **>**, threshold **`0`** (the alert fires while someone still has to answer). The threshold field already shows `0`: select it and type `0` over it, then check it reads exactly `0` (typing after the default gives `000`).
5. **Empty result state:** set it to **OK** (the default is Error). With no open campaign the query returns no rows and the alert should stay quiet.
6. **Schedule:** cron `0 0 8 6 1,4,7,10 ?`, timezone Europe/Luxembourg = 08:00 on 6 January, April, July, October (first week of each quarter).
7. **Notifications:** add yourself. Turn on **custom template** and paste:
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
8. **Save** / **Create**.

**Checkpoint:** the alert is in your `alerts` folder and its condition reads `contacts_pending > 0`.
**Watch for (seen in pre-build):** `{{QUERY_RESULT_ROWS.0.campaign_id}}` renders as empty ("survey : 5 minutes…"); use the section form `{{#QUERY_RESULT_ROWS}}…{{/QUERY_RESULT_ROWS}}` for column values (one row, so it prints once).

## Stage 3: Send it now (2 min)

Don't wait for January: on the alert page **Run now** (or run the reference job **Send survey request email now (Reference)**, which wraps the alert in an *alert task*).
**Expected:** status **Triggered**; within ~30 s an email from Databricks with subject **"Revantage tenant ESG survey 2026-Q4: 5 minutes to tell us about your building"** and the body above, with your link `…/?campaign=2026-Q4` and "closes on 30 November 2026".
**Checkpoint:** click the link in the email: the survey opens on 2026-Q4.
**If stuck:** subscribe to the reference alert and run the reference job.

## Wrap-up
- **So what:** the quarterly survey invitation is a governed, scheduled query: when a campaign opens, every tenant gets the link, with no mailing tool or spreadsheet.
- **Production note:** subscribe a notification destination (the tenant distribution list) instead of yourself; Databricks Apps need a workspace login, so external tenants would need the survey published on a public front end (talk track).
- **Facilitator:** Stages 1–3 rehearsed in the UI on 2026-11-05 (Stage 2 took ~20 min before it became the checklist above; budget 9). The rehearsal alert reached **Triggered** with the notification sent; the email itself was checked in an inbox only for the reference alert (run through the reference job).
