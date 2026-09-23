// E2E-IMPROVEMENT-PLAN.md C3, the last of the five P2-4 residual journey
// gaps (docs/receipts/DIBAYAR-PR9-PR10-P24-ROUND-2026-09-22.md section F).
// Proves server-enforced ownership isolation between two genuinely different
// users, not just the absence of a UI affordance -- see
// e2e/support/fixture-ids.ts's E2E_OTHER_OWNER_SESSION_TOKEN comment for why
// a second session for the SAME owner (used elsewhere for sign-out) cannot
// prove this.
//
// Authorization contract, confirmed by reading the server code AND by
// probing the real running app (not assumed from the code alone -- see the
// receipt for this journey for the direct-curl/rendered-DOM verification
// that corrected the first draft of this file):
//
// - Every read/write in src/app/api/deals/[id]/route.ts and
//   src/app/api/invoices/[id]/route.ts is scoped with a single
//   `findFirst`/`update` `where: { id, userId }` clause keyed to the
//   authenticated session's own user ID (src/lib/deals.ts, src/lib/invoices.ts).
//   A row that exists but belongs to someone else is indistinguishable from
//   one that doesn't exist -- both cases return a uniform JSON 404, avoiding
//   resource-existence enumeration. Route Handlers can set that status
//   directly, so this is a real HTTP 404.
// - src/app/(app)/deal/[id]/page.tsx and .../invoice/[id]/page.tsx call the
//   same ownership-scoped lookup and call next/navigation's `notFound()` on
//   a miss. For a plain (non-Suspense) async Server Component under
//   `(app)/layout.tsx`, Next.js's RSC streaming model has already flushed
//   the 200 status and the authenticated app shell (TopBar, nav) by the time
//   the data check resolves -- confirmed via node_modules/next/dist/docs/
//   .../functions/not-found.md ("the response has already begun streaming
//   as a 200, and the status can't change once streaming has started") and
//   empirically (curl + a real rendered page: HTTP 200, containing the
//   `(app)` shell plus Next's default "404" / "This page could not be
//   found." UI, with none of the owner-A fields present anywhere in the
//   response). So page navigation is asserted on rendered content, not on
//   `response.status()` -- asserting 404 there would be hard-coding an
//   assumption the app doesn't actually make, exactly what this task's
//   instructions warn against.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { otherOwnerSessionCookie } from "../support/auth";
import { reseedFixtures } from "../support/reseed";

