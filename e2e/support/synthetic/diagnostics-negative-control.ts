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

  // Regression coverage for a real codex review finding on the fix above:
  // the first version of the /i/ 404 suppression used a bare counter
  // (incremented on any qualifying response, decremented on any matching
  // console text) with no notion of *which* 404 it was for. Firing an /i/
  // 404 and an unrelated 404 concurrently (not sequentially -- so their
  // response/console events can interleave in either order) is the
  // sharpest black-box test available here: a counter-based fix could pass
  // a purely sequential test by coincidence (each pair resolves before the
  // next starts), but must not be trusted to survive real-world overlap
  // (e.g. two resources 404ing around the same time on a real invoice
  // page). The unrelated 404 must still surface as a real diagnostic --
  // this test is expected to fail, same as "does not suppress a 404
  // console error outside /i/ paths" above.
  test("does not suppress an unrelated 404 fired concurrently with a suppressed /i/ 404", async ({ page }) => {
    await page.route("https://example.invalid/i/synthetic-concurrent-token", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "synthetic-i-404-concurrent-selftest" }),
    );
    await page.route("https://example.invalid/deal/synthetic-concurrent-404", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "synthetic-404-concurrent-selftest" }),
    );
    await page.setContent("<html></html>");
    await page.evaluate(() =>
      Promise.all([
        fetch("https://example.invalid/i/synthetic-concurrent-token").catch(() => {}),
        fetch("https://example.invalid/deal/synthetic-concurrent-404").catch(() => {}),
      ]),
    );
  });
});
