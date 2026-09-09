import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { capturePage, writeCaptureManifest, type CaptureArtifact } from "./support/capture";
import { detectHorizontalOverflow, detectSmallTouchTargets } from "./support/detectors";
import { UX_VIEWPORTS, type UxLanguage, type UxViewportKey } from "./support/viewports";

type FixtureManifest = {
  sessions: { owner: string; other: string; zero: string };
  invoices: { draft: string; sent: string; due: string; overdue: string; paid: string; other: string };
  publicTokens: { active: string; expired: string; invalid: string };
};

const fixturePath = path.resolve(".hermes-runtime/ux-fixtures/fixtures.json");
const outputRoot = path.resolve("test-results/ux-audit/fixtures-baseline");
const artifacts: CaptureArtifact[] = [];
const geometryFindings: Array<{ routeKey: string; viewport: UxViewportKey; language: UxLanguage; overflow: unknown; smallTouchTargets: unknown }> = [];
let fixtures: FixtureManifest;

async function login(context: BrowserContext, baseURL: string, sessionToken: string) {
  const origin = new URL(baseURL);
  await context.clearCookies();
  await context.addCookies([{
    name: "authjs.session-token",
    value: sessionToken,
    domain: origin.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function setLanguage(page: Page, language: UxLanguage) {
  const status = await page.evaluate(async (nextLanguage) => {
    const response = await fetch("/api/me/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: nextLanguage }),
    });
    return response.status;
  }, language);
  expect(status).toBe(200);
}

async function captureAndMeasure(
  page: Page,
  route: string,
  routeKey: string,
  stateKey: string,
  viewport: UxViewportKey,
  language: UxLanguage,
) {
  artifacts.push(await capturePage(page, path.join(outputRoot, "captures"), route, { routeKey, stateKey, viewport, language }));
  geometryFindings.push({
    routeKey,
    viewport,
    language,
    overflow: await detectHorizontalOverflow(page),
    smallTouchTargets: await detectSmallTouchTargets(page),
  });
}

function normalizeDocumentText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

// No real cross-test ordering dependency exists below (each test logs in
// with its own session and only reads/navigates; the one place a test
// mutates shared per-user state -- setLanguage's PATCH -- always resets it
// back to "id" before the test ends), so this suite runs as a plain,
// non-serial describe: one test failing must never silently skip its
// siblings. It used to be test.describe.serial(...), which is exactly how
// the now-retired composite-dashboard test below (see comment) suppressed
// five unrelated regression checks on every run once it went stale.
test.describe("T-00 fixture-backed baseline", () => {
  test.beforeAll(async () => {
    fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as FixtureManifest;
  });

  test.afterAll(async () => {
    await mkdir(outputRoot, { recursive: true });
    await writeCaptureManifest(path.join(outputRoot, "capture-manifest.json"), artifacts);
    await writeFile(path.join(outputRoot, "geometry-findings.json"), `${JSON.stringify(geometryFindings, null, 2)}\n`, "utf8");
  });

  // RETIRED (independent review, see DIBAYAR-UX-QA-HARNESS-INDEPENDENT-REVIEW.md
  // section 11): this test used to capture a single composite "/dashboard"
  // page -- showing a deal card ("Brand Masuk") and an invoice number
  // ("UX/OVERDUE/004") together -- at 5 widths x 2 languages. That composite
  // page no longer exists: T-08/T-12 (docs/ux-implementation/
  // SPEC_RECONCILIATION.md) split it into "/", "/deal", and "/invoice", and
  // "/dashboard" is now a documented 302 compatibility redirect to "/" (see
  // src/app/dashboard/route.ts). Retargeting this test to "/" would just
  // re-assert the same overdue-invoice-visibility invariant states/
  // needs-chasing.spec.ts's "actionable" case already covers on the current
  // canonical route -- blind duplication, not real signal. The other
  // invariants this test carried are also already covered on canonical
  // routes: populated Beranda/invoice-detail visual regression
  // (e2e/visual/visual.spec.ts), long-content/overdue invoice-detail
  // geometry (routes/matrix.spec.ts), and PDF/HTML parity
  // (t27.verification.spec.ts). Nothing unique to this test survives
  // retargeting, so it is retired rather than kept as a permanently-skipped
  // or rewritten-to-be-redundant test.

  test("captures zero-state owner and proves no cross-owner cards", async ({ page, context, baseURL }) => {
    // Retargeted from "/dashboard" (now a 302 to "/") to the canonical
    // "/deal" and "/invoice" list routes. "/" itself is not a meaningful
    // target for this check: a zero-deal user's "/" renders Beranda's
    // onboarding empty state instead of any list content at all (see
    // states/needs-chasing.spec.ts's "fresh-user" case), so a cross-owner
    // text/link assertion made against "/" would pass trivially regardless
    // of whether the underlying queries are actually scoped to the
    // authenticated user -- the same kind of staleness this remediation
    // exists to fix. "/deal" and "/invoice" still render their real list
    // UI (empty columns / an EmptyState block) for a zero-count user, so a
    // leaked cross-owner deal or invoice would still be visible here.
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.zero);
    await page.setViewportSize(UX_VIEWPORTS.sm390);

    const dealsResponse = await page.goto("/deal", { waitUntil: "networkidle" });
    expect(dealsResponse?.status()).toBe(200);
    await expect(page.getByText("Brand Masuk", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Other Owner Secret Brand", { exact: true })).toHaveCount(0);
    await captureAndMeasure(page, "/deal", "deal-list-current", "zero-state", "sm390", "id");

    const invoicesResponse = await page.goto("/invoice", { waitUntil: "networkidle" });
    expect(invoicesResponse?.status()).toBe(200);
    await expect(page.getByText("UX/OTHER/001", { exact: true })).toHaveCount(0);
    await expect(page.locator('a[href^="/invoice/"]')).toHaveCount(0);
    await captureAndMeasure(page, "/invoice", "invoice-list-current", "zero-state", "sm390", "id");
  });

  test("enforces second-owner invoice isolation in both directions", async ({ page, context, baseURL }) => {
    // Retargeted from "/dashboard/invoices/[id]" (now a 302 to
    // "/invoice/[id]") to the canonical route directly. The authorization
    // check itself lives in the canonical page (src/app/(app)/invoice/[id]/
    // page.tsx's notFound()), not in the two-line redirect handler, so
    // this now exercises the real boundary end-to-end through an actual
    // browser navigation rather than through a deprecated compatibility
    // hop -- a strictly more direct proof of the same invariant, and one
    // this task's own independent review found had no other E2E-level
    // coverage (only a Vitest unit test of the same page).
    //
    // Asserted on rendered content, not response.status(): every route
    // under the (app) route group is wrapped in src/app/(app)/loading.tsx,
    // which -- per node_modules/next/dist/docs/.../not-found.md and
    // loading.md#status-codes -- makes Next.js start streaming the response
    // (and therefore commit to a 200) before notFound()'s render can flip
    // the status. This is documented, version-specific behavior, not a
    // security defect: verified directly (curl with each session's cookie)
    // that the response body is genuinely Next's not-found page (a
    // <meta name="robots" content="noindex"> tag and "This page could not
    // be found." are present) with none of the other owner's invoice data
    // in it, for both directions.
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.other);
    await page.goto(`/invoice/${fixtures.invoices.draft}`, { waitUntil: "networkidle" });
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("UX/DRAFT/001")).toHaveCount(0);

    await login(context, baseURL, fixtures.sessions.owner);
    await page.goto(`/invoice/${fixtures.invoices.other}`, { waitUntil: "networkidle" });
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("UX/OTHER/001")).toHaveCount(0);
  });

  test("captures no-tax/empty-date/invalid-phone and tax-bearing invoice detail", async ({ page, context, baseURL }) => {
    // Retargeted from "/dashboard/invoices/[id]" to the canonical
    // "/invoice/[id]" route. This covers invoice-detail states (a
    // no-tax/invalid-phone draft, and a PPh-21-bearing sent invoice, in
    // both languages) that routes/matrix.spec.ts's own invoice-detail
    // capture doesn't -- that one is fixed to the "overdue + long-content"
    // state -- so this remains real, non-duplicated signal.
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.owner);
    await page.setViewportSize(UX_VIEWPORTS.sm390);

    let response = await page.goto(`/invoice/${fixtures.invoices.draft}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("UX/DRAFT/001", { exact: true }).first()).toBeVisible();
    // Retargeted: "Bagikan via WhatsApp" hasn't existed since the T-19/§4.5
    // reorder -- the per-share WhatsApp button it named was folded into the
    // header's single primary action (invoice-detail-client.tsx's
    // handlePrimaryWhatsApp), labeled "Kirim lewat WhatsApp" for a
    // not-yet-overdue invoice. F15 also deliberately made that button never
    // disabled for an invalid contact (a disabled control gave no way to
    // discover why); activating it now reveals a repair panel instead. This
    // asserts the current, intentional behavior for the same
    // invalid-phone fixture: the button stays enabled, and using it surfaces
    // the repair prompt rather than silently doing nothing.
    const primaryWhatsAppButton = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(primaryWhatsAppButton).toBeEnabled();
    await primaryWhatsAppButton.click();
    await expect(page.getByText("Nomor WhatsApp belum valid — perbaiki di deal ini.")).toBeVisible();
    await captureAndMeasure(page, "/invoice/[id]", "invoice-detail-current", "draft-no-tax-empty-date-invalid-phone", "sm390", "id");

    response = await page.goto(`/invoice/${fixtures.invoices.sent}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("PPh 21 (5%)", { exact: true })).toBeVisible();
    await captureAndMeasure(page, "/invoice/[id]", "invoice-detail-current", "sent-tax", "sm390", "id");

    await setLanguage(page, "en");
    await page.setViewportSize(UX_VIEWPORTS.xl1440);
    await page.goto(`/invoice/${fixtures.invoices.sent}`, { waitUntil: "networkidle" });
    await captureAndMeasure(page, "/invoice/[id]", "invoice-detail-current", "sent-tax", "xl1440", "en");
    await setLanguage(page, "id");
  });

  test("records active, expired, and invalid public-token behavior", async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    const active = await page.goto(`/i/${fixtures.publicTokens.active}`, { waitUntil: "networkidle" });
    expect(active?.status()).toBe(200);
    // Not exact: T-22/T-23's document markup renders the number inline in
    // the same paragraph as its "Nomor invoice: " label
    // (src/components/documents/invoice-document/blocks.tsx's HeaderBlock),
    // not as an isolated text node the way the pre-T-22 markup did, so an
    // exact-text locator can never match it.
    await expect(page.getByText("UX/OVERDUE/004").first()).toBeVisible();
    await captureAndMeasure(page, "/i/[token]", "public-invoice-current", "active-long-content", "sm390", "id");

    // Retargeted: an expired share link no longer 404s. T-23
    // (src/app/i/[token]/page.tsx) deliberately gives it its own honest,
    // typed 200 state instead of the same notFound() as an unknown/invalid
    // token -- "the one case that can only ever be observed by someone who
    // already holds a real, previously valid link" -- so asserting 404 here
    // was asserting pre-T-23 behavior.
    const expired = await page.goto(`/i/${fixtures.publicTokens.expired}`, { waitUntil: "networkidle" });
    expect(expired?.status()).toBe(200);
    await expect(page.getByText("Tautan ini sudah tidak berlaku.")).toBeVisible();

    // "invalid" (malformed/unknown) still goes through the real notFound()
    // -- and this route has no route-group loading.tsx, so nothing forces
    // it to stream, and the 404 status is genuine (unlike the (app)-group
    // case above).
    expect((await page.goto(`/i/${fixtures.publicTokens.invalid}`))?.status()).toBe(404);
  });

  // Narrowed from "downloads owner/public PDFs and verifies canonical
  // HTML/PDF parity": the HTML-side field extraction below
  // (main.querySelectorAll("header p" / "dl > div")) assumed a DOM shape
  // that no longer exists -- T-22/T-23 rewrote the public invoice document
  // as plain <p>/<h2> blocks (src/components/documents/invoice-document/
  // blocks.tsx), with no <header> or <dl> at all, so every field always
  // extracted as "". The full HTML<->PDF field-by-field parity check this
  // test used to do is already covered, more thoroughly and against the
  // current markup, by t27.verification.spec.ts's own PDF parity check
  // (same publicTokens.active token; it extracts issuer/client/description/
  // amount/total/tax/terms/dueDate/bank/footer, not just the 6 fields here)
  // -- rebuilding that extraction against the new DOM here would just be a
  // second, drifting copy of the same logic. What's kept is the coverage
  // that check does *not* have: that the owner-authenticated PDF endpoint
  // itself works, that the request context used to reach the public PDF
  // endpoint is genuinely unauthenticated, and that both endpoints produce
  // the same document for the same invoice.
  test("downloads owner and public PDFs for the same invoice and confirms they match", async ({ request, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.owner);
    const ownerPdf = await context.request.get(`${baseURL}/api/invoices/${fixtures.invoices.overdue}/pdf`);
    expect(ownerPdf.status()).toBe(200);
    expect(ownerPdf.headers()["content-type"]).toContain("application/pdf");

    // `request` (not `context.request`) is a bare, cookie-free fetch
    // context -- this proves the public PDF endpoint is reachable by
    // someone who was never authenticated, not merely that it *also* works
    // for a logged-in owner.
    expect((await request.storageState()).cookies).toHaveLength(0);
    const publicPdf = await request.get(`${baseURL}/api/public/invoices/${fixtures.publicTokens.active}/pdf`);
    expect(publicPdf.status()).toBe(200);
    expect(publicPdf.headers()["content-type"]).toContain("application/pdf");

    await mkdir(path.join(outputRoot, "pdf"), { recursive: true });
    const ownerPdfPath = path.join(outputRoot, "pdf", "owner-overdue.pdf");
    const publicPdfPath = path.join(outputRoot, "pdf", "public-overdue.pdf");
    await writeFile(ownerPdfPath, await ownerPdf.body());
    await writeFile(publicPdfPath, await publicPdf.body());

    const ownerText = normalizeDocumentText(execFileSync("pdftotext", ["-layout", ownerPdfPath, "-"], { encoding: "utf8" }));
    const publicText = normalizeDocumentText(execFileSync("pdftotext", ["-layout", publicPdfPath, "-"], { encoding: "utf8" }));
    expect(ownerText.length).toBeGreaterThan(0);
    expect(ownerText).toBe(publicText);
  });
});
