import { test as base, expect, type ConsoleMessage } from "@playwright/test";

type BrowserDiagnostics = {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  serverErrors: string[];
};

function errorMessage(error: Error): string {
  return error.stack ?? error.message;
}

// Every journey test gets a lightweight browser-health guard. It deliberately
// records only actionable failures: page exceptions, console errors, failed
// network requests, and HTTP 5xx responses. Expected 4xx flows (invalid tokens,
// auth redirects, and validation responses) remain testable without an
// allowlist that could accidentally hide application failures.
export const test = base.extend<{ browserDiagnostics: BrowserDiagnostics }>({
  browserDiagnostics: [
    async ({ page }, useFixture, testInfo) => {
      const diagnostics: BrowserDiagnostics = {
        pageErrors: [],
        consoleErrors: [],
        failedRequests: [],
        serverErrors: [],
      };

      const onPageError = (error: Error) => {
        diagnostics.pageErrors.push(errorMessage(error));
      };
      const onConsole = (message: ConsoleMessage) => {
        if (message.type() === "error") {
          const pagePath = message.page() ? new URL(message.page()!.url()).pathname : "";
          // Chromium logs the expected document 404 used by the invalid-token
          // journey as a console error. The response status remains asserted
          // by that test; keep unrelated console errors actionable.
          if (
            message.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)"
            && pagePath.startsWith("/i/")
          ) return;
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
        // visible to the test guard.
        if (errorText === "net::ERR_ABORTED" && url.searchParams.has("_rsc")) return;
        diagnostics.failedRequests.push(`${request.url()}${errorText ? ` — ${errorText}` : ""}`);
      };
      const onResponse = (response: { status(): number; url(): string }) => {
        if (response.status() >= 500) diagnostics.serverErrors.push(`${response.status()} ${response.url()}`);
      };

      page.on("pageerror", onPageError);
      page.on("console", onConsole);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);

      try {
        await useFixture(diagnostics);
      } finally {
        page.off("pageerror", onPageError);
        page.off("console", onConsole);
        page.off("requestfailed", onRequestFailed);
        page.off("response", onResponse);

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
