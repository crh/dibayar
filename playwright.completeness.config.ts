// Completeness probe (docs/product/COMPLETENESS-AUDIT.md): records what a
// person can reach on each main screen, per browser setup, for a reviewer or
// an LLM explorer to compare with docs/product/capabilities.json.
//
// Non-blocking by design: no CI job runs it, and nothing in it is coverage
// for docs/testing/journey-coverage.json (its tests live outside that
// inventory's configs on purpose). Same server, fixtures and session as the
// E2E suite: it reuses playwright.e2e.config.ts and changes only where the
// tests are, where results go, and the browser setups.
import { defineConfig, devices } from "@playwright/test";
import e2e from "./playwright.e2e.config";

const projects = e2e.projects ?? [];

export default defineConfig({
  ...e2e,
  testDir: "./tests/completeness",
  outputDir: "test-results/completeness/artifacts",
  reporter: [["list"], ["json", { outputFile: "test-results/completeness/results.json" }]],
  projects: [
    ...projects.filter((project) => project.name === "chromium" || project.name === "chromium-mobile"),
    {
      // WebKit with phone emulation. Emulation, not an iPhone: native pickers
      // and Safari-only behaviour stay manual (docs/testing/MANUAL-UAT.md).
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
});
