import { expect, test, type Page } from "@playwright/test";
import { fq, pg, readState, sql, type E2EState } from "./support/env";

// CUJ UJ1: a tenant opens the survey link from the quarterly email, identifies with their work
// email, answers the Likert statements and free-text questions, and submits. The response is
// written to Lakebase (one transaction) and replicated to Delta by Lakehouse Sync.

const LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

interface Q {
  question_id: number;
  question_type: "likert" | "text";
  question_text: string;
}

let state: E2EState;
let questions: Q[];

test.beforeAll(async ({ request }) => {
  state = readState();
  const res = await request.get(`/api/survey?campaign=${state.campaign}`);
  expect(res.ok()).toBeTruthy();
  questions = (await res.json()).questions;
});

const likertQs = () => questions.filter((q) => q.question_type === "likert");
const textQs = () => questions.filter((q) => q.question_type === "text");
const quarter = (c: string) => c.replace(/^(\d{4})-Q(\d)$/, "Q$2 $1");

async function identify(page: Page, email: string) {
  await page.goto(`/?campaign=${state.campaign}`);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Find my building" }).click();
}

async function answer(page: Page, q: Q, value: number) {
  await page.getByTestId(`question-${q.question_id}`).getByRole("radio", { name: LABELS[value - 1], exact: true }).click();
}

