import { defineConfig } from "@playwright/test";

// Isolated harness proving e2e/support/test.ts's browserDiagnostics fixture
// actually fails a test on a real pageerror/5xx (see
// e2e/support/diagnostics-selftest.test.mjs, which runs this config as a
// subprocess and asserts on its JSON report). No webServer/globalSetup: every
// spec here is fully synthetic (page.setContent/page.route), so it needs
// neither the app build nor the disposable Postgres fixtures the real e2e/
// suite requires. Two of its three specs are *designed to fail* -- explicit
// testMatch (not testDir sweep) keeps this config, and only this config,
// aware of them; playwright.e2e.config.ts never collects them since its
// default testMatch requires ".spec."/".test." in the filename, which this
// file deliberately avoids.
//
// Chromium runs every spec. Firefox and WebKit run the one group whose rule
// depends on the engine: the cancelled Auth.js provider logo, which each
// engine words its own way (ABORTED_ERROR_TEXTS in e2e/support/test.ts). The
// other specs assert Chromium's console wording and stay Chromium-only.
const ENGINE_SPECIFIC = /Auth\.js provider logo rule/;

export default defineConfig({
  testDir: "./e2e/support/synthetic",
  testMatch: /diagnostics-negative-control\.ts$/,
  outputDir: "test-results/diagnostics-selftest/artifacts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10_000,
  reporter: [["list"], ["json", { outputFile: "test-results/diagnostics-selftest/results.json" }]],
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", grep: ENGINE_SPECIFIC, use: { browserName: "firefox" } },
    { name: "webkit", grep: ENGINE_SPECIFIC, use: { browserName: "webkit" } },
  ],
});
