// Negative control for e2e/support/test.ts's `browserDiagnostics` fixture
// (E2E-IMPROVEMENT-PLAN.md Workstream D). Proves the fixture still turns a
// deliberate pageerror/5xx into a failing test, using only page.setContent
// and page.route -- no application code, no build, no database. Deliberately
// named without ".spec."/".test." so playwright.e2e.config.ts's default
// testMatch (testDir "./e2e") never sweeps it up; only
// playwright.diagnostics-selftest.config.ts's explicit testMatch runs it,
// driven by e2e/support/diagnostics-selftest.test.mjs via a subprocess so a
// permanently-failing spec never lands in the normal suite's pass/fail count.
import type { Page } from "@playwright/test";
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

  // Regression coverage for expectedErrorResponses (see its type comment in
  // ../test.ts): a test-level opt-in for a deliberately-triggered 4xx, used
  // by e2e/deals/deal-crud.spec.ts's server-validation journey. Proves both
  // directions: without opting in, a deliberate 400 still fails the guard
  // (same as any unexplained error); with a matching opt-in, it's
  // suppressed.
  test("fails a test on a deliberate 400 that was not opted into expectedErrorResponses", async ({ page }) => {
    await page.route("https://example.invalid/synthetic-400-no-optin", (route) =>
      route.fulfill({ status: 400, contentType: "text/plain", body: "synthetic-400-no-optin-selftest" }),
    );
    await page.setContent("<html></html>");
    await page.evaluate(() => fetch("https://example.invalid/synthetic-400-no-optin").catch(() => {}));
  });

  test.describe("with expectedErrorResponses opted in", () => {
    test.use({
      expectedErrorResponses: [{ method: "GET", pathname: "/synthetic-400-opted-in" }],
    });

    test("suppresses a deliberate 400 matching expectedErrorResponses (control)", async ({ page }) => {
      await page.route("https://example.invalid/synthetic-400-opted-in", (route) =>
        route.fulfill({ status: 400, contentType: "text/plain", body: "synthetic-400-opted-in-selftest" }),
      );
      await page.setContent("<html></html>");
      await page.evaluate(() => fetch("https://example.invalid/synthetic-400-opted-in").catch(() => {}));
    });
  });
  // Regression coverage for the `status` form of expectedErrorResponses (the
  // only way to expect a 5xx; see ../test.ts). All three directions: the
  // named 500 is suppressed; a 5xx on an address opted in without a status
  // still fails; and a different 5xx on the opted-in address still fails.
  test.describe("with expectedErrorResponses naming a 500", () => {
    test.use({ expectedErrorResponses: [{ method: "GET", pathname: "/synthetic-500-opted-in", status: 500 }] });

    test("suppresses a deliberate 500 matching an expectedErrorResponses status (control)", async ({ page }) => {
      await page.route("https://example.invalid/synthetic-500-opted-in", (route) =>
        route.fulfill({ status: 500, contentType: "text/plain", body: "synthetic-500-opted-in-selftest" }),
      );
      await page.setContent("<html></html>");
      await page.evaluate(() => fetch("https://example.invalid/synthetic-500-opted-in").catch(() => {}));
    });

    test("fails a test on a 503 at an address opted in for a 500", async ({ page }) => {
      await page.route("https://example.invalid/synthetic-500-opted-in", (route) =>
        route.fulfill({ status: 503, contentType: "text/plain", body: "synthetic-503-selftest" }),
      );
      await page.setContent("<html></html>");
      await page.evaluate(() => fetch("https://example.invalid/synthetic-500-opted-in").catch(() => {}));
    });
  });
  // (A describe of its own: Playwright reads a two-element array option as
  // its [value, options] form, so each test.use here lists one entry.)
  test.describe("with expectedErrorResponses naming no status", () => {
    test.use({ expectedErrorResponses: [{ method: "GET", pathname: "/synthetic-500-statusless-optin" }] });

    test("fails a test on a 500 at an address opted in without a status", async ({ page }) => {
      await page.route("https://example.invalid/synthetic-500-statusless-optin", (route) =>
        route.fulfill({ status: 500, contentType: "text/plain", body: "synthetic-500-statusless-selftest" }),
      );
      await page.setContent("<html></html>");
      await page.evaluate(() => fetch("https://example.invalid/synthetic-500-statusless-optin").catch(() => {}));
    });
  });

  // Regression coverage for the Auth.js provider-logo rule (PR #46, see
  // onRequestFailed in ../test.ts): only a logo request the browser itself
  // cancelled is dropped. The same logo failing any other way, answering
  // 5xx, or a cancelled request to anything else on that host, still fails.
  //
  // This describe runs in Chromium, Firefox and WebKit (the projects in
  // playwright.diagnostics-selftest.config.ts), because the rule exists for
  // Firefox and WebKit and each engine words a cancellation its own way. The
  // cancellation is produced the way each engine really produces it, and its
  // wording is asserted, so removing one engine's wording from
  // ABORTED_ERROR_TEXTS fails the control in that engine.
  test.describe("Auth.js provider logo rule", () => {
    const LOGO = "https://authjs.dev/img/providers/google.svg";
    // What each engine reports for a request it cancelled itself.
    const CANCELLED: Record<string, string> = {
      chromium: "net::ERR_ABORTED",
      firefox: "NS_BINDING_ABORTED",
      webkit: "Load request cancelled",
    };

    const requestImage = (page: Page, url: string) =>
      page.evaluate((src) => {
        const image = new Image();
        image.src = src;
        document.body.append(image);
      }, url);

    // Requests `url` as an image, lets it fail the way `route` makes it fail,
    // and returns the engine's error text once the failure has been reported
    // (so the guard has seen it before the test ends). Not the image's own
    // onerror: WebKit never fires it for a request Playwright aborted.
    async function failImage(page: Page, url: string, errorCode: string): Promise<string> {
      await page.route(url, (route) => route.abort(errorCode));
      await page.setContent("<html><body></body></html>");
      const failed = page.waitForEvent("requestfailed", (request) => request.url() === url);
      await requestImage(page, url);
      return (await failed).failure()?.errorText ?? "";
    }

    // Has the browser cancel a pending image request for `url`, and returns
    // the error text it reported.
    //
    // Firefox and WebKit: the real case. A page showing the image is left
    // for another page while the image is still loading, as a journey does
    // when it lands on Auth.js's sign-in page and moves on.
    //
    // Chromium reports nothing at all for an image dropped that way (measured
    // locally, and why the sign-in journeys only ever failed in Firefox and
    // WebKit), so there its net::ERR_ABORTED comes from aborting the routed
    // request. That route is no use in the other two: an aborted route is
    // reported as NS_ERROR_ABORT by Firefox and "Blocked by Web Inspector" by
    // WebKit, neither of which is what the rule is about.
    async function cancelImage(page: Page, browserName: string, url: string): Promise<string> {
      if (browserName === "chromium") return failImage(page, url, "aborted");

      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      await page.route(url, async (route) => {
        await held;
        await route.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }).catch(() => {});
      });
      await page.route("https://pages.invalid/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: route.request().url().endsWith("/with-image")
            ? `<html><body><img src="${url}" alt=""></body></html>`
            : "<html><body>next page</body></html>",
        }),
      );
      const requested = page.waitForRequest(url);
      await page.goto("https://pages.invalid/with-image", { waitUntil: "commit" });
      await requested;
      const failed = page.waitForEvent("requestfailed", (request) => request.url() === url);
      await page.goto("https://pages.invalid/next");
      const errorText = (await failed).failure()?.errorText ?? "";
      release();
      return errorText;
    }

    test("suppresses a cancelled Auth.js provider logo (control)", async ({ page, browserName }) => {
      expect(await cancelImage(page, browserName, LOGO)).toBe(CANCELLED[browserName]);
    });

    test("fails a test on an Auth.js provider logo that fails without being cancelled", async ({ page }) => {
      await failImage(page, LOGO, "connectionrefused");
    });

    test("fails a test on an Auth.js provider logo answered with a 5xx", async ({ page }) => {
      await page.route(LOGO, (route) =>
        route.fulfill({ status: 503, contentType: "text/plain", body: "synthetic-logo-503-selftest" }),
      );
      await page.setContent("<html><body></body></html>");
      const answered = page.waitForResponse(LOGO);
      await requestImage(page, LOGO);
      await answered;
    });

    test("fails a test on a cancelled authjs.dev request that is not a provider logo", async ({ page, browserName }) => {
      const url = "https://authjs.dev/img/synthetic-not-a-provider-logo.svg";
      expect(await cancelImage(page, browserName, url)).toBe(CANCELLED[browserName]);
    });

    test("fails a test on a cancelled provider-logo path on another host", async ({ page, browserName }) => {
      const url = "https://example.invalid/img/providers/google.svg";
      expect(await cancelImage(page, browserName, url)).toBe(CANCELLED[browserName]);
    });
  });
});
