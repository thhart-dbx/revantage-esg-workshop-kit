import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { CORRECTIONS, INVOICES, restore, snapshot, sql, type Snapshot } from "./db";

// CUJ (UJ2, M6): a QA/QC reviewer works the invoice queue: open queue → open an invoice that needs
// QA → fix a field beside the PDF → save → the extracted row is Corrected and a corrections row
// exists. Also approve-as-is, reject, and server-side validation.
//
// Stateful tests run serially on the desktop project only, on one Pending invoice, and restore it
// afterwards (row values + qa_status/reviewed_*, and delete the corrections rows marked [e2e]), so
// they are repeatable and don't pollute the QA errors dashboard.
// Locally the signed-in user is simulated with x-forwarded-email (set in production by the
// Databricks Apps proxy from the user's login).

const LOCAL = !process.env.BASE_URL;
const TEST_USER = "playwright@revantage.example";
const MARK = "[e2e]";

type Row = { invoice_id: string; qa_status: string; received_date: string; flags: { key: string }[]; invoice_number: string | null };

async function meta(request: APIRequestContext) {
  const r = await request.get("/api/meta", { headers: LOCAL ? { "x-forwarded-email": TEST_USER } : {} });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()) as { mode: "mock" | "sql"; user: string };
}

async function asUser(page: Page) {
  if (LOCAL) await page.setExtraHTTPHeaders({ "x-forwarded-email": TEST_USER });
}

test.describe("queue (read-only)", () => {
  test("queue lists Pending invoices with QA flags and filters narrow it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Invoice QA queue" })).toBeVisible();
    const rows = page.getByTestId("queue-row");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const pending = await rows.count();
    expect(pending).toBeGreaterThan(0);
    // Default view = work queue: every row Pending (status column hidden on narrow screens)
    if ((page.viewportSize()?.width ?? 0) >= 640)
      for (const s of await page.getByTestId("status-badge").allTextContents()) expect(s.trim()).toBe("Pending");
    await expect(page.locator("[data-flag]").first()).toBeVisible();

    // Flagged only ⊆ pending
    await page.getByLabel("Flags").selectOption("1");
    await expect(page).toHaveURL(/flagged=1/);
    await expect(page.getByTestId("row-count")).toBeVisible();
    const flagged = await rows.count();
    expect(flagged).toBeLessThanOrEqual(pending);
    expect(flagged).toBeGreaterThan(0);

    // All statuses ⊇ pending
    await page.getByLabel("Flags").selectOption("");
    await expect(page).not.toHaveURL(/flagged=1/);
    await page.getByLabel("Status").selectOption("all");
    await expect(page).toHaveURL(/status=all/);
    await expect.poll(async () => rows.count()).toBeGreaterThanOrEqual(pending);
  });

  test("utility filter returns only that utility (API)", async ({ request }) => {
    const r = await request.get("/api/invoices?utility=electricity");
    const { invoices } = await r.json();
    expect(invoices.length).toBeGreaterThan(0);
    for (const i of invoices) expect(i.utility_type).toBe("electricity");
    const none = await (await request.get("/api/invoices?from=2099-01-01")).json();
    expect(none.invoices).toEqual([]);
  });

  test("unknown invoice → 404 (page + PDF route)", async ({ page, request }) => {
    expect((await request.get("/api/invoices/does-not-exist/pdf")).status()).toBe(404);
    await page.goto("/invoices/does-not-exist");
    await expect(page.getByRole("alert").filter({ hasText: "not found" })).toBeVisible();
  });
});

