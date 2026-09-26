// Curated route x state x viewport screenshot corpus (see
// docs/testing/UX_AUDIT.md "Screenshot corpus"). Deliberately a small,
// hand-picked set of high-value combinations, not a full cross product --
// see that doc for why each entry was chosen. Every capture also runs the
// deterministic overflow/touch-target detectors so a bad screenshot doesn't
// slip through only because a human never looked at it.
//
// Visual pixel regression is intentionally NOT done here -- see
// e2e/visual/visual.spec.ts, which already covers these same
// routes/states with a stable, fixed-calendar-date fixture pipeline
// (playwright.e2e.config.ts). Re-doing pixel diffing here against this
// harness's relative-date fixtures (scripts/ux-fixtures.ts: `now`/`past`/
// `future`) would be exactly the "brittle baseline caused by timestamps"
// the task warns against. scripts/ux-audit.mjs runs both suites and the
// report merges their results.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { capturePage, writeCaptureManifest, type CaptureArtifact } from "../support/capture";
import { detectHorizontalOverflow, detectSmallTouchTargets } from "../support/detectors";
import { loadUxFixtures, loginAs, goto200, type UxFixtureManifest, type UxSessionKey } from "../support/session";
import { UX_VIEWPORT_MATRIX, type UxMatrixViewportKey } from "../support/viewport-matrix";

const PRIMARY_VIEWPORTS: readonly UxMatrixViewportKey[] = ["mobile375", "desktop1440"];
const outputRoot = path.resolve("artifacts/ux-audit/screenshots");
const findingsPath = path.resolve("artifacts/ux-audit/matrix-findings.json");

type MatrixFinding = {
  routeKey: string;
  stateKey: string;
  viewport: UxMatrixViewportKey;
  overflow: Awaited<ReturnType<typeof detectHorizontalOverflow>>;
  smallTouchTargets: Awaited<ReturnType<typeof detectSmallTouchTargets>>;
};

const artifacts: CaptureArtifact[] = [];
const findings: MatrixFinding[] = [];

let fixtures: UxFixtureManifest;

test.beforeAll(async () => {
  fixtures = await loadUxFixtures();
});

test.afterAll(async () => {
  await mkdir(path.dirname(findingsPath), { recursive: true });
  await writeCaptureManifest(path.join(path.dirname(outputRoot), "manifest.json"), artifacts);
  await writeFile(findingsPath, `${JSON.stringify(findings, null, 2)}\n`, "utf8");
});

async function captureAndCheck(
  page: Page,
  route: string,
  routeKey: string,
  stateKey: string,
  viewport: UxMatrixViewportKey,
) {
  await page.setViewportSize(UX_VIEWPORT_MATRIX[viewport]);
  artifacts.push(await capturePage(page, outputRoot, route, { routeKey, stateKey, viewport, language: "id" }));
  findings.push({
    routeKey,
    stateKey,
    viewport,
    overflow: await detectHorizontalOverflow(page),
    smallTouchTargets: await detectSmallTouchTargets(page),
  });
}

async function forEachPrimaryViewport(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  sessionKey: UxSessionKey,
  route: string,
  routeKey: string,
  stateKey: string,
  check: () => Promise<void>,
) {
  await loginAs(context, baseURL, fixtures, sessionKey);
  await goto200(page, route);
  await check();
  for (const viewport of PRIMARY_VIEWPORTS) {
    await captureAndCheck(page, route, routeKey, stateKey, viewport);
  }
}

// deterministic per-capture UX gate: neither a curated corpus entry may
// silently regress into page-level overflow or a sub-44px control.
function assertNoBlockingFindings(routeKey: string, stateKey: string, viewport: UxMatrixViewportKey) {
  const finding = findings.find((item) => item.routeKey === routeKey && item.stateKey === stateKey && item.viewport === viewport);
  if (!finding) throw new Error(`Missing findings for ${routeKey}/${stateKey}/${viewport}`);
  const blockingOverflow = finding.overflow.elements.filter((item) => item.classification !== "intentional-scroll-descendant");
  expect(finding.overflow.pageOverflow, `${routeKey}/${stateKey}/${viewport}: page-level overflow`).toBe(false);
  expect(blockingOverflow, `${routeKey}/${stateKey}/${viewport}: elements outside viewport`).toEqual([]);
  expect(finding.smallTouchTargets, `${routeKey}/${stateKey}/${viewport}: sub-44px controls`).toEqual([]);
}

test.describe("Curated route x state x viewport screenshot corpus", () => {
  test("home / normal (owner, actionable Needs Chasing)", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "owner", "/", "home", "normal", async () => {
      await expect(page.getByRole("heading", { level: 2, name: "Ditagihkan bulan ini" })).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("home", "normal", viewport);
  });

  test("home / fresh-user (zero data, onboarding empty state)", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "zero", "/", "home", "fresh-user", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Belum ada deal" })).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("home", "fresh-user", viewport);
  });

  test("home / nothing-needs-chasing (real activity, intentional zero queue)", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "quiet", "/", "home", "nothing-needs-chasing", async () => {
      await expect(page.getByText("Tidak ada yang perlu dikejar.")).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("home", "nothing-needs-chasing", viewport);
  });

  test("deals / many-deals (dense board, long Indonesian brand names)", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "owner", "/deal", "deals", "many-deals", async () => {
      await expect(page.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("deals", "many-deals", viewport);
  });

  test("invoice list / mixed-deal-payment-states", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "owner", "/invoice", "invoice-list", "mixed-payment-states", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("invoice-list", "mixed-payment-states", viewport);
  });

  test("invoice detail / overdue + long-content", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    const route = `/invoice/${fixtures.invoices.overdue}`;
    await forEachPrimaryViewport(page, context, baseURL, "owner", route, "invoice-detail", "overdue-long-content", async () => {
      await expect(page.getByRole("heading", { name: "Status pembayaran" })).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("invoice-detail", "overdue-long-content", viewport);
  });

  test("pengaturan / populated (owner)", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "owner", "/pengaturan", "pengaturan", "populated", async () => {
      await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("pengaturan", "populated", viewport);
  });

  test("pengaturan / incomplete-issuer-bank (zero)", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await forEachPrimaryViewport(page, context, baseURL, "zero", "/pengaturan", "pengaturan", "incomplete-issuer-bank", async () => {
      await expect(page.getByText("Lengkapi identitas dan rekening agar invoice bisa dibagikan.")).toBeVisible();
    });
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("pengaturan", "incomplete-issuer-bank", viewport);
  });

  test("public invoice / active + long-content", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await context.clearCookies();
    const route = `/i/${fixtures.publicTokens.active}`;
    await goto200(page, route);
    await expect(page.locator("main.public-invoice")).toBeVisible();
    for (const viewport of PRIMARY_VIEWPORTS) {
      await captureAndCheck(page, route, "public-invoice", "active-long-content", viewport);
    }
    for (const viewport of PRIMARY_VIEWPORTS) assertNoBlockingFindings("public-invoice", "active-long-content", viewport);
  });
});
