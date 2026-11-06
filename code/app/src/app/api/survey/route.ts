import { NextRequest, NextResponse } from "next/server";
import { getCampaign, getQuestions, isCampaignId } from "@/lib/survey-data";
import { serverError } from "@/lib/api-errors";

// GET /api/survey?campaign=2026-Q4 → the campaign (default: the open one) and the questions.
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("campaign")?.trim() || null;
  if (requested && !isCampaignId(requested)) {
    return NextResponse.json({ error: `"${requested}" is not a survey campaign.` }, { status: 404 });
  }
  try {
    const [campaign, questions] = await Promise.all([getCampaign(requested), getQuestions()]);
    if (!campaign) {
      return NextResponse.json(
        { error: requested ? `We couldn't find the ${requested} survey.` : "There is no survey open at the moment." },
        { status: 404 },
      );
    }
    return NextResponse.json({ campaign, questions });
  } catch (e) {
    return serverError("GET /api/survey", e);
  }
}
