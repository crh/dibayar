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

  // Regression coverage for the WebKit cross-browser finding (see
  // e2e/support/test.ts's onConsole/onResponse comments): the fixture must
  // suppress the expected /i/ not-found console message only when it's
  // actually paired with a real 404 response to an /i/ path, and must never
  // suppress a 404 anywhere else in the app.
  test("does not suppress a 404 console error outside /i/ paths", async ({ page }) => {
    await page.route("https://example.invalid/deal/synthetic-404", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "synthetic-404-selftest" }),
    );
    await page.setContent("<html></html>");
    await page.evaluate(() => fetch("https://example.invalid/deal/synthetic-404").catch(() => {}));
  });

  test("suppresses only the matched /i/ 404 console error (control)", async ({ page }) => {
    await page.route("https://example.invalid/i/synthetic-invalid-token", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "synthetic-i-404-selftest" }),
    );
    await page.setContent("<html></html>");
    await page.evaluate(() => fetch("https://example.invalid/i/synthetic-invalid-token").catch(() => {}));
  });
});
