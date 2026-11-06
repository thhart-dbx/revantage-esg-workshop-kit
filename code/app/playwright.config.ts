import { defineConfig, devices } from "@playwright/test";

// Click-path specs for each CUJ live in ./e2e. Runs against the local dev server by default.
// To test the deployed Databricks App, set BASE_URL to its URL and DATABRICKS_TOKEN to
// `databricks auth token` output; the token is sent as a bearer header.
export default defineConfig({
  testDir: "./e2e",
  // Picks test contacts (mock fixtures or real data) and removes test responses afterwards.
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    extraHTTPHeaders:
      process.env.BASE_URL && process.env.DATABRICKS_TOKEN
        ? { Authorization: `Bearer ${process.env.DATABRICKS_TOKEN}` }
        : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
