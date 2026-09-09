import { defineConfig } from "@playwright/test";

// UX Review Pack V2 (journey discovery + evidence capture) -- deliberately a
// third, separate Playwright config alongside playwright.config.ts
// (tests/ux-audit/, the curated route x state x viewport corpus + CI gate)
// and playwright.e2e.config.ts (e2e/, App Router/navigation journeys):
// different testDir, different port, and NOT wired into `npm run ux:audit`'s
// CI gate -- these are one-session evidence-capture journeys, not a
// permanent regression suite. See ux-review-pack/run-summary.md.
const port = Number(process.env.UX_REVIEW_PACK_PORT ?? 3400);
// localhost, not 127.0.0.1: matches playwright.config.ts's own reasoning
// (Auth.js sign-out's CSP `form-action 'self'` requires the serving origin
// to match what Auth.js renders the form action against).
const baseURL = `http://localhost:${port}`;
const skipWebServer = process.env.UX_REVIEW_PACK_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests/ux-review-pack",
  outputDir: "test-results/ux-review-pack",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/ux-review-pack/results.json" }]],
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    // Mobile-first default (Dibayar's primary 390px-class target, matching
    // tests/ux-audit's mobile375 band) -- individual journeys switch to the
    // desktop viewport explicitly via page.setViewportSize() where the
    // pasted spec's Phase 4 calls for a 1280 capture.
    viewport: { width: 375, height: 812 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
