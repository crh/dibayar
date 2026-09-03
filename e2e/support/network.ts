// Regression guard for the T-27 "no unnecessary /deal RSC/server navigation"
// requirement (deal-client.tsx moves the stage filter with a raw
// window.history.pushState, precisely so a chip click never re-runs the
// server component's auth() + list queries -- see the long comment above
// handleStageFilterChange in src/app/(app)/deal/deal-client.tsx).
//
// Deliberately NOT keyed to Next.js's internal RSC request markers (the
// `_rsc` query param / `RSC`+`Next-Router-State-Tree` headers), which are
// unstable across Next versions. Instead this asserts the outcome that
// actually matters and is stable regardless of Next internals: a client-only
// filter change must produce **zero** network requests whose path touches
// `/deal` at all. A pure history.pushState causes no network traffic by
// definition, so any request matching `/deal` here is the failure signature.
import type { Page, Request } from "@playwright/test";

export type DealNavigationWatch = {
  /** Requests observed touching /deal while the watch was active. */
  requests: Request[];
  dispose: () => void;
};

export function watchForDealNavigationRequests(page: Page): DealNavigationWatch {
  const requests: Request[] = [];
  const onRequest = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname === "/deal" || url.pathname.startsWith("/deal/")) requests.push(request);
  };
  page.on("request", onRequest);
  return {
    requests,
    dispose: () => page.off("request", onRequest),
  };
}
