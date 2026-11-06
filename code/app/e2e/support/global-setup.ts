import { writeFileSync } from "node:fs";
import { STATE_FILE, fq, isMock, pg, sql, type E2EState } from "./env";

const PROJECTS = ["desktop", "mobile"];

export default async function globalSetup() {
  const startedAt = new Date().toISOString();
  if (isMock()) {
    const state: E2EState = {
      mock: true,
      campaign: "2026-Q4",
      startedAt,
      fresh: {
        desktop: { contact_id: 101, email: "sophie.vandijk@northwind-logistics.example", name: "Sophie van Dijk", property: "Amstel Logistics Park" },
        mobile: { contact_id: 102, email: "lukas.brandt@helix-advisory.example", name: "Lukas Brandt", property: "Rhine Gate Offices" },
      },
      responded: { email: "camille.laurent@lumiere-living.example", name: "Camille Laurent" },
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return;
  }

  const [campaign] = await sql(
    `SELECT campaign_id FROM ${fq("survey_campaigns")} ORDER BY lower(status) = 'open' DESC, opens_at DESC LIMIT 1`,
  );
  const campaignId = campaign.campaign_id!;
  const contacts = await sql(
    `SELECT CAST(c.contact_id AS INT) AS contact_id, c.contact_email, c.contact_name, p.property_name
     FROM ${fq("survey_contacts")} c LEFT JOIN ${fq("properties")} p USING (property_id)
     WHERE c.contact_email IN (SELECT contact_email FROM ${fq("survey_contacts")} GROUP BY contact_email HAVING count(*) = 1)
     ORDER BY c.contact_id DESC`,
  );
  const db = await pg();
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT contact_id FROM survey.survey_responses WHERE campaign_id = $1`,
      [campaignId],
    );
    const responded = new Set(rows.map((r) => Number(r.contact_id)));
    const fresh = contacts.filter((c) => !responded.has(Number(c.contact_id)));
    const done = contacts.find((c) => responded.has(Number(c.contact_id)));
    if (fresh.length < PROJECTS.length) throw new Error(`Need ${PROJECTS.length} contacts without a ${campaignId} response`);
    const state: E2EState = {
      mock: false,
      campaign: campaignId,
      startedAt,
      fresh: Object.fromEntries(
        PROJECTS.map((p, i) => [
          p,
          { contact_id: Number(fresh[i].contact_id), email: fresh[i].contact_email!, name: fresh[i].contact_name!, property: fresh[i].property_name! },
        ]),
      ),
      responded: done ? { email: done.contact_email!, name: done.contact_name! } : null,
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } finally {
    await db.end();
  }
}