test.describe("cross-owner ownership denial", { tag: "@critical" }, () => {
  // The API-level PATCH attempts below are rejected before Prisma ever runs
  // an UPDATE (updateDeal/updateInvoiceDueDate both perform the
  // ownership-scoped read first and return early on a miss -- see the
  // header comment above), so no reseed is strictly required for
  // correctness. Reseeding anyway matches every other mutating file in this
  // suite (e2e/support/reseed.ts) and keeps this file safe by convention,
  // not by trusting that invariant to hold forever.
  test.beforeEach(reseedFixtures);

  test("a second authenticated user cannot view, read via API, or move the primary owner's deal", async ({ page, browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const ownedDealId = manifest.deals.masuk;
    const ownedBrand = manifest.brands[ownedDealId];

    const otherOwnerContext = await browser.newContext({
      storageState: { cookies: [otherOwnerSessionCookie(baseURL!)], origins: [] },
    });
    const otherOwnerPage = await otherOwnerContext.newPage();
    try {
      // Read: page navigation. Status stays 200 (see header comment); the
      // real assertion is that Next's generic not-found UI renders instead
      // of any of the primary owner's deal data.
      const pageResponse = await otherOwnerPage.goto(`/deal/${ownedDealId}`);
      expect(pageResponse?.status()).toBe(200);
      await expect(otherOwnerPage.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(otherOwnerPage.getByText("This page could not be found.")).toBeVisible();
      await expect(otherOwnerPage.getByText(ownedBrand, { exact: true })).toHaveCount(0);
      await expect(otherOwnerPage.getByText("Rp 1.000.000", { exact: true })).toHaveCount(0);
      await expect(otherOwnerPage.getByText("628110000001", { exact: true })).toHaveCount(0);

      // Read: the API route enforces the same boundary independently of the
      // page component, and (unlike the page) returns a real 404 status.
      const apiGetResponse = await otherOwnerPage.request.get(`/api/deals/${ownedDealId}`);
      expect(apiGetResponse.status()).toBe(404);
      expect(await apiGetResponse.json()).toEqual({ error: "Deal tidak ditemukan." });

      // Write: attempt the same real, owner-only action deal-crud.spec.ts
      // uses to prove the happy path (moving a deal to its next stage).
      const apiPatchResponse = await otherOwnerPage.request.patch(`/api/deals/${ownedDealId}`, {
        headers: { origin: baseURL! },
        data: { status: "NEGO" },
      });
      expect(apiPatchResponse.status()).toBe(404);
      expect(await apiPatchResponse.json()).toEqual({ error: "Deal tidak ditemukan." });
    } finally {
      await otherOwnerContext.close();
    }

    // The primary owner's own view proves the denied write never landed --
    // not merely that the response code looked right.
    await page.goto(`/deal/${ownedDealId}`);
    await expect(page.getByRole("heading", { name: ownedBrand })).toBeVisible();
    await expect(page.getByText("Tahap saat ini: Masuk")).toBeVisible();
  });

  test("a second authenticated user cannot view, read via API, or edit the primary owner's invoice", async ({ page, browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const ownedInvoiceId = manifest.invoices.sent;
    const ownedInvoiceBrand = manifest.brands[manifest.deals.invoiceSent];

    const otherOwnerContext = await browser.newContext({
      storageState: { cookies: [otherOwnerSessionCookie(baseURL!)], origins: [] },
    });
    const otherOwnerPage = await otherOwnerContext.newPage();
    try {
      const pageResponse = await otherOwnerPage.goto(`/invoice/${ownedInvoiceId}`);
      expect(pageResponse?.status()).toBe(200);
      await expect(otherOwnerPage.getByRole("heading", { name: "404" })).toBeVisible();
      await expect(otherOwnerPage.getByText("This page could not be found.")).toBeVisible();
      await expect(otherOwnerPage.getByText("E2E/SENT/001", { exact: true })).toHaveCount(0);
      await expect(otherOwnerPage.getByText("Rp 6.000.000", { exact: true })).toHaveCount(0);
      await expect(otherOwnerPage.getByText(ownedInvoiceBrand, { exact: true })).toHaveCount(0);

      const apiGetResponse = await otherOwnerPage.request.get(`/api/invoices/${ownedInvoiceId}`);
      expect(apiGetResponse.status()).toBe(404);
      expect(await apiGetResponse.json()).toEqual({ error: "Invoice tidak ditemukan." });

      // Write: attempt to change the due date, a real owner-only action
      // (invoice-journeys.spec.ts exercises the same route for the happy
      // path).
      const apiPatchResponse = await otherOwnerPage.request.patch(`/api/invoices/${ownedInvoiceId}`, {
        headers: { origin: baseURL! },
        data: { dueDate: "2026-12-31" },
      });
      expect(apiPatchResponse.status()).toBe(404);
      expect(await apiPatchResponse.json()).toEqual({ error: "Invoice tidak ditemukan." });
    } finally {
      await otherOwnerContext.close();
    }

    // Confirm the denied due-date write never landed, via the primary
    // owner's own authenticated API read (a JSON field comparison, not a
    // copy-coupled UI assertion).
    const ownerCheck = await page.request.get(`/api/invoices/${ownedInvoiceId}`);
    expect(ownerCheck.status()).toBe(200);
    const { invoice } = await ownerCheck.json();
    expect(String(invoice.dueDate).slice(0, 10)).not.toBe("2026-12-31");
  });

  test("the second user's own board and invoice list never render the primary owner's data", async ({ browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const otherOwnerContext = await browser.newContext({
      storageState: { cookies: [otherOwnerSessionCookie(baseURL!)], origins: [] },
    });
    const otherOwnerPage = await otherOwnerContext.newPage();
    try {
      await otherOwnerPage.goto("/deal");
      for (const brand of Object.values(manifest.brands)) {
        await expect(otherOwnerPage.getByText(brand, { exact: true })).toHaveCount(0);
      }

      await otherOwnerPage.goto("/invoice");
      await expect(otherOwnerPage.getByText("E2E/SENT/001", { exact: true })).toHaveCount(0);
      await expect(otherOwnerPage.getByText("E2E/PAID/002", { exact: true })).toHaveCount(0);
    } finally {
      await otherOwnerContext.close();
    }
  });
});