test.describe("Tenant ESG survey", () => {
  // In order, in one worker per project: the last test submits, after which the contact has responded.
  test.describe.configure({ mode: "default" });

  test("survey link opens the campaign landing page", async ({ page }) => {
    await page.goto(`/?campaign=${state.campaign}`);
    await expect(page.getByRole("heading", { name: "Tenant ESG & Satisfaction Survey" })).toBeVisible();
    await expect(page.getByTestId("campaign-badge")).toHaveText(`${quarter(state.campaign)} survey`);
    await expect(page.getByText(`${likertQs().length} statements · ${textQs().length} open questions`)).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeEditable();
  });

  test("no campaign in the link defaults to the open campaign", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("campaign-badge")).toHaveText(`${quarter(state.campaign)} survey`);
  });

  test("unknown campaign shows a friendly error", async ({ page }) => {
    await page.goto("/?campaign=1999-Q1");
    await expect(page.getByTestId("load-error")).toContainText("couldn't find the 1999-Q1 survey");
    await page.goto("/?campaign=not-a-campaign");
    await expect(page.getByTestId("load-error")).toContainText("is not a survey campaign");
  });

  test("a closed campaign link shows a notice and accepts no answers", async ({ page, request }) => {
    await page.goto("/?campaign=2026-Q3");
    await expect(page.getByTestId("closed-notice")).toContainText("survey is closed");
    await expect(page.getByLabel("Work email")).toBeDisabled();
    const res = await request.post("/api/responses", {
      data: { campaign_id: "2026-Q3", email: state.fresh.desktop.email, answers: [] },
    });
    expect(res.status()).toBe(410);
  });

  test("unknown email gets a friendly error, invalid email is caught", async ({ page }) => {
    await identify(page, "nobody@unknown-company.example");
    await expect(page.getByTestId("lookup-error")).toContainText("couldn't find that email");
    await expect(page.getByTestId("start-survey")).toHaveCount(0);
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByRole("button", { name: "Find my building" }).click();
    await expect(page.getByTestId("lookup-error")).toContainText("valid work email");
  });

  test("a contact who already responded sees a notice and cannot start again", async ({ page }) => {
    test.skip(!state.responded, "no contact has responded to this campaign yet");
    await identify(page, state.responded!.email.toUpperCase()); // matching is case-insensitive
    await expect(page.getByTestId("contact-name")).toHaveText(state.responded!.name);
    await expect(page.getByTestId("already-responded")).toContainText("already completed this survey");
    await expect(page.getByTestId("start-survey")).toHaveCount(0);
  });

  test("validation: every statement must be answered", async ({ page }, info) => {
    const me = state.fresh[info.project.name];
    await identify(page, me.email);
    await page.getByTestId("start-survey").click();
    await page.getByTestId("submit-survey").click();
    await expect(page.getByTestId("validation-error")).toContainText(`${likertQs().length} statements still need an answer`);
    for (const q of likertQs().slice(1)) await answer(page, q, 4);
    await expect(page.getByTestId("validation-error")).toContainText("1 statement still needs an answer");
    await expect(page.getByTestId(`question-${likertQs()[0].question_id}`)).toContainText("Please choose an answer");
    await expect(page).toHaveURL(/\/\?campaign=/); // nothing submitted
  });

  test("API rejects incomplete and malformed submissions", async ({ request }, info) => {
    const me = state.fresh[info.project.name];
    const partial = await request.post("/api/responses", {
      data: { campaign_id: state.campaign, email: me.email, answers: [{ question_id: likertQs()[0].question_id, likert_value: 9 }] },
    });
    expect(partial.status()).toBe(400);
    expect((await partial.json()).missing).toHaveLength(likertQs().length);
    const bad = await request.post("/api/responses", { data: { campaign_id: "x" } });
    expect(bad.status()).toBe(400);
    const stranger = await request.post("/api/responses", {
      data: { campaign_id: state.campaign, email: "nobody@unknown-company.example", answers: [] },
    });
    expect(stranger.status()).toBe(404);
  });

  test("open link → email → answer → submit → response in Lakebase and Delta", async ({ page }, info) => {
    test.setTimeout(240_000);
    const me = state.fresh[info.project.name];

    // 1. Identify
    await identify(page, me.email);
    await expect(page.getByTestId("contact-name")).toHaveText(me.name);
    await expect(page.getByTestId("contact-property")).toContainText(me.property);
    await expect(page.getByTestId("already-responded")).toHaveCount(0);
    await page.getByTestId("start-survey").click();

    // 2. Answer: Likert value cycles 1..5 so every scale point is exercised; free text per question.
    const expected = new Map<number, number>();
    for (const [i, q] of likertQs().entries()) {
      const v = (i % 5) + 1;
      expected.set(q.question_id, v);
      await answer(page, q, v);
    }
    await expect(page.getByTestId("progress-count")).toHaveText(`${likertQs().length} / ${likertQs().length}`);
    const marker = `[e2e ${info.project.name} ${Date.now()}]`;
    for (const q of textQs()) {
      await page.getByLabel(q.question_text).fill(`${marker} The HVAC in our unit runs too warm in the afternoons.`);
    }

    // 3. Submit → thank-you page
    await page.getByTestId("submit-survey").click();
    await expect(page).toHaveURL(/\/thank-you\?/, { timeout: 30_000 });
    await expect(page.getByTestId("thank-you-title")).toHaveText(`Thank you, ${me.name.split(" ")[0]}!`);
    const responseId = (await page.getByTestId("response-ref").textContent())!.trim();
    expect(responseId).toMatch(/^[0-9a-f-]{36}$/);

    // 4. Same contact again → already-responded notice
    await identify(page, me.email);
    await expect(page.getByTestId("already-responded")).toBeVisible();

    if (state.mock) return;

    // 5. Lakebase: one response row + one answer per Likert statement and per free-text question
    const db = await pg();
    try {
      const r = await db.query(
        `SELECT campaign_id, contact_id, contact_email, property_id FROM survey.survey_responses WHERE response_id = $1`,
        [responseId],
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toMatchObject({ campaign_id: state.campaign, contact_id: me.contact_id, contact_email: me.email.toLowerCase() });
      const a = await db.query(
        `SELECT question_id, likert_value, text_value FROM survey.survey_answers WHERE response_id = $1 ORDER BY question_id`,
        [responseId],
      );
      expect(a.rows).toHaveLength(likertQs().length + textQs().length);
      for (const row of a.rows) {
        if (expected.has(row.question_id)) expect(row.likert_value).toBe(expected.get(row.question_id));
        else expect(row.text_value).toContain(marker);
      }

      // 6. Delta (Lakehouse Sync, seconds of latency): the response appears in ref_survey_responses.
      //    Skipped (with an annotation) only while the sync's current-state view doesn't exist yet.
      const synced = await sql(`SHOW TABLES IN ${fq("x").replace(/\.x$/, "")} LIKE 'ref_survey_responses'`);
      if (synced.length === 0) {
        info.annotations.push({ type: "warning", description: "ref_survey_responses does not exist yet: Delta check skipped" });
        return;
      }
      await expect
        .poll(
          async () =>
            (await sql(`SELECT count(*) AS n FROM ${fq("ref_survey_responses")} WHERE response_id = :id`, { id: responseId }))[0].n,
          { timeout: 180_000, intervals: [5_000] },
        )
        .toBe("1");
      const answersInDelta = await sql(`SELECT count(*) AS n FROM ${fq("ref_survey_answers")} WHERE response_id = :id`, { id: responseId });
      expect(Number(answersInDelta[0].n)).toBe(likertQs().length + textQs().length);
    } finally {
      // 7. Clean up so the seeded numbers (dashboard, Genie) are unchanged
      await db.query(`DELETE FROM survey.survey_responses WHERE response_id = $1`, [responseId]);
      await db.end();
    }
  });
});
