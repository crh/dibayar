import { test as base, expect, type ConsoleMessage } from "@playwright/test";

type BrowserDiagnostics = {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  serverErrors: string[];
};

// Opt-in for a test that deliberately triggers a 4xx response and needs the
// browser's own "Failed to load resource" console log for it not to count
// as an unexplained failure -- e.g. a server-validation or ownership-denial
// journey. Unlike the /i/ 404 case below (a cross-cutting property of one
// route that every test hitting it would trigger), this is inherently
// test-specific: only the one test that deliberately sends bad data
// expects it, so it's a per-test opt-in via `test.use(...)`, not baked into
// this shared fixture's always-on behavior. Match narrowly (method +
// pathname), same reasoning as the /i/ case: a 4xx anywhere else stays a
// real, actionable diagnostic.
type ExpectedErrorResponse = { method: string; pathname: string };

// How each engine reports a request it cancelled itself: Chromium, Firefox,
// WebKit.
const ABORTED_ERROR_TEXTS = new Set(["net::ERR_ABORTED", "NS_BINDING_ABORTED", "Load request cancelled"]);

function errorMessage(error: Error): string {
  return error.stack ?? error.message;
}

// Every journey test gets a lightweight browser-health guard. It deliberately
// records only actionable failures: page exceptions, console errors, failed
// network requests, and HTTP 5xx responses. Expected 4xx flows (invalid tokens,
// auth redirects, and validation responses) remain testable without an
// allowlist that could accidentally hide application failures.
export const test = base.extend<{
  browserDiagnostics: BrowserDiagnostics;
  expectedErrorResponses: ExpectedErrorResponse[];
}>({
  expectedErrorResponses: [[], { option: true }],
  browserDiagnostics: [
    async ({ page, expectedErrorResponses }, useFixture, testInfo) => {
      const diagnostics: BrowserDiagnostics = {
        pageErrors: [],
        consoleErrors: [],
        failedRequests: [],
        serverErrors: [],
      };

      const onPageError = (error: Error) => {
        // WebKit surfaces Next.js App Router's own cancelled RSC-prefetch
        // fetches (aborted via AbortController when a second navigation
        // supersedes an in-flight prefetch -- see onRequestFailed's `_rsc`
        // handling below) as an uncaught "Fetch API cannot load ... due to
        // access control checks" TypeError instead of a caught AbortError.
        // A WebKit-only quirk in how it reports fetch() aborts, not an app
        // defect: reproduced via repeated local WebKit runs, always for a
        // `_rsc`-tagged prefetch URL, never a real application request.
        // Chromium/Firefox don't raise this as a pageerror at all.
        //
        // `error.message` alone is unreliable here -- confirmed empirically
        // it's sometimes missing its own "Fetch API cannot load http:"
        // prefix (a WebKit/Playwright serialization quirk), while
        // `error.stack` (what errorMessage() below actually returns)
        // consistently carries the full text followed by a stack frame, so
        // match against that and don't anchor the end.
        const message = errorMessage(error);
        if (/^Fetch API cannot load https?:\/\/\S*[?&]_rsc=[^&\s]+ due to access control checks\./.test(message)) {
          return;
        }
        diagnostics.pageErrors.push(message);
      };
      // Both Chromium and WebKit log the expected document 404 used by the
      // invalid-token journey (e2e/public/invoice.spec.ts) as a console
      // error, but they disagree on *when*: Chromium's console event fires
      // after the page's own URL already reflects the failed navigation, so
      // gating on `message.page().url()` worked there. WebKit fires the
      // console event while the page is still on the previous
      // location/about:blank (confirmed empirically -- the response and
      // console events arrive in the same relative order in both engines,
      // only the page-URL bookkeeping lags in WebKit), so that gate silently
      // never matched and let the message through as an unexplained
      // failure.
      //
      // A first fix tracked the 404 via its own response event using a bare
      // counter -- but a counter has no notion of *which* 404 it's for: if a
      // qualifying /i/ 404 response ever occurred without producing this
      // exact console message (engine variance, timing), the counter would
      // stay positive and silently swallow the next unrelated resource that
      // happens to log the same generic text, on a completely different
      // page. message.text() alone never carries a URL, but
      // message.location().url does (confirmed empirically, both Chromium
      // and WebKit -- it's the failed resource's own URL), so key the
      // pairing on that instead: only ever suppress a console message whose
      // location matches a URL this fixture itself just saw a qualifying
      // response for. Generalized beyond the original 404-only case to
      // cover any status text a test opted into via expectedErrorResponses
      // (see its type comment above) -- same correlation mechanism, same
      // narrowness guarantee.
      const pendingExpectedResponseUrls = new Map<string, number>();
      const onConsole = (message: ConsoleMessage) => {
        if (message.type() === "error") {
          if (/^Failed to load resource: the server responded with a status of \d+ \(.+\)$/.test(message.text())) {
            const url = message.location().url;
            const pending = pendingExpectedResponseUrls.get(url) ?? 0;
            if (pending > 0) {
              pendingExpectedResponseUrls.set(url, pending - 1);
              return;
            }
          }
          diagnostics.consoleErrors.push(message.text());
        }
      };
      const onRequestFailed = (request: { url(): string; failure(): { errorText?: string } | null }) => {
        const failure = request.failure();
        const url = new URL(request.url());
        const errorText = failure?.errorText ?? "";
        // Next App Router cancels superseded RSC navigations by design when a
        // second history/router update wins the race. These requests carry
        // the internal `_rsc` query marker; keep all other failed requests
        // visible to the test guard. Each engine reports the cancellation
        // with its own errorText: Chromium "net::ERR_ABORTED", Firefox
        // "NS_BINDING_ABORTED", WebKit "Load request cancelled" (all three
        // confirmed via repeated local e2e-cross-browser Firefox+WebKit
        // runs surfacing this exact race under load).
        if (ABORTED_ERROR_TEXTS.has(errorText) && url.searchParams.has("_rsc")) return;
        // A link whose response is a file (Content-Disposition: attachment,
        // e.g. Unduh PDF) starts as a navigation that the browser then turns
        // into a download, and reports the navigation request as aborted.
        // Those are set aside here and dropped at teardown only if this page
        // really did get a download for that exact URL (the two events are
        // not ordered); anything else is still reported.
        const entry = `${request.url()}${errorText ? ` — ${errorText}` : ""}`;
        if (ABORTED_ERROR_TEXTS.has(errorText)) abortedRequests.push({ url: request.url(), entry });
        else diagnostics.failedRequests.push(entry);
      };
      const abortedRequests: Array<{ url: string; entry: string }> = [];
      const downloadedUrls = new Set<string>();
      const onDownload = (download: { url(): string }) => {
        downloadedUrls.add(download.url());
      };
      const onResponse = (response: { status(): number; url(): string; request(): { method(): string } }) => {
        if (response.status() >= 500) diagnostics.serverErrors.push(`${response.status()} ${response.url()}`);
        if (response.status() < 400 || response.status() >= 500) return;

        const url = new URL(response.url());
        // The invalid-token journey's own 404 -- see the onConsole comment
        // above. Only /i/ paths qualify: a 404 anywhere else in the app
        // stays a real, actionable diagnostic.
        const isPublicInvalidTokenNotFound = response.status() === 404 && url.pathname.startsWith("/i/");
        const isOptedIn = expectedErrorResponses.some(
          (expected) => expected.method === response.request().method() && expected.pathname === url.pathname,
        );
        // Keyed by the exact URL, not just counted, so a pending entry for
        // one URL can never be consumed by a console message about a
        // different one.
        if (isPublicInvalidTokenNotFound || isOptedIn) {
          pendingExpectedResponseUrls.set(response.url(), (pendingExpectedResponseUrls.get(response.url()) ?? 0) + 1);
        }
      };

      page.on("pageerror", onPageError);
      page.on("console", onConsole);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);
      page.on("download", onDownload);

      try {
        await useFixture(diagnostics);
      } finally {
        page.off("pageerror", onPageError);
        page.off("console", onConsole);
        page.off("requestfailed", onRequestFailed);
        page.off("response", onResponse);
        page.off("download", onDownload);
        for (const aborted of abortedRequests) {
          if (!downloadedUrls.has(aborted.url)) diagnostics.failedRequests.push(aborted.entry);
        }

        const hasDiagnostics = Object.values(diagnostics).some((entries) => entries.length > 0);
        if (hasDiagnostics) {
          await testInfo.attach("browser-diagnostics", {
            body: JSON.stringify(diagnostics, null, 2),
            contentType: "application/json",
          });
        }

        if (testInfo.status === "passed" && hasDiagnostics) {
          throw new Error(`Unexpected browser diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`);
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
