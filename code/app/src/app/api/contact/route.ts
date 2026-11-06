import { NextRequest, NextResponse } from "next/server";
import { findContacts, isCampaignId } from "@/lib/survey-data";
import { priorResponse } from "@/lib/lakebase";
import { serverError } from "@/lib/api-errors";
import type { LookupResult } from "@/lib/survey-types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/contact { email, campaign_id } → the matching contact(s) and whether they already responded.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; campaign_id?: string };
  const email = String(body.email ?? "").trim();
  const campaignId = String(body.campaign_id ?? "");
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid work email address." }, { status: 400 });
  }
  if (!isCampaignId(campaignId)) return NextResponse.json({ error: "Unknown survey campaign." }, { status: 400 });
  try {
    const contacts = await findContacts(email);
    if (contacts.length === 0) {
      return NextResponse.json(
        {
          error:
            "We couldn't find that email in our tenant contact list. Please use the address the survey invitation was sent to, or contact your Revantage property manager.",
        },
        { status: 404 },
      );
    }
    const results: LookupResult[] = await Promise.all(
      contacts.map(async (contact) => ({ contact, alreadyResponded: await priorResponse(campaignId, contact.contact_id) })),
    );
    return NextResponse.json({ results });
  } catch (e) {
    return serverError("POST /api/contact", e);
  }
}
