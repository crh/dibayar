// Negative control for e2e/support/test.ts's `browserDiagnostics` fixture
// (E2E-IMPROVEMENT-PLAN.md Workstream D). Proves the fixture still turns a
// deliberate pageerror/5xx into a failing test, using only page.setContent
// and page.route -- no application code, no build, no database. Deliberately
// named without ".spec."/".test." so playwright.e2e.config.ts's default
// testMatch (testDir "./e2e") never sweeps it up; only
// playwright.diagnostics-selftest.config.ts's explicit testMatch runs it,
// driven by e2e/support/diagnostics-selftest.test.mjs via a subprocess so a
// permanently-failing spec never lands in the normal suite's pass/fail count.
import { test, expect } from "../test";

test.describe("browserDiagnostics negative control (synthetic, no application code)", () => {
  test("fails a test on a deliberate unhandled page error", async ({ page }) => {
    await page.setContent(`<script>throw new Error("synthetic-pageerror-selftest");</script>`);
  });

  test("fails a test on a deliberate 5xx response", async ({ page }) => {
    await page.route("https://example.invalid/synthetic-500", (route) =>
      route.fulfill({ status: 500, contentType: "text/plain", body: "synthetic-500-selftest" }),
    );
    await page.setContent("<html></html>");
    await page.evaluate(() => fetch("https://example.invalid/synthetic-500").catch(() => {}));
  });

  test("does not fail a clean test (control)", async ({ page }) => {
    await page.setContent("<html><body>clean</body></html>");
    await expect(page.locator("body")).toHaveText("clean");
  });
});
