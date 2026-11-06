// Shared types and constants for the tenant ESG survey (safe to import from client components).

export interface Campaign {
  campaign_id: string;
  quarter_start: string | null;
  opens_at: string | null;
  closes_at: string | null;
  status: string;
  is_open: boolean;
}

export interface Question {
  question_id: number;
  question_order: number;
  question_type: "likert" | "text";
  theme: string;
  question_text: string;
}

export interface Contact {
  contact_id: number;
  contact_name: string;
  contact_email: string;
  tenant_id: number | null;
  tenant_name: string | null;
  property_id: number;
  property_name: string | null;
  city: string | null;
  country: string | null;
}

export interface PriorResponse {
  response_id: string;
  submitted_at: string;
}

export interface LookupResult {
  contact: Contact;
  alreadyResponded: PriorResponse | null;
}

export interface AnswerInput {
  question_id: number;
  likert_value?: number | null;
  text_value?: string | null;
}

export interface SubmitInput {
  campaign_id: string;
  email: string;
  /** Needed only when one email is registered at several properties. */
  contact_id?: number;
  answers: AnswerInput[];
}

export interface SubmitResult {
  response_id: string;
  submitted_at: string;
  answers_saved: number;
}

export const LIKERT_LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
] as const;

export const TEXT_MAX_LENGTH = 2000;

export function formatCampaign(id: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(id);
  return m ? `Q${m[2]} ${m[1]}` : id;
}
