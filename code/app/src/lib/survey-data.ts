import "server-only";
import { query } from "./databricks";
import { delta, isMockMode } from "./config";
import { mockCampaigns, mockContacts, mockQuestions } from "./mock";
import type { Campaign, Contact, Question } from "./survey-types";

// Read side: survey reference data lives in Delta (Unity Catalog) and is read through the SQL warehouse.

const CAMPAIGN_ID = /^\d{4}-Q[1-4]$/;
export const isCampaignId = (id: string) => CAMPAIGN_ID.test(id);

type Row = Record<string, unknown>;

function toCampaign(r: Row): Campaign {
  return {
    campaign_id: String(r.campaign_id),
    quarter_start: r.quarter_start == null ? null : String(r.quarter_start),
    opens_at: r.opens_at == null ? null : String(r.opens_at),
    closes_at: r.closes_at == null ? null : String(r.closes_at),
    status: String(r.status ?? ""),
    is_open: Boolean(r.is_open),
  };
}

const CAMPAIGN_SELECT = () => `
  SELECT campaign_id,
         CAST(quarter_start AS STRING) AS quarter_start,
         CAST(opens_at AS STRING) AS opens_at,
         CAST(closes_at AS STRING) AS closes_at,
         status,
         lower(status) = 'open'
           AND (opens_at IS NULL OR opens_at <= current_timestamp())
           AND (closes_at IS NULL OR closes_at >= current_timestamp()) AS is_open
  FROM ${delta("survey_campaigns")}`;

/** The requested campaign, or (no id) the most recent open one, falling back to the most recent. */
export async function getCampaign(campaignId?: string | null): Promise<Campaign | null> {
  if (campaignId && !isCampaignId(campaignId)) return null;
  if (isMockMode()) {
    if (campaignId) return mockCampaigns.find((c) => c.campaign_id === campaignId) ?? null;
    return mockCampaigns.find((c) => c.is_open) ?? mockCampaigns.at(-1) ?? null;
  }
  const rows = campaignId
    ? await query(`${CAMPAIGN_SELECT()} WHERE campaign_id = :campaign_id`, { campaign_id: campaignId })
    : await query(`${CAMPAIGN_SELECT()} ORDER BY lower(status) = 'open' DESC, opens_at DESC LIMIT 1`);
  return rows[0] ? toCampaign(rows[0]) : null;
}

let questionCache: { at: number; value: Question[] } | null = null;

/** Survey statements and free-text questions in survey order (cached for 5 minutes). */
export async function getQuestions(): Promise<Question[]> {
  if (isMockMode()) return mockQuestions;
  if (questionCache && Date.now() - questionCache.at < 5 * 60_000) return questionCache.value;
  const rows = await query(
    `SELECT CAST(question_id AS INT) AS question_id, CAST(question_order AS INT) AS question_order,
            lower(question_type) AS question_type, theme, question_text
     FROM ${delta("survey_questions")}
     WHERE lower(question_type) IN ('likert', 'text')
     ORDER BY question_order, question_id`,
  );
  const value = rows.map((r) => ({
    question_id: Number(r.question_id),
    question_order: Number(r.question_order),
    question_type: r.question_type as Question["question_type"],
    theme: String(r.theme ?? ""),
    question_text: String(r.question_text),
  }));
  questionCache = { at: Date.now(), value };
  return value;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Contact(s) registered with this work email, with their tenant company and property. */
export async function findContacts(email: string): Promise<Contact[]> {
  const e = normaliseEmail(email);
  if (isMockMode()) return mockContacts.filter((c) => c.contact_email.toLowerCase() === e);
  const rows = await query(
    `SELECT CAST(c.contact_id AS INT) AS contact_id, c.contact_name, c.contact_email,
            CAST(c.tenant_id AS INT) AS tenant_id, t.tenant_name,
            CAST(c.property_id AS INT) AS property_id, p.property_name, p.city, p.country
     FROM ${delta("survey_contacts")} c
     LEFT JOIN ${delta("tenants")} t ON t.tenant_id = c.tenant_id
     LEFT JOIN ${delta("properties")} p ON p.property_id = c.property_id
     WHERE lower(trim(c.contact_email)) = :email
     ORDER BY c.contact_id`,
    { email: e },
  );
  return rows.map((r) => ({
    contact_id: Number(r.contact_id),
    contact_name: String(r.contact_name),
    contact_email: String(r.contact_email),
    tenant_id: r.tenant_id == null ? null : Number(r.tenant_id),
    tenant_name: r.tenant_name == null ? null : String(r.tenant_name),
    property_id: Number(r.property_id),
    property_name: r.property_name == null ? null : String(r.property_name),
    city: r.city == null ? null : String(r.city),
    country: r.country == null ? null : String(r.country),
  }));
}