test.describe("review and write-back", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "stateful: desktop project only"));

  let mode: "mock" | "sql";
  let user: string;
  let target: Row;
  let snap: Snapshot | undefined;

  // beforeAll/afterEach run even for skipped tests: only the desktop project touches state, so two
  // projects never write (or restore) the same row at the same time.
  test.beforeAll(async ({ request }, info) => {
    if (info.project.name !== "desktop") return;
    ({ mode, user } = await meta(request));
    const { invoices } = (await (await request.get("/api/invoices?status=Pending")).json()) as { invoices: Row[] };
    // A Pending invoice that needs QA (flagged), received after the seeded history window.
    const recent = invoices.filter((i) => i.received_date >= "2026-10-21");
    target = recent.find((i) => i.flags.length > 0) ?? recent[0] ?? invoices[0];
    expect(target, "need at least one Pending invoice").toBeTruthy();
    if (mode === "sql") snap = await snapshot(target.invoice_id);
  });

  test.afterEach(async ({ request }, info) => {
    if (info.project.name !== "desktop") return;
    if (mode === "sql" && snap) await restore(target.invoice_id, snap);
    if (mode === "mock") await request.post("/api/mock/reset");
  });

  test("open a flagged invoice from the queue, fix a field, save → Corrected + corrections row", async ({ page }) => {
    await asUser(page);
    await page.goto("/");
    await page.locator(`[data-testid="queue-row"][data-invoice-id="${target.invoice_id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${target.invoice_id}$`));
    await expect(page.getByText("Extracted fields")).toBeVisible();
    await expect(page.getByTestId("flag-panel")).toBeVisible();

    // The document is streamed from the volume through the API route
    const doc = await page.request.get(`/api/invoices/${target.invoice_id}/pdf`);
    expect(doc.status()).toBe(200);
    expect(doc.headers()["content-type"]).toMatch(/application\/pdf|image\//);
    await expect(page.getByTestId("pdf-frame")).toBeVisible();

    const newNumber = `E2E-${Date.now()}`;
    await page.getByLabel("Invoice number", { exact: true }).fill(newNumber);
    const change = page.getByTestId("change-invoice_number");
    await expect(change).toBeVisible();
    await expect(page.getByTestId("approve")).toBeDisabled();
    await change.getByLabel("Error type for Invoice number").selectOption("wrong_value");
    await change.getByLabel("Comment for Invoice number").fill(`${MARK} digit misread`);
    await page.getByTestId("save").click();

    await expect(page.getByRole("heading", { level: 1 }).getByTestId("status-badge")).toHaveText(/Corrected/, { timeout: 30_000 });
    const logged = page.locator('[data-testid="correction-row"][data-field="invoice_number"]').first();
    await expect(logged).toContainText(newNumber);
    await expect(logged).toContainText(user);

    if (mode === "sql") {
      const [row] = await sql<{ qa_status: string; invoice_number: string; reviewed_by: string; reviewed_at: string | null }>(
        `SELECT qa_status, invoice_number, reviewed_by, CAST(reviewed_at AS STRING) AS reviewed_at FROM ${INVOICES()} WHERE invoice_id = :id`,
        { id: target.invoice_id },
      );
      expect(row).toMatchObject({ qa_status: "Corrected", invoice_number: newNumber, reviewed_by: user });
      expect(row.reviewed_at).toBeTruthy();
      const corr = await sql<Record<string, string | null>>(
        `SELECT field_name, extracted_value, corrected_value, error_type, corrected_by, CAST(received_date AS STRING) AS received_date
         FROM ${CORRECTIONS()} WHERE invoice_id = :id AND comment LIKE '%[e2e]%'`,
        { id: target.invoice_id },
      );
      expect(corr).toHaveLength(1);
      expect(corr[0]).toMatchObject({
        field_name: "invoice_number",
        extracted_value: target.invoice_number,
        corrected_value: newNumber,
        error_type: "wrong_value",
        corrected_by: user,
        received_date: target.received_date,
      });
    }
  });

  test("approve without changes → Approved, no corrections row", async ({ page }) => {
    await asUser(page);
    await page.goto(`/invoices/${target.invoice_id}`);
    await expect(page.getByTestId("approve")).toBeEnabled();
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.getByTestId("approve").click();
    await expect(page.getByRole("heading", { level: 1 }).getByTestId("status-badge")).toHaveText(/Approved/, { timeout: 30_000 });
    if (mode === "sql") {
      const [row] = await sql<{ qa_status: string; reviewed_by: string }>(
        `SELECT qa_status, reviewed_by FROM ${INVOICES()} WHERE invoice_id = :id`,
        { id: target.invoice_id },
      );
      expect(row).toEqual({ qa_status: "Approved", reviewed_by: user });
    }
  });

  test("reject needs a reason, then → Rejected with a not_an_invoice correction", async ({ page }) => {
    await asUser(page);
    await page.goto(`/invoices/${target.invoice_id}`);
    await page.getByTestId("reject").click();
    await expect(page.getByTestId("confirm-reject")).toBeDisabled();
    await page.getByLabel("Comment", { exact: true }).fill(`${MARK} payment reminder, not an invoice`);
    await page.getByTestId("confirm-reject").click();
    await expect(page.getByRole("heading", { level: 1 }).getByTestId("status-badge")).toHaveText(/Rejected/, { timeout: 30_000 });
    await expect(page.locator('[data-testid="correction-row"][data-field="document"]').first()).toContainText("Not an invoice");
    if (mode === "sql") {
      const corr = await sql<{ error_type: string; corrected_value: string }>(
        `SELECT error_type, corrected_value FROM ${CORRECTIONS()} WHERE invoice_id = :id AND comment LIKE '%[e2e]%'`,
        { id: target.invoice_id },
      );
      expect(corr).toEqual([{ error_type: "not_an_invoice", corrected_value: "rejected" }]);
    }
  });

  test("server validates input and rejects no-op saves (no write)", async ({ request }) => {
    const url = `/api/invoices/${target.invoice_id}/review`;
    const headers: Record<string, string> = LOCAL ? { "x-forwarded-email": TEST_USER } : {};
    const bad = await request.post(url, { headers, data: { action: "save", changes: [{ field: "amount_total", value: "12,3x", error_type: "wrong_value", comment: MARK }] } });
    expect(bad.status()).toBe(400);
    const notEditable = await request.post(url, { headers, data: { action: "save", changes: [{ field: "qa_status", value: "Approved", error_type: "other" }] } });
    expect(notEditable.status()).toBe(400);
    const noop = await request.post(url, { headers, data: { action: "save", changes: [{ field: "invoice_number", value: target.invoice_number, error_type: "wrong_value" }] } });
    expect(noop.status()).toBe(400);
    expect((await noop.json()).error).toMatch(/No field changed/);
    const noReason = await request.post(url, { headers, data: { action: "reject", comment: " " } });
    expect(noReason.status()).toBe(400);
    const after = await (await request.get(`/api/invoices/${target.invoice_id}`)).json();
    expect(after.invoice.qa_status).toBe("Pending");
  });
});
