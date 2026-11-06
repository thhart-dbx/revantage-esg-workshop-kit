import "server-only";
import { randomUUID } from "node:crypto";
import type { AnswerInput, Campaign, Contact, PriorResponse, Question, SubmitResult } from "./survey-types";

// Local-only fixtures (SURVEY_DATA_SOURCE=mock). Shapes follow the workshop data contract.

export const mockCampaigns: Campaign[] = [
  { campaign_id: "2026-Q3", quarter_start: "2026-07-01", opens_at: "2026-07-01T08:00:00Z", closes_at: "2026-07-31T23:59:59Z", status: "closed", is_open: false },
  { campaign_id: "2026-Q4", quarter_start: "2026-10-01", opens_at: "2026-10-01T08:00:00Z", closes_at: "2026-12-15T23:59:59Z", status: "open", is_open: true },
];

const q = (question_id: number, question_type: "likert" | "text", theme: string, question_text: string): Question =>
  ({ question_id, question_order: question_id, question_type, theme, question_text });

export const mockQuestions: Question[] = [
  q(1, "likert", "Energy & comfort", "The temperature in our space is comfortable throughout the year."),
  q(2, "likert", "Energy & comfort", "Heating, ventilation and air conditioning respond quickly when we report an issue."),
  q(3, "likert", "Energy & comfort", "We receive useful information about our energy consumption."),
  q(4, "likert", "Water & waste", "Recycling and waste separation facilities in the building are easy to use."),
  q(5, "likert", "Water & waste", "Water-saving fixtures in the building work well."),
  q(6, "likert", "Health & wellbeing", "Indoor air quality supports a healthy working environment."),
  q(7, "likert", "Health & wellbeing", "The building offers good facilities for cycling and active travel."),
  q(8, "likert", "Engagement & communication", "Revantage communicates clearly about sustainability initiatives at our property."),
  q(9, "likert", "Engagement & communication", "We would be interested in a green lease or joint sustainability targets."),
  q(10, "likert", "Overall satisfaction", "Overall, we are satisfied with how the building is managed."),
  q(11, "text", "Your feedback", "What is the one improvement that would most improve your experience of the building?"),
  q(12, "text", "Your feedback", "Which sustainability initiatives would you like us to prioritise next year?"),
];

export const mockContacts: Contact[] = [
  { contact_id: 101, contact_name: "Sophie van Dijk", contact_email: "sophie.vandijk@northwind-logistics.example", tenant_id: 11, tenant_name: "Northwind Logistics B.V.", property_id: 1, property_name: "Amstel Logistics Park", city: "Amsterdam", country: "NL" },
  { contact_id: 102, contact_name: "Lukas Brandt", contact_email: "lukas.brandt@helix-advisory.example", tenant_id: 21, tenant_name: "Helix Advisory GmbH", property_id: 2, property_name: "Rhine Gate Offices", city: "Frankfurt", country: "DE" },
  { contact_id: 103, contact_name: "Camille Laurent", contact_email: "camille.laurent@lumiere-living.example", tenant_id: 31, tenant_name: "Lumière Living SAS", property_id: 3, property_name: "Lumière Residences", city: "Lyon", country: "FR" },
];

// response_id -> stored response (process memory; resets on restart)
const store = new Map<string, { campaign_id: string; contact_id: number; submitted_at: string; answers: AnswerInput[] }>();

// 2026-Q4 already answered by contact 103, so the "already responded" notice can be exercised.
store.set("00000000-0000-4000-8000-000000000103", { campaign_id: "2026-Q4", contact_id: 103, submitted_at: "2026-10-14T09:12:00Z", answers: [] });

export function mockPrior(campaignId: string, contactId: number): PriorResponse | null {
  for (const [response_id, r] of store) {
    if (r.campaign_id === campaignId && r.contact_id === contactId) return { response_id, submitted_at: r.submitted_at };
  }
  return null;
}

export function mockSubmit(campaignId: string, contact: Contact, answers: AnswerInput[]): SubmitResult {
  const response_id = randomUUID();
  const submitted_at = new Date().toISOString();
  store.set(response_id, { campaign_id: campaignId, contact_id: contact.contact_id, submitted_at, answers });
  return { response_id, submitted_at, answers_saved: answers.length };
}

export function mockGet(responseId: string) {
  return store.get(responseId) ?? null;
}

export function mockDelete(responseId: string): boolean {
  return store.delete(responseId);
}
