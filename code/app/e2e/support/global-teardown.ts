import { existsSync, unlinkSync } from "node:fs";
import { STATE_FILE, pg, readState } from "./env";

// Removes every response the tests created (answers cascade), so the dashboard and Genie numbers
// stay at the seeded values. Safety net in case a spec failed before its own cleanup.
export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const state = readState();
  if (!state.mock) {
    const db = await pg();
    try {
      const ids = Object.values(state.fresh).map((c) => c.contact_id);
      const { rowCount } = await db.query(
        `DELETE FROM survey.survey_responses WHERE campaign_id = $1 AND contact_id = ANY($2::int[]) AND submitted_at >= $3`,
        [state.campaign, ids, state.startedAt],
      );
      if (rowCount) console.log(`[e2e teardown] removed ${rowCount} leftover test response(s)`);
    } finally {
      await db.end();
    }
  }
  unlinkSync(STATE_FILE);
}
