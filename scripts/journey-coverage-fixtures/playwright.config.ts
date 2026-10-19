// Synthetic Playwright project for scripts/journey-coverage.test.mjs only:
// the negative controls run the real journey-coverage discovery (and a real
// Playwright run) against these specs. No test here uses `page`, so no
// browser, build, server, or database is involved. Not part of any app
// suite: playwright.e2e.config.ts and playwright.config.ts never reach this
// directory.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /\.spec\.ts$/,
  outputDir: "../../test-results/journey-coverage-fixtures",
  workers: 1,
  retries: 0,
  reporter: "list",
  projects: [
    { name: "desktop", use: { browserName: "chromium", isMobile: false } },
    { name: "mobile", use: { browserName: "chromium", isMobile: true } },
  ],
});
