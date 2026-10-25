import { defineConfig } from "@playwright/test";

const port = Number(process.env.UX_PORT ?? 3100);
const skipWebServer = process.env.UX_SKIP_WEBSERVER === "1";
const baseURL = `http://localhost:${port}`;
// scripts/ux-fixtures.ts's four synthetic users; the audit runs with the
// pilot gate enforced, same as the E2E suite.
const uxPilotAllowedEmails = ["owner", "other", "zero", "quiet"].map((name) => `ux-t00-${name}@example.invalid`).join(",");

export default defineConfig({
  testDir: "./tests/ux-audit",
  outputDir: "test-results/ux-audit",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/ux-audit/results.json" }]],
  use: {
    baseURL,
    browserName: "chromium",
    // Playwright-managed Chromium, not a channel that resolves to whatever
    // system Google Chrome the runner/host happens to have installed --
    // see docs/testing/UX_AUDIT.md "Browser strategy" for why.
    headless: true,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        env: { ...process.env, PILOT_ACCESS_MODE: "allowlist", PILOT_ALLOWED_EMAILS: uxPilotAllowedEmails },
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
