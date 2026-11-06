import { NextRequest, NextResponse } from "next/server";
import { findContacts, getCampaign, getQuestions, isCampaignId } from "@/lib/survey-data";
import { AlreadyRespondedError, submitResponse } from "@/lib/lakebase";
import { serverError } from "@/lib/api-errors";
import { TEXT_MAX_LENGTH, type AnswerInput, type SubmitInput } from "@/lib/survey-types";

// POST /api/responses → validates against Delta (campaign, contact, questions), then writes
// survey_responses + survey_answers to Lakebase in one transaction.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SubmitInput | null;
  if (!body || !isCampaignId(String(body.campaign_id)) || typeof body.email !== "string" || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Malformed submission." }, { status: 400 });
  }
  try {
    const [campaign, questions, contacts] = await Promise.all([
      getCampaign(body.campaign_id),
      getQuestions(),
      findContacts(body.email),
    ]);
    if (!campaign) return NextResponse.json({ error: "Unknown survey campaign." }, { status: 404 });
    if (!campaign.is_open) {
      return NextResponse.json({ error: `The ${campaign.campaign_id} survey is closed.` }, { status: 410 });
    }
    const contact = body.contact_id ? contacts.find((c) => c.contact_id === body.contact_id) : contacts[0];
    if (!contact) return NextResponse.json({ error: "We couldn't match that email to a tenant contact." }, { status: 404 });

    // Every Likert statement needs a 1–5 answer; free text is optional (blank answers are not stored).
    const given = new Map<number, AnswerInput>();
    for (const a of body.answers) given.set(Number(a?.question_id), a);
    const answers: AnswerInput[] = [];
    const missing: number[] = [];
    for (const q of questions) {
      const a = given.get(q.question_id);
      if (q.question_type === "likert") {
        const v = Number(a?.likert_value);
        if (!Number.isInteger(v) || v < 1 || v > 5) missing.push(q.question_id);
        else answers.push({ question_id: q.question_id, likert_value: v, text_value: null });
      } else {
        const text = typeof a?.text_value === "string" ? a.text_value.trim() : "";
        if (text.length > TEXT_MAX_LENGTH) {
          return NextResponse.json({ error: `Answers are limited to ${TEXT_MAX_LENGTH} characters.` }, { status: 400 });
        }
        if (text) answers.push({ question_id: q.question_id, likert_value: null, text_value: text });
      }
    }
    if (missing.length) {
      return NextResponse.json({ error: "Please answer every statement.", missing }, { status: 400 });
    }

    const result = await submitResponse(campaign.campaign_id, contact, answers);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AlreadyRespondedError) {
      return NextResponse.json({ error: "You have already responded to this survey.", prior: e.prior }, { status: 409 });
    }
    return serverError("POST /api/responses", e);
  }
}
