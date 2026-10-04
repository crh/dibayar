import { defineConfig, devices } from "@playwright/test";
import { E2E_OWNER_SESSION_TOKEN } from "./e2e/support/fixture-ids";

// Journey/E2E layer for real user flows -- URL, App Router navigation,
// History API, auth, cross-component interaction. Deliberately separate
// from playwright.config.ts (the tests/ux-audit/ visual+detector harness):
// different testDir, different port, different purpose. See
// docs/testing/E2E.md for the full architecture writeup.
const port = Number(process.env.E2E_PORT ?? 3300);
// localhost, not 127.0.0.1, matching playwright.config.ts (tests/ux-audit):
// Auth.js's built-in sign-out page renders its form action against
// "localhost" regardless of which loopback hostname served the request, and
// the app's CSP is `form-action 'self' ...` -- browsers treat 127.0.0.1 and
// localhost as different origins, so serving this suite from 127.0.0.1 made
// the CSP correctly block sign-out's own POST (verified: switching to
// localhost fixes it, with no application code involved).
const baseURL = `http://localhost:${port}`;
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === "1";

// A real Auth.js database-session cookie (see e2e/support/auth.ts for the
// security boundary). Applied at the project level so every test starts
// already authenticated as the seeded fixture owner; tests that need an
// unauthenticated context override with `test.use({ storageState: { cookies:
// [], origins: [] } })`.
const authenticatedStorageState = {
  cookies: [
    {
      name: "authjs.session-token",
      value: E2E_OWNER_SESSION_TOKEN,
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

export default defineConfig({
  testDir: "./e2e",
  // Only Playwright specs. The default testMatch also matches *.test.mjs,
  // which made every run and every --list import
  // e2e/support/diagnostics-selftest.test.mjs -- a node:test file that
  // spawns its own nested Playwright run (CI runs it separately via
  // `npm run test:diagnostics-selftest`).
  testMatch: /\.spec\.ts$/,
  outputDir: "test-results/e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // The deal-navigation matrix depends on shared, mutating fixture rows
  // (stage moves, invoice creation) -- keep runs deterministic before this
  // suite has proven itself flake-free under parallelism.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // The json reporter feeds scripts/ux-report.ts's "Visual Regression
  // status" section (see docs/testing/UX_AUDIT.md) when this config is run
  // with --grep @visual; it's additive and doesn't change any existing
  // list/html reporting.
  reporter: [["list"], ["html", { outputFolder: "playwright-report/e2e", open: "never" }], ["json", { outputFile: "test-results/e2e/results.json" }]],
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    storageState: authenticatedStorageState,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // --- Critical PR-gate tier: Chromium only, desktop + mobile viewport ---
    {
      // Playwright-managed Chromium (devices["Desktop Chrome"]'s own
      // defaultBrowserType), not the "chrome" channel -- that resolved to
      // whatever system Google Chrome happened to be on the runner/host,
      // which drifts as Chrome auto-updates and isn't reproducible for
      // visual-regression baselines. See docs/testing/E2E.md "Browser
      // strategy".
      name: "chromium",
      grepInvert: /@visual-mobile/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      // 390px is Dibayar's primary mobile target (see CLAUDE.md/DESIGN.md).
      // Built manually rather than spreading devices["iPhone 12"]/["Pixel 5"]:
      // Playwright's mobile device presets pin a specific browser engine
      // (iPhone 12 -> WebKit) or a different viewport, and this project must
      // stay on Chromium at exactly the 390px target width.
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
    },
    {
      name: "chromium-mobile-visual",
      grep: /@visual-mobile/,
      // The visual tier gets one true mobile baseline: mobile emulation,
      // touch input, and the same 390px target as semantic mobile journeys.
      // Keeping its grep narrow avoids duplicating every desktop snapshot.
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
    },
    // --- Broader release/nightly tier: run explicitly via --project ---
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        // next start auto-loads .env.local itself, same as next build/dev.
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
