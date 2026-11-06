import "server-only";
import { Pool } from "pg";
import { pgSchema, isMockMode } from "./config";
import { mockPrior, mockSubmit } from "./mock";
import type { AnswerInput, Contact, PriorResponse, SubmitResult } from "./survey-types";

// Write side: survey responses go to Lakebase Postgres (synced to Delta for analytics).
//
// On Databricks Apps the Lakebase resource (code/resources/app.yml) injects PGHOST, PGPORT,
// PGDATABASE, PGUSER (the app service principal's client id) and PGSSLMODE. The Postgres password
// is a short-lived workspace OAuth token for that service principal, minted from
// DATABRICKS_CLIENT_ID/SECRET and refreshed before it expires (pg calls `password` per connection).
// Locally: set the same PG* vars plus LAKEBASE_PASSWORD (or DATABRICKS_TOKEN) in .env.local.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function password(): Promise<string> {
  if (process.env.LAKEBASE_PASSWORD) return process.env.LAKEBASE_PASSWORD;
  if (!process.env.DATABRICKS_CLIENT_ID || !process.env.DATABRICKS_CLIENT_SECRET) {
    if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN;
    throw new Error("No Lakebase credential: set LAKEBASE_PASSWORD locally, or run as a Databricks App");
  }
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60_000) return cachedToken.value;
  const host = process.env.DATABRICKS_HOST!.replace(/^(?!https?:\/\/)/, "https://").replace(/\/$/, "");
  const res = await fetch(`${host}/oidc/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${process.env.DATABRICKS_CLIENT_ID}:${process.env.DATABRICKS_CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials&scope=all-apis",
  });
  if (!res.ok) throw new Error(`OAuth token request failed: ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

let pool: Pool | undefined;

function db(): Pool {
  if (!process.env.PGHOST) throw new Error("PGHOST is not set: bind the Lakebase resource to the app");
  pool ??= new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  return pool;
}

const t = (name: string) => `${pgSchema()}.${name}`;

export async function priorResponse(campaignId: string, contactId: number): Promise<PriorResponse | null> {
  if (isMockMode()) return mockPrior(campaignId, contactId);
  const { rows } = await db().query(
    `SELECT response_id::text AS response_id, submitted_at
     FROM ${t("survey_responses")}
     WHERE campaign_id = $1 AND contact_id = $2
     ORDER BY submitted_at DESC LIMIT 1`,
    [campaignId, contactId],
  );
  return rows[0] ? { response_id: rows[0].response_id, submitted_at: new Date(rows[0].submitted_at).toISOString() } : null;
}

export class AlreadyRespondedError extends Error {
  constructor(public prior: PriorResponse) {
    super("This contact has already responded to this campaign");
  }
}

/**
 * Writes one response and its answers in a single transaction. A transaction-scoped advisory lock on
 * (campaign, contact) makes the "already responded" check safe against double submits.
 */
export async function submitResponse(campaignId: string, contact: Contact, answers: AnswerInput[]): Promise<SubmitResult> {
  if (isMockMode()) {
    const prior = mockPrior(campaignId, contact.contact_id);
    if (prior) throw new AlreadyRespondedError(prior);
    return mockSubmit(campaignId, contact, answers);
  }
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`survey:${campaignId}:${contact.contact_id}`]);
    const prior = await client.query(
      `SELECT response_id::text AS response_id, submitted_at FROM ${t("survey_responses")}
       WHERE campaign_id = $1 AND contact_id = $2 LIMIT 1`,
      [campaignId, contact.contact_id],
    );
    if (prior.rows[0]) {
      throw new AlreadyRespondedError({
        response_id: prior.rows[0].response_id,
        submitted_at: new Date(prior.rows[0].submitted_at).toISOString(),
      });
    }
    const { rows } = await client.query(
      `INSERT INTO ${t("survey_responses")} (campaign_id, contact_id, contact_email, property_id)
       VALUES ($1, $2, $3, $4)
       RETURNING response_id::text AS response_id, submitted_at`,
      [campaignId, contact.contact_id, contact.contact_email.toLowerCase(), contact.property_id],
    );
    const responseId: string = rows[0].response_id;
    const ins = await client.query(
      `INSERT INTO ${t("survey_answers")} (response_id, question_id, likert_value, text_value)
       SELECT $1::uuid, q, l, x FROM unnest($2::int[], $3::smallint[], $4::text[]) AS a(q, l, x)`,
      [
        responseId,
        answers.map((a) => a.question_id),
        answers.map((a) => a.likert_value ?? null),
        answers.map((a) => a.text_value ?? null),
      ],
    );
    await client.query("COMMIT");
    return {
      response_id: responseId,
      submitted_at: new Date(rows[0].submitted_at).toISOString(),
      answers_saved: ins.rowCount ?? answers.length,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
