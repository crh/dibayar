import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { capturePage, deterministicCaptureName, type CaptureArtifact } from "./support/capture";
import { detectHorizontalOverflow, detectSmallTouchTargets, detectWrappedActionRows, rectanglesOverlap } from "./support/detectors";
import { compareDocumentFields, type DocumentField } from "./support/parity";
import { UX_LANGUAGES, UX_VIEWPORTS, type UxLanguage, type UxViewportKey } from "./support/viewports";

type FixtureManifest = {
  sessions: { owner: string; other: string; zero: string };
  deals: { invoice: string; masuk: string };
  invoices: { sent: string; draft: string; overdue: string };
  publicTokens: { active: string; expired: string };
};

type T27Artifact = CaptureArtifact & {
  actualWidth: number;
  actualHeight: number;
  bitmapScale: number;
  cssViewport: { width: number; height: number; devicePixelRatio: number; documentScrollHeight: number };
  sha256: string;
  overflow: Awaited<ReturnType<typeof detectHorizontalOverflow>>;
  smallTouchTargets: Awaited<ReturnType<typeof detectSmallTouchTargets>>;
  wrappedActionRows: Awaited<ReturnType<typeof detectWrappedActionRows>>;
  responsiveRows: ResponsiveRow[];
  moneyMinimums: MoneyFinding[];
};

type ResponsiveRow = {
  selector: string;
  direction: string;
  childLines: number[];
  controlCount: number;
};

type MoneyFinding = { text: string; fontSize: number; display: boolean };

type DocumentExtraction = {
  text: string;
  fields: DocumentField[];
  positions: Record<string, number>;
  sourceLabels: string[];
};

type FindingEvidence = {
  id: `F${number}`;
  before: string;
  after: string;
  evidence: string;
  artifactPaths: string[];
  assertion: string;
  status: "PASS" | "INCOMPLETE";
};

type FindingPlan = Omit<FindingEvidence, "evidence" | "artifactPaths" | "assertion" | "status">;

type MovementEvidence = {
  drag: "PASS" | "INCOMPLETE";
  menu: "PASS" | "INCOMPLETE";
  keyboard: "PASS" | "INCOMPLETE";
};

const fixturePath = path.resolve(".hermes-runtime/ux-fixtures/fixtures.json");
const outputRoot = path.resolve("test-results/ux-audit/t27");
const captureRoot = path.join(outputRoot, "captures");
const artifacts: T27Artifact[] = [];
const captureFailures: Array<{ capture: string; route: string; language: string; viewport: string; issues: string[]; overflow: unknown; smallTouchTargets: unknown; wrappedActionRows: unknown; responsiveRows: unknown; moneyMinimums: unknown }> = [];
const consoleMessages: string[] = [];
const pageErrors: string[] = [];
const findingPlans: FindingPlan[] = [
  { id: "F1", before: "Composite dashboard mixed home, deals, and invoices.", after: "Separated home surface captured and asserted." },
  { id: "F2", before: "Account menu placement and dismissal were not verified at target widths.", after: "Responsive account-menu captures and Escape dismissal asserted." },
  { id: "F3", before: "Share-link layout was susceptible to overflow.", after: "Sent-invoice share state captured with overflow detectors." },
  { id: "F4", before: "Stage appeared redundantly in card and filter UI.", after: "Filtered and unfiltered deal-board states captured." },
  { id: "F5", before: "Stage movement paths lacked complete browser evidence.", after: "Desktop drag (xl1440) verified via its PATCH response, a reload, and an owner-scoped GET read-back for both the move and its restoration; adjacent-menu and keyboard movement assertions pass." },
  { id: "F6", before: "Narrow stage-board layout could create excessive vertical scrolling.", after: "Zero-state deal-board responsive captures pass." },
  { id: "F7", before: "Document fields could diverge between HTML and PDF.", after: "Canonical HTML/PDF fields match exactly and preserve order." },
  { id: "F8", before: "Deal-detail route and history surface required verification.", after: "Populated deal-detail captures pass in both UI languages." },
  { id: "F9", before: "Invoice-detail hierarchy required responsive verification.", after: "Populated and invalid-contact invoice states pass." },
  { id: "F10", before: "UI language and document formatting could drift.", after: "The route matrix passes in Indonesian and English modes." },
  { id: "F11", before: "Date-field behavior required responsive verification.", after: "Invoice-detail date states pass across required viewport bands." },
  { id: "F12", before: "Landing layout contained a wide-screen composition risk.", after: "Landing captures pass across target widths and languages." },
  { id: "F13", before: "The 320–359px band could wrap action rows or undersize money.", after: "XS captures pass overflow, target, row, and money-floor checks." },
  { id: "F14", before: "Home follow-up content required route and responsive verification.", after: "Populated home captures pass with no overflow/touch-target findings (ActionBar removal and the single-FAB layout are covered separately by app-shell.test.tsx)." },
  { id: "F15", before: "WhatsApp contact failure paths required end-to-end verification.", after: "Invalid-contact and sent-link states pass." },
];
let findingEvidence: FindingEvidence[] = findingPlans.map((finding) => ({
  ...finding,
  evidence: "not executed",
  artifactPaths: [],
  assertion: "not executed",
  status: "INCOMPLETE",
}));
let fixtures: FixtureManifest;
let runStatus: "PASS" | "INCOMPLETE" = "INCOMPLETE";
let pdfParity: Record<string, unknown> = { status: "not-run" };
let movementEvidence: MovementEvidence = { drag: "INCOMPLETE", menu: "INCOMPLETE", keyboard: "INCOMPLETE" };
// Armed (added) before the network call that could create the share, never
// after -- so a share created server-side is still tracked for cleanup even
// if the test throws before the browser-side promise resolves.
const armedShareInvoiceIds = new Set<string>();
let accountMenuDismissals = 0;
// F15: which UI languages actually completed the full invalid-contact ->
// repair -> save -> WhatsApp-fallback flow. A single boolean set by the
// first successful language would still read PASS if a later language never
// ran (or ran and failed silently); requiring both ids present is what
// proves the flow was verified end-to-end in id AND en, not just once.
const f15VerifiedLanguages = new Set<UxLanguage>();
// F4: how many times the per-stage-column label-redundancy check (below,
// in the "all-stages" deal-board check callback) actually ran, and how many
// stage sections it found with the stage's own label appearing anywhere
// other than exactly once (the column header itself).
let f4LabelChecks = 0;
let f4LabelViolations = 0;
// F4: how many times the all-stages board was checked for a native <select>
// (there must be none -- movement only ever goes through the overflow menu
// or drag), and how many of those runs found zero.
let f4SelectChecks = 0;
let f4SelectPasses = 0;
// F12: how many times the landing single-column/max-width/max-gap layout
// check (in captureLandingMatrix, at xl1440) ran, and how many of those
// runs actually satisfied all three constraints.
let f12LandingLayoutChecks = 0;
let f12LandingLayoutPasses = 0;
// F9: how many times the hero-amount -> first-interactive-element DOM-order
// check (in the sent-link-active invoice-detail check callback) ran, and how
// many of those runs found the WhatsApp action row in that position.
let f9DomOrderChecks = 0;
let f9DomOrderPasses = 0;
// F2: how many times the account-menu-vs-income-figure rectangle-overlap
// check (in the account-menu-open capture loop, below) ran -- once per
// viewport/language combination, i.e. every capture in this state -- and
// how many of those runs found zero overlap.
let f2OverlapChecks = 0;
let f2OverlapPasses = 0;
// F8: how many times the seven-deal-field DOM-visibility check (in the
// deal-detail "populated" check callback) ran, and how many found all seven
// fields (brand, fee, deadline, WhatsApp number, payment terms, scope,
// contact name) present.
let f8FieldChecks = 0;
let f8FieldPasses = 0;
// F11: how many times the stage-history date-format check (same callback as
// F8, since deal-detail's history list is the one populated capture
// guaranteed to render a real formatted date -- see T-17 backfill) ran, and
// how many found every rendered date in the fixed `d MMM yyyy` Indonesian
// form, regardless of UI language. Combined with a one-time static repo
// grep (see checkDateApologySentenceAbsent) for the deleted browser-date
// apology sentence.
let f11DateFormatChecks = 0;
let f11DateFormatPasses = 0;
let f11ApologySentenceAbsent = false;
// F14: result of the one-time static repo grep for the deleted `ActionBar`
// component (see checkActionBarDeleted).
let f14ActionBarDeleted = false;
// F1: how many times the populated-home structure check (in the home
// "populated" check callback, below) ran, and how many found a bounded-width
// <main> containing exactly the three home sections (income, follow-up
// queue, nearest deals) with no deal board embedded inline -- proving the
// composite dashboard was actually separated, not just that captures exist.
let f1HomeStructureChecks = 0;
let f1HomeStructurePasses = 0;
// F14: how many times the same populated-home check callback verified the
// follow-up queue section actually renders live reminder content (an <li>
// with a reminder action), not merely its empty state.
let f14FollowUpChecks = 0;
let f14FollowUpPasses = 0;
// F3: how many times the sent-invoice share-link single-line/non-wrapping
// check (in the sent-link-active invoice-detail check callback) ran, and how
// many found the truncated share-link track free of horizontal overflow and
// the primary-actions row rendered on a single line.
let f3ShareLinkChecks = 0;
let f3ShareLinkPasses = 0;
// F6: how many times the narrow (sm390) deal-board rail check (in the
// zero-deals deal-board check callback) ran, and how many found the rail
// horizontally scrollable with scroll-snap-aligned stage sections and a
// bounded height.
let f6RailChecks = 0;
let f6RailPasses = 0;
type SessionKey = "owner" | "zero";
const confirmedLanguage: Partial<Record<SessionKey, UxLanguage>> = {};
const cleanupEvidence: { shares: Record<string, string>; language: string } = { shares: {}, language: "not-run" };
// Narrowly scoped to the single malformed-public-token request below (armed
// immediately before that one `page.goto`, disarmed immediately after): only
// a console/page error that (a) fires while that exact request is in flight
// AND (b) textually matches a resource-load-404 diagnostic is suppressed.
// Any other error during that window, or any error outside it, still fails
// the run -- this must never become a blanket console/error suppressor. The
// expired-token case no longer needs this: it now responds 200 with the
// honest expired copy (see F7's per-finding table), not a 404.
let expectingMalformedToken404 = false;
function isExpectedMalformedToken404Diagnostic(text: string) {
  return /failed to load resource.*404/i.test(text) || /404 \(Not Found\)/.test(text);
}

// Returns only the digest -- never the absolute filesystem path used to read
// `bytes` -- so no absolute path can ever reach the persisted artifact via a
// spread of this return value. Callers that need a path for evidence use
// artifact.path (the repository-relative "captures/<name>.png" produced by
// capturePage), never the absolute path this function was given to hash.
function sha256File(bytes: Buffer) {
  return { sha256: createHash("sha256").update(bytes).digest("hex") };
}

// F14: the legacy `ActionBar` component (a card holding two buttons) was
// deleted outright, not renamed -- its actions moved into the top bar / FAB.
// Grep the identifier across application source; unlike a common English
// word, "ActionBar" has no legitimate unrelated hit, so a plain repo-wide
// grep (not scoped to user-facing strings) is safe here.
function checkActionBarDeleted(): boolean {
  try {
    execFileSync("grep", ["-rIl", "--exclude-dir=generated", "ActionBar", "src"], { encoding: "utf8" });
    return false; // grep found at least one match
  } catch (error) {
    // grep exits 1 when it finds no matches at all -- that's the pass case.
    if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 1) return true;
    throw error;
  }
}

// F11: the "browser date format" apology sentence (and its Indonesian
// equivalent) was deleted as part of T-20, not reworded -- see the T-20
// acceptance criteria in dibayar-implementation-spec.md. Scoped to
// src/lib/i18n.ts specifically (the single source of every user-facing
// string in the app, confirmed by grepping for `t("...")` call sites)
// rather than a blanket repo grep, which would false-positive on legitimate
// engineering comments that use the word "browser" for unrelated reasons
// (date-field.tsx's own picker-implementation note, for one).
async function checkDateApologySentenceAbsent(): Promise<boolean> {
  const source = await readFile(path.resolve("src/lib/i18n.ts"), "utf8");
  return !/browser|peramban|hari\/bulan\/tahun|day\/month\/year/i.test(source);
}

function pngDimensions(bytes: Buffer) {
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature || bytes.readUInt32BE(12) !== 0x49484452) {
    throw new Error("Capture is not a valid PNG");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractPdfFields(pdfPath: string): DocumentExtraction {
  // -raw preserves the PDF content stream's natural reading order (label
  // block, then its full value, then the next label) instead of -layout's
  // column reconstruction, which interleaves the Dari/Ditagihkan kepada
  // columns and merges the Deskripsi/Jumlah columns whenever their values
  // are long enough to collide on a shared visual line.
  const rawText = execFileSync("pdftotext", ["-f", "1", "-l", "1", "-raw", pdfPath, "-"], { encoding: "utf8" });
  const lines = rawText.split(/\r?\n/).map((line) => line.replace(/\s+$/, ""));
  const text = normalize(rawText);

  const findExactIndex = (value: string) => lines.findIndex((line) => line.trim() === value);
  const exactIndex = (value: string) => {
    const index = findExactIndex(value);
    if (index < 0) throw new Error(`Missing PDF label: ${value}`);
    return index;
  };
  const findLineContaining = (label: string) => lines.findIndex((line) => line.includes(label));
  const lineContaining = (label: string) => {
    const index = findLineContaining(label);
    if (index < 0) throw new Error(`Missing PDF label: ${label}`);
    return index;
  };
  const sameLineValue = (lineIndex: number, label: string) =>
    lines[lineIndex].slice(lines[lineIndex].indexOf(label) + label.length).trim();

  // Even in -raw order, a single logical value can still be split across
  // physical lines when it's long enough to wrap inside its own text run
  // (the client name, the terms/URL text). Reconstruct those wraps by
  // joining with a space, except where the PDF inserted a soft-hyphen word
  // break (a trailing "-" glued to the preceding character), which is
  // rejoined without the hyphen or a space.
  const joinWrapped = (start: number, end: number) => {
    let result = "";
    for (const raw of lines.slice(start, end)) {
      const segment = raw.trim();
      if (!segment) continue;
      if (!result) {
        result = segment;
      } else if (/\S-$/.test(result)) {
        result = `${result.slice(0, -1)}${segment}`;
      } else {
        result = `${result} ${segment}`;
      }
    }
    return result;
  };

  const fields: DocumentField[] = [];
  const sourceLabels: string[] = [];
  const add = (key: string, label: string, value: string, token = value) => {
    const normalizedValue = normalize(value);
    if (!normalizedValue) return;
    fields.push({ key, label, value: normalizedValue });
    sourceLabels.push(token || label);
  };

  // pdftotext can emit the large title heading with per-glyph spacing
  // inserted by PDF layout (e.g. "I N VO I C E"), so match "INVOICE" with
  // optional whitespace between letters rather than as a literal substring.
  const titlePattern = /I\s*N\s*V\s*O\s*I\s*C\s*E/;
  const titleIndex = lines.findIndex((line) => titlePattern.test(line));
  if (titleIndex < 0) throw new Error("Missing PDF label: INVOICE");
  add("title", "Judul", "INVOICE", "INVOICE");
  const numberIndex = lineContaining("Nomor invoice");
  add("number", "Nomor invoice", sameLineValue(numberIndex, "Nomor invoice:"), "Nomor invoice");
  const issueDateIndex = lineContaining("Tanggal terbit");
  add("issueDate", "Tanggal terbit", sameLineValue(issueDateIndex, "Tanggal terbit:"), "Tanggal terbit");

  const issuerIndex = exactIndex("Dari");
  const clientIndex = exactIndex("Ditagihkan kepada");
  const scopeIndex = exactIndex("Deskripsi");
  const amountLabelIndex = exactIndex("Jumlah");
  add("issuer", "Dari", joinWrapped(issuerIndex + 1, clientIndex), "Dari");
  add("client", "Ditagihkan kepada", joinWrapped(clientIndex + 1, scopeIndex), "Ditagihkan kepada");

  const totalIndex = lines.findIndex((line) => /^\s*Total(?:\s|$)/.test(line));
  if (totalIndex < 0) throw new Error("Missing PDF label: Total");
  add("description", "Deskripsi", joinWrapped(scopeIndex + 1, amountLabelIndex), "Deskripsi");
  add("amount", "Jumlah", joinWrapped(amountLabelIndex + 1, totalIndex), "Jumlah");

  add("total", "Total", sameLineValue(totalIndex, "Total"), "Total");
  const taxIndex = lineContaining("Pajak potong");
  add("tax", "Pajak potong", sameLineValue(taxIndex, "Pajak potong"), "Pajak potong");

  const termsIndex = findExactIndex("Syarat pembayaran");
  const dueIndex = findLineContaining("Jatuh tempo");
  const paymentIndex = lineContaining("Pembayaran ke");
  if (termsIndex >= 0) {
    const termsEnd = dueIndex >= 0 ? dueIndex : paymentIndex;
    add("terms", "Syarat pembayaran", joinWrapped(termsIndex + 1, termsEnd), "Syarat pembayaran");
  }
  if (dueIndex >= 0) add("dueDate", "Jatuh tempo", sameLineValue(dueIndex, "Jatuh tempo:"), "Jatuh tempo");

  const bankIndex = lineContaining("Bank:");
  add("bankName", "Bank", sameLineValue(bankIndex, "Bank:"), "Bank:");
  const accountNumberIndex = lineContaining("Nomor rekening:");
  add("bankAccountNumber", "Nomor rekening", sameLineValue(accountNumberIndex, "Nomor rekening:"), "Nomor rekening:");
  const accountHolderIndex = lineContaining("Atas nama:");
  add("bankAccountHolder", "Atas nama", sameLineValue(accountHolderIndex, "Atas nama:"), "Atas nama:");
  const incompleteIndex = findLineContaining("Detail rekening belum lengkap.");
  if (incompleteIndex >= 0) add("bankIncomplete", "Kelengkapan rekening", "Detail rekening belum lengkap.", "Detail rekening belum lengkap.");
  const footerText = "Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.";
  lineContaining(footerText);
  add("footer", "Footer", footerText, footerText);

  let cursor = text.indexOf(lines[titleIndex].trim());
  const positions: Record<string, number> = {};
  fields.forEach((field, index) => {
    const token = sourceLabels[index];
    const searchFrom = Math.max(cursor, 0);
    if (field.key === "title") {
      const match = titlePattern.exec(text.slice(searchFrom));
      const position = match ? searchFrom + match.index : -1;
      positions[field.key] = position;
      if (position >= 0) cursor = position + match![0].length;
      return;
    }
    const position = text.indexOf(token, searchFrom);
    positions[field.key] = position;
    if (position >= 0) cursor = position + token.length;
  });
  return { text, fields, positions, sourceLabels };
}

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

// /api/me/language is rate-limited to 10 requests/minute per session user
// (see src/lib/rate-limit.ts). A route matrix that always re-requested both
// languages in a fixed order would burn 2 requests per matrix even when the
// page already reflects the target language from the previous matrix's end
// state, and would exceed the limit well within the run. Tracking the last
// confirmed language per session lets callers skip the redundant PATCH+
// reload entirely, and languageVisitOrder below lets a matrix always visit
// the already-current language first (free) before the one PATCH needed to
// reach the other -- without ever skipping a real language switch. The
// retry-on-429 handling stays in place as defensive behavior for a real
// rate-limit response, just no longer self-inflicted by redundant calls.
function languageVisitOrder(sessionKey: SessionKey): readonly UxLanguage[] {
  const current = confirmedLanguage[sessionKey];
  if (!current) return UX_LANGUAGES;
  return [current, ...UX_LANGUAGES.filter((language) => language !== current)];
}

async function setLanguage(page: Page, language: UxLanguage, sessionKey: SessionKey) {
  if (confirmedLanguage[sessionKey] === language) return;
  let result: { status: number; retryAfter: number } = { status: 0, retryAfter: 0 };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = await page.evaluate(async (nextLanguage) => {
      const response = await fetch("/api/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLanguage }),
      });
      return {
        status: response.status,
        retryAfter: Number.parseInt(response.headers.get("Retry-After") ?? "0", 10) || 0,
      };
    }, language);
    if (result.status !== 429 || attempt === 2) break;
    await page.waitForTimeout((result.retryAfter + 1) * 1000);
  }
  expect(result.status).toBe(200);
  const response = await page.reload({ waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  confirmedLanguage[sessionKey] = language;
}

async function inspectResponsive(page: Page, viewport: UxViewportKey) {
  return page.evaluate((viewportKey) => {
    const rows: ResponsiveRow[] = [];
    const moneyMinimums: MoneyFinding[] = [];
    const visible = (element: Element) => {
      const html = element as HTMLElement;
      const rect = html.getBoundingClientRect();
      const style = getComputedStyle(html);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    for (const element of Array.from(document.querySelectorAll("*"))) {
      if (!visible(element)) continue;
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      if (style.display === "flex") {
        const controls = Array.from(html.children).filter((child) =>
          /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(child.tagName),
        ) as HTMLElement[];
        if (controls.length >= 2) {
          const childLines = [...new Set(controls.map((control) => Math.round(control.getBoundingClientRect().top)))];
          if (childLines.length > 1 || (viewportKey === "xs320" && style.flexDirection === "column")) {
            rows.push({
              selector: html.dataset.testid ? `[data-testid="${html.dataset.testid}"]` : html.tagName.toLowerCase(),
              direction: style.flexDirection,
              childLines,
              controlCount: controls.length,
            });
          }
        }
      }
    }

    // Two money-marking conventions cover the app: the shared design-system
    // <Money> component (`.ds-money`, `.ds-display` for the large variant),
    // and the canonical invoice document's plain <p> elements (`[data-ux-money]`,
    // which can't use the shared component without breaking the HTML/PDF
    // field-extraction structure -- see blocks.tsx). Both must be checked
    // against the same XS money floor (F13), so both are queried here.
    for (const element of Array.from(document.querySelectorAll(".ds-money, [data-ux-money]"))) {
      if (!visible(element)) continue;
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      moneyMinimums.push({
        text: (html.textContent ?? "").trim(),
        fontSize: Number.parseFloat(style.fontSize),
        display: html.classList.contains("ds-display") || html.dataset.uxMoney === "display",
      });
    }
    return { rows, moneyMinimums };
  }, viewport);
}

async function capture(
  page: Page,
  route: string,
  routeKey: string,
  stateKey: string,
  viewport: UxViewportKey,
  language: UxLanguage,
) {
  await page.setViewportSize(UX_VIEWPORTS[viewport]);
  await page.waitForTimeout(100);
  const descriptor = { routeKey, stateKey, viewport, language } as const;
  const expectedName = deterministicCaptureName(descriptor);
  const artifact = await capturePage(page, captureRoot, route, descriptor);
  const filePath = path.join(captureRoot, expectedName);
  const bytes = await readFile(filePath);
  const dimensions = pngDimensions(bytes);
  const overflow = await detectHorizontalOverflow(page);
  const smallTouchTargets = await detectSmallTouchTargets(page);
  const wrappedActionRows = await detectWrappedActionRows(page);
  const responsive = await inspectResponsive(page, viewport);
  const cssViewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    documentScrollHeight: document.documentElement.scrollHeight,
  }));

  expect(cssViewport.width, `${expectedName}: CSS viewport width`).toBe(UX_VIEWPORTS[viewport].width);
  expect(overflow.viewportWidth, `${expectedName}: detector viewport width`).toBe(UX_VIEWPORTS[viewport].width);
  expect(dimensions.width / cssViewport.width, `${expectedName}: bitmap scale`).toBeGreaterThan(0);
  expect(dimensions.width / cssViewport.width, `${expectedName}: bitmap scale`).toBeLessThanOrEqual(4);
  const issues: string[] = [];
  if (overflow.pageOverflow) issues.push("horizontal-page-overflow");
  const blockingOverflowElements = overflow.elements.filter(
    (element) => element.classification !== "intentional-scroll-descendant",
  );
  if (blockingOverflowElements.length > 0) issues.push("elements-outside-css-viewport");
  if (smallTouchTargets.length > 0) issues.push("sub-44px-interactive-target");
  if (wrappedActionRows.length > 0) issues.push("wrapped-action-row");
  for (const money of responsive.moneyMinimums) {
    if (money.fontSize < (money.display ? 28 : 17)) issues.push(`money-floor:${money.text}:${money.fontSize}px`);
  }
  if (viewport === "xs320" && responsive.rows.some((row) => row.direction !== "column")) issues.push("XS-action-row-not-stacked");
  if (issues.length > 0) {
    captureFailures.push({
      capture: expectedName,
      route,
      language,
      viewport,
      issues,
      overflow,
      smallTouchTargets,
      wrappedActionRows,
      responsiveRows: responsive.rows,
      moneyMinimums: responsive.moneyMinimums,
    });
  }

  artifacts.push({
    ...artifact,
    actualWidth: dimensions.width,
    actualHeight: dimensions.height,
    bitmapScale: dimensions.width / cssViewport.width,
    cssViewport,
    ...sha256File(bytes),
    overflow,
    smallTouchTargets,
    wrappedActionRows,
    responsiveRows: responsive.rows,
    moneyMinimums: responsive.moneyMinimums,
  });
}

async function goto200(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status(), `${route} response`).toBe(200);
}

async function captureLandingMatrix(page: Page, context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL);
  await context.clearCookies();
  for (const language of UX_LANGUAGES) {
    await context.addCookies([{
      name: "dibayar-language",
      value: language,
      domain: origin.hostname,
      path: "/",
      sameSite: "Lax",
    }]);
    await goto200(page, "/masuk");
    await expect(page.locator("main")).toBeVisible();
    for (const viewport of Object.keys(UX_VIEWPORTS) as UxViewportKey[]) {
      await capture(page, "/masuk", "landing", "anonymous", viewport, language);
      if (viewport === "xl1440") {
        // F12: one centred column, max 620px, no gap between blocks bigger
        // than 80px -- checked directly against <main>'s own box and the
        // vertical spacing between its direct children, not inferred from
        // capture counts.
        const layout = await page.evaluate(() => {
          const main = document.querySelector("main");
          if (!main) return null;
          const rect = main.getBoundingClientRect();
          const children = Array.from(main.children) as HTMLElement[];
          const lefts = new Set(children.map((child) => Math.round(child.getBoundingClientRect().left)));
          const sorted = [...children].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
          let maxGap = 0;
          for (let index = 1; index < sorted.length; index += 1) {
            const gap = sorted[index].getBoundingClientRect().top - sorted[index - 1].getBoundingClientRect().bottom;
            if (gap > maxGap) maxGap = gap;
          }
          return { width: Math.round(rect.width), singleColumn: lefts.size <= 1, blockCount: children.length, maxGap };
        });
        f12LandingLayoutChecks += 1;
        if (
          layout &&
          layout.width <= 620 &&
          layout.singleColumn &&
          layout.blockCount > 0 &&
          layout.maxGap <= 80
        ) f12LandingLayoutPasses += 1;
        expect(layout, `F12: /masuk single-column layout check at xl1440/${language}`).not.toBeNull();
        expect(layout?.width, "F12: landing content must not exceed 620px").toBeLessThanOrEqual(620);
        expect(layout?.singleColumn, "F12: landing content must be a single column").toBe(true);
        expect(layout?.maxGap, "F12: landing content must not contain a gap greater than 80px").toBeLessThanOrEqual(80);
      }
    }
  }
}

async function captureOwnerMatrix(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  route: string,
  routeKey: string,
  stateKey: string,
  check: () => Promise<void>,
) {
  await login(context, baseURL, fixtures.sessions.owner);
  await goto200(page, route);
  for (const language of languageVisitOrder("owner")) {
    await setLanguage(page, language, "owner");
    await check();
    for (const viewport of Object.keys(UX_VIEWPORTS) as UxViewportKey[]) {
      await capture(page, routeKey === "public-invoice" ? "/i/[token]" : route, routeKey, stateKey, viewport, language);
    }
  }
}

async function captureZeroMatrix(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  route: string,
  routeKey: string,
  stateKey: string,
  check: () => Promise<void>,
) {
  await login(context, baseURL, fixtures.sessions.zero);
  await goto200(page, route);
  for (const language of languageVisitOrder("zero")) {
    await setLanguage(page, language, "zero");
    await check();
    for (const viewport of ["sm390", "xl1440"] as const) {
      await capture(page, route, routeKey, stateKey, viewport, language);
    }
  }
}

async function createSentShare(page: Page) {
  // Arm teardown before any network/body parsing work: a server-side share
  // may have been created even if the browser evaluation later rejects.
  armedShareInvoiceIds.add(fixtures.invoices.sent);
  const result = await page.evaluate(async (invoiceId) => {
    const response = await fetch(`/api/invoices/${invoiceId}/share`, { method: "POST" });
    let payload: { path?: unknown } = {};
    try {
      payload = await response.json() as { path?: unknown };
    } catch {
      // Keep the successful POST observable so teardown still revokes it.
    }
    return { status: response.status, path: typeof payload.path === "string" && /^\/i\/[A-Za-z0-9_-]+$/.test(payload.path), rawPath: payload.path };
  }, fixtures.invoices.sent);
  expect(result.status).toBe(200);
  expect(result.path).toBe(true);
  if (typeof result.rawPath !== "string") throw new Error("Share response did not include a path");
  await page.evaluate(({ invoiceId, sharePath }) => {
    window.sessionStorage.setItem(`dibayar-share-path:${invoiceId}`, sharePath as string);
  }, { invoiceId: fixtures.invoices.sent, sharePath: result.rawPath });
}

async function runPdfParity(page: Page, baseURL: string) {
  const htmlLocator = page.locator("main.public-invoice > article");
  const htmlExtraction = await htmlLocator.evaluate((main): DocumentExtraction => {
    const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
    const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const directChildren = Array.from(main.children) as HTMLElement[];
    const fields: DocumentField[] = [];
    const sourceLabels: string[] = [];
    const add = (key: string, label: string, value: string, token = value) => {
      const normalizedValue = value.trim();
      if (!normalizedValue) return;
      fields.push({ key, label, value: normalizedValue });
      sourceLabels.push(token || label);
    };
    const valueAfter = (line: string, label: string) => line.startsWith(label) ? line.slice(label.length).trim() : "";

    const header = directChildren.find((child) => text(child.querySelector(":scope > p")) === "INVOICE");
    if (!header) throw new Error("Missing HTML invoice header");
    const headerLines = Array.from(header.querySelectorAll(":scope > p")).map((element) => text(element));
    add("title", "Judul", headerLines[0], "INVOICE");
    const numberLine = headerLines.find((line) => line.startsWith("Nomor invoice: "));
    const issueDateLine = headerLines.find((line) => line.startsWith("Tanggal terbit: "));
    if (!numberLine || !issueDateLine) throw new Error("Missing HTML header fields");
    add("number", "Nomor invoice", valueAfter(numberLine, "Nomor invoice: "), "Nomor invoice");
    add("issueDate", "Tanggal terbit", valueAfter(issueDateLine, "Tanggal terbit: "), "Tanggal terbit");

    const party = directChildren.find((child) => child.children.length === 2 && Array.from(child.children).every((column) => column.querySelector(":scope > * > h2")));
    if (!party) throw new Error("Missing HTML issuer/client blocks");
    const columns = Array.from(party.children) as HTMLElement[];
    const issuerColumn = columns.find((column) => text(column.querySelector(":scope > * > h2")) === "Dari");
    const clientColumn = columns.find((column) => text(column.querySelector(":scope > * > h2")) === "Ditagihkan kepada");
    if (!issuerColumn || !clientColumn) throw new Error("Missing HTML issuer/client labels");
    const issuerValues = Array.from(issuerColumn.querySelectorAll(":scope > * > p")).map((element) => text(element));
    const clientValues = Array.from(clientColumn.querySelectorAll(":scope > * > p")).map((element) => text(element));
    add("issuer", "Dari", issuerValues.join(" "), issuerValues[0]);
    add("client", "Ditagihkan kepada", clientValues.join(" "), clientValues[0]);

    const scopeBlock = directChildren.find((child) => text(child).includes("Deskripsi") && text(child).includes("Jumlah"));
    if (!scopeBlock) throw new Error("Missing HTML scope block");
    const scopeColumns = Array.from(scopeBlock.children) as HTMLElement[];
    const scopeValues = scopeColumns.map((column) => Array.from(column.querySelectorAll(":scope > p")).map((element) => text(element)));
    add("description", "Deskripsi", scopeValues[0]?.[1] ?? "", "Deskripsi");
    add("amount", "Jumlah", scopeValues[1]?.[1] ?? "", "Jumlah");

    const totalBlock = directChildren.find((child) => text(child.querySelector(":scope > div > p")) === "Total");
    if (!totalBlock) throw new Error("Missing HTML total block");
    const totalValues = Array.from(totalBlock.querySelectorAll(":scope > div > p")).map((element) => text(element));
    add("total", "Total", totalValues[1] ?? "", "Total");

    const taxBlock = directChildren.find((child) => text(child.querySelector(":scope > p")) === "Pajak potong");
    if (!taxBlock) throw new Error("Missing HTML tax block");
    add("tax", "Pajak potong", text(taxBlock.querySelector(":scope > p:nth-child(2)")), "Pajak potong");

    // The due date is shown with or without payment terms (FIND-08), so it
    // is looked up on its own, as the PDF side does.
    const termsBlock = directChildren.find((child) => text(child.querySelector(":scope > h2")) === "Syarat pembayaran");
    if (termsBlock) {
      const termLines = Array.from(termsBlock.querySelectorAll(":scope > p")).map((element) => text(element));
      add("terms", "Syarat pembayaran", termLines[0] ?? "", "Syarat pembayaran");
    }
    const dueLine = directChildren
      .flatMap((child) => Array.from(child.querySelectorAll(":scope > p")).map((element) => text(element)))
      .find((line) => line.startsWith("Jatuh tempo: "));
    if (dueLine) add("dueDate", "Jatuh tempo", valueAfter(dueLine, "Jatuh tempo: "), "Jatuh tempo");

    const bankBlock = directChildren.find((child) => text(child.querySelector(":scope > div > h2")) === "Pembayaran ke");
    if (!bankBlock) throw new Error("Missing HTML bank block");
    const bankLines = Array.from(bankBlock.querySelectorAll(":scope > div > p")).map((element) => text(element));
    add("bankName", "Bank", valueAfter(bankLines.find((line) => line.startsWith("Bank: ")) ?? "", "Bank: "), "Bank:");
    add("bankAccountNumber", "Nomor rekening", valueAfter(bankLines.find((line) => line.startsWith("Nomor rekening: ")) ?? "", "Nomor rekening: "), "Nomor rekening:");
    add("bankAccountHolder", "Atas nama", valueAfter(bankLines.find((line) => line.startsWith("Atas nama: ")) ?? "", "Atas nama: "), "Atas nama:");
    add("bankIncomplete", "Kelengkapan rekening", text(bankBlock.querySelector('[role="alert"]')), "Detail rekening belum lengkap.");

    const footer = directChildren.find((child) => child.tagName === "P" && text(child).startsWith("Dokumen ini dibuat otomatis."));
    if (!footer) throw new Error("Missing HTML footer");
    add("footer", "Footer", text(footer), "Dokumen ini dibuat otomatis.");

    let cursor = 0;
    const positions: Record<string, number> = {};
    const documentText = normalizeWhitespace((main as HTMLElement).innerText);
    fields.forEach((field, index) => {
      const token = sourceLabels[index];
      const position = documentText.indexOf(token, cursor);
      positions[field.key] = position;
      if (position >= 0) cursor = position + token.length;
    });
    return { text: documentText, fields, positions, sourceLabels };
  });
  const htmlFields = htmlExtraction.fields;
  expect(htmlFields.every((field) => field.value.length > 0), "HTML parity values must be populated").toBe(true);
  const pdfResponse = await page.request.get(`${baseURL}/api/public/invoices/${fixtures.publicTokens.active}/pdf`);
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  const pdfBytes = await pdfResponse.body();
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  const pdfPath = path.join(outputRoot, "pdf", "public-active.pdf");
  await mkdir(path.dirname(pdfPath), { recursive: true });
  await writeFile(pdfPath, pdfBytes);
  const pdfInfo = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pageCount = Number.parseInt(pdfInfo.match(/^Pages:\s+(\d+)$/m)?.[1] ?? "0", 10);
  expect(pageCount, "T-27 PDF parity requires exactly one page").toBe(1);
  const pdfFields = extractPdfFields(pdfPath);
  const parity = compareDocumentFields(htmlFields, pdfFields.fields);
  expect(parity.equal, "HTML/PDF document fields must match exactly").toBe(true);
  const htmlOrder = htmlFields.map((field) => htmlExtraction.positions[field.key]);
  const pdfOrder = htmlFields.map((field) => pdfFields.positions[field.key]);
  const increasing = (values: number[]) => values.every((value, index) => value >= 0 && (index === 0 || value > values[index - 1]));
  expect(increasing(htmlOrder)).toBe(true);
  expect(increasing(pdfOrder)).toBe(true);
  pdfParity = {
    status: "verified",
    path: "pdf/public-active.pdf",
    bytes: pdfBytes.length,
    pages: pageCount,
    sha256: createHash("sha256").update(pdfBytes).digest("hex"),
    htmlFields,
    pdfFields: pdfFields.fields,
    parity,
    sourceLabels: pdfFields.sourceLabels,
    order: { html: htmlOrder, pdf: pdfOrder },
  };
}

async function exerciseInvalidContactFlow(page: Page, context: BrowserContext, baseURL: string) {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await login(context, baseURL, fixtures.sessions.owner);
  await goto200(page, `/invoice/${fixtures.invoices.draft}`);
  for (const language of languageVisitOrder("owner")) {
    await setLanguage(page, language, "owner");
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    const whatsappButton = page.getByRole("button", { name: /WhatsApp/ }).first();
    const repairInput = page.locator("#invoice-contact-wa");
    await expect(whatsappButton, "F15 WhatsApp action must remain enabled for invalid numbers").toBeEnabled();
    await expect(repairInput, "F15 repair input must be revealed only after activating WhatsApp").toBeHidden();
    await whatsappButton.click();
    await expect(repairInput).toBeVisible();
    await expect(repairInput).toBeFocused();
    await expect(page.locator('label[for="invoice-contact-wa"]')).toHaveText(
      language === "id" ? "Perbaiki nomor WhatsApp" : "Fix WhatsApp number",
    );
    await expect(page.getByText(
      language === "id" ? "Nomor WhatsApp belum valid — perbaiki di deal ini." : "WhatsApp number isn't valid yet — fix it on this deal.",
      { exact: true },
    )).toBeVisible();
    await expect(page.getByText(
      language === "id" ? /^Nomor ini tersimpan di deal .+\.$/ : /^This number is saved on deal .+\.$/,
    )).toBeVisible();
    for (const viewport of Object.keys(UX_VIEWPORTS) as UxViewportKey[]) {
      await capture(page, "/invoice/[id]", "invoice-detail", "invalid-contact-fix-open", viewport, language);
    }
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    const originalContact = await repairInput.inputValue();
    try {
      await repairInput.fill("081234567890");
      const saveResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/deals/${fixtures.deals.masuk}`) && response.request().method() === "PATCH",
      );
      const saveButton = page.getByRole("button", { name: language === "id" ? "Simpan & kirim" : "Save & send", exact: true });
      await expect(saveButton).toBeEnabled();
      // Armed before the click, not after: a valid save drives
      // handleSaveContactWa straight into sendWhatsApp, which creates a
      // public share for this draft invoice through the same shared
      // /api/invoices/:id/share endpoint used by createSentShare. The share
      // may exist server-side even if a later assertion in this block throws.
      armedShareInvoiceIds.add(fixtures.invoices.draft);
      await saveButton.click();
      expect((await saveResponse).status()).toBe(200);
      await expect(page.getByText(
        language === "id" ? "Nomor WhatsApp disimpan" : "WhatsApp number saved",
        { exact: true },
      )).toBeVisible();
      await expect(page.getByRole("link", { name: language === "id" ? "Buka WhatsApp" : "Open WhatsApp", exact: true })).toBeVisible();
      f15VerifiedLanguages.add(language);
    } finally {
      const restore = await page.evaluate(async ({ dealId, contactWa }) => {
        const response = await fetch(`/api/deals/${dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactWa }),
        });
        const payload = await response.json().catch(() => ({}));
        return { status: response.status, contactWa: (payload as { deal?: { contactWa?: unknown } }).deal?.contactWa };
      }, { dealId: fixtures.deals.masuk, contactWa: originalContact });
      expect(restore.status, "F15 cleanup PATCH must restore the original deal contact").toBe(200);
      expect(restore.contactWa, "F15 cleanup read-back must report the original contact value").toBe(originalContact);
      await page.reload({ waitUntil: "networkidle" });
    }
  }
}

async function exerciseStageMovement(page: Page, context: BrowserContext, baseURL: string): Promise<MovementEvidence> {
  const evidence: MovementEvidence = { drag: "INCOMPLETE", menu: "INCOMPLETE", keyboard: "INCOMPLETE" };
  const stageOrder = ["MASUK", "NEGO", "DEAL", "KONTEN", "INVOICE", "DIBAYAR"];
  await login(context, baseURL, fixtures.sessions.owner);
  await goto200(page, "/deal");
  // F5 requires the drag interaction itself to be exercised at the desktop
  // band (>=1024), where drag is the primary movement path; the menu and
  // keyboard paths are exercised below at sm390 to prove "Pindahkan ->
  // everywhere" (the overflow-menu fallback) still holds at the mobile band.
  await page.setViewportSize(UX_VIEWPORTS.xl1440);

  const originalCard = page.locator('article[draggable="true"]').first();
  await expect(originalCard).toBeVisible();
  const brand = normalize(await originalCard.locator("h4").innerText());
  const originalSection = originalCard.locator("xpath=ancestor::section[1]");
  const originalStageId = await originalSection.getAttribute("aria-labelledby");
  if (!originalStageId?.startsWith("stage-")) throw new Error("Movement procedure could not identify the source stage");
  const originalStage = originalStageId.slice("stage-".length);
  const originalIndex = stageOrder.indexOf(originalStage);
  if (originalIndex < 0) throw new Error(`Movement procedure found unknown source stage: ${originalStage}`);
  const targetIndex = originalIndex === stageOrder.length - 1 ? originalIndex - 1 : originalIndex + 1;
  const targetStage = stageOrder[targetIndex];
  const targetSection = page.locator(`section[aria-labelledby="stage-${targetStage}"]`);
  const originalLabel = normalize(await originalSection.locator("h3").innerText());
  const targetLabel = normalize(await targetSection.locator("h3").innerText());
  let currentStage = originalStage;

  // The card picked above is "whichever deal happens to be first", not a
  // known fixture id, so its id has to be read from the DOM. The "view
  // detail" link (href="/deal/:id") only renders while the card's own menu
  // is open, so it's opened and closed once, purely to read the id, before
  // any movement happens.
  await originalCard.getByRole("button").first().click();
  const idMenu = page.getByRole("menu").last();
  await expect(idMenu).toBeVisible();
  const detailHref = await idMenu.locator('a[href^="/deal/"]').getAttribute("href");
  const dealId = detailHref?.split("/deal/")[1];
  if (!dealId) throw new Error("Movement procedure could not identify the deal id");
  await page.keyboard.press("Escape");
  await expect(idMenu).toBeHidden();

  const cardAt = (stage: string) => page.locator(`section[aria-labelledby="stage-${stage}"] article[draggable="true"]`).filter({ hasText: brand }).first();
  // Reloads the board and confirms both the UI and an owner-scoped GET
  // report the deal at `expectedStage`, so a drag move (or its restoration)
  // that only updated optimistic client state -- and never actually
  // persisted -- is caught instead of passing on UI state alone.
  const verifyPersistedStage = async (expectedStage: string, label: string) => {
    await page.reload({ waitUntil: "networkidle" });
    await expect(cardAt(expectedStage), `${label}: card must remain in ${expectedStage} after reload`).toBeVisible();
    const readBack = await page.evaluate(async (id) => {
      const response = await fetch(`/api/deals/${id}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      return { status: response.status, dealStatus: (payload as { deal?: { status?: unknown } }).deal?.status };
    }, dealId);
    expect(readBack.status, `${label}: owner-scoped GET read-back must succeed`).toBe(200);
    expect(readBack.dealStatus, `${label}: owner-scoped GET must report the persisted stage`).toBe(expectedStage);
  };
  const assertAdjacentMovementItems = async (menu: Locator, stage: string) => {
    const movementItems = menu.getByRole("menuitem").filter({ hasText: /Lanjut ke|Move to|Kembali ke|Back to/ });
    const movementCount = await movementItems.count();
    expect(movementCount, "Stage menu must expose at least one movement action").toBeGreaterThan(0);
    expect(movementCount, "Stage menu must expose adjacent-stage actions only").toBeLessThanOrEqual(2);
    const stageIndex = stageOrder.indexOf(stage);
    const adjacentStages = [stageOrder[stageIndex - 1], stageOrder[stageIndex + 1]].filter(Boolean);
    const adjacentLabels = await Promise.all(adjacentStages.map((adjacentStage) =>
      page.locator(`section[aria-labelledby="stage-${adjacentStage}"] h3`).innerText(),
    ));
    for (const itemText of await movementItems.allTextContents()) {
      expect(adjacentLabels.some((label) => itemText.includes(normalize(label)))).toBe(true);
    }
    return movementItems;
  };
  // Arms `currentStage` to the destination immediately before the one call
  // that can actually trigger the mutation, not after it resolves: a click
  // that dispatches successfully but then rejects on a later Playwright
  // post-check would otherwise leave a real server-side move untracked by
  // cleanup. If the mutating call itself throws, that's the one case it's
  // safe to roll the arm back -- nothing upstream of the click/keypress can
  // have reached the server yet.
  const moveByMenu = async (card: Locator, destinationLabel: string, sourceStage: string, destinationStage: string) => {
    await card.getByRole("button").first().click();
    const menu = page.getByRole("menu").last();
    await expect(menu).toBeVisible();
    const movementItems = await assertAdjacentMovementItems(menu, sourceStage);
    const item = movementItems.filter({ hasText: destinationLabel }).first();
    await expect(item).toHaveCount(1);
    const stageBeforeMutation = currentStage;
    currentStage = destinationStage;
    try {
      await item.click();
    } catch (error) {
      currentStage = stageBeforeMutation;
      throw error;
    }
    await expect(menu).toBeHidden();
  };

  try {
    const stageBeforeDrag = currentStage;
    currentStage = targetStage;
    const dragPatchPromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/deals/${dealId}`) && response.request().method() === "PATCH",
    );
    try {
      await originalCard.dragTo(targetSection);
    } catch (error) {
      currentStage = stageBeforeDrag;
      throw error;
    }
    const dragPatchResponse = await dragPatchPromise;
    expect(dragPatchResponse.status(), "F5 drag-move PATCH must succeed").toBe(200);
    const dragPatchBody = await dragPatchResponse.json() as { deal?: { id?: unknown; status?: unknown } };
    expect(dragPatchBody.deal?.id, "F5 drag-move PATCH must return the moved deal").toBe(dealId);
    expect(dragPatchBody.deal?.status, "F5 drag-move PATCH must report the target stage").toBe(targetStage);
    await expect(cardAt(targetStage)).toBeVisible();
    await verifyPersistedStage(targetStage, "F5 drag movement");
    evidence.drag = "PASS";

    await page.setViewportSize(UX_VIEWPORTS.sm390);
    await page.waitForTimeout(100);
    await moveByMenu(cardAt(targetStage), originalLabel, targetStage, originalStage);
    await expect(cardAt(originalStage)).toBeVisible();
    await verifyPersistedStage(originalStage, "F5 drag restoration");
    evidence.menu = "PASS";

    const keyboardCard = cardAt(originalStage);
    const keyboardTrigger = keyboardCard.getByRole("button").first();
    await page.getByTestId("top-bar").locator('button[aria-haspopup="menu"]').first().focus();
    const startsInTopBar = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="top-bar"]')));
    expect(startsInTopBar, "Keyboard movement must start from the top bar focus order").toBe(true);
    let reachedCardAction = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await page.keyboard.press("Tab");
      reachedCardAction = await keyboardTrigger.evaluate((element) => element === document.activeElement);
      if (reachedCardAction) break;
    }
    expect(reachedCardAction, "Keyboard tab order must reach the deal-card action").toBe(true);
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu").last();
    await expect(menu).toBeVisible();
    const movementItems = await assertAdjacentMovementItems(menu, originalStage);
    const targetItem = movementItems.filter({ hasText: targetLabel }).first();
    await expect(targetItem).toHaveCount(1);
    let focusedTarget = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.keyboard.press("Tab");
      focusedTarget = await targetItem.evaluate((element) => element === document.activeElement);
      if (focusedTarget) break;
    }
    expect(focusedTarget, "Keyboard Tab must reach the adjacent-stage menu item").toBe(true);
    const stageBeforeKeyboardMove = currentStage;
    currentStage = targetStage;
    try {
      await page.keyboard.press("Enter");
    } catch (error) {
      currentStage = stageBeforeKeyboardMove;
      throw error;
    }
    await expect(menu).toBeHidden();
    await expect(cardAt(targetStage)).toBeVisible();
    evidence.keyboard = "PASS";

    await moveByMenu(cardAt(targetStage), originalLabel, targetStage, originalStage);
    await expect(cardAt(originalStage)).toBeVisible();
  } finally {
    // Cleanup must trust the server, not the DOM: `currentStage` only tracks
    // "a mutation could have dispatched", and a card missing from the board
    // (filtered out, a stale locator, a mid-navigation race) is not proof
    // the deal is still at `originalStage`. The owner-scoped GET below is
    // the actual source of truth, and restoration is attempted whenever it
    // disagrees with `originalStage` -- via the UI menu when a card for the
    // persisted stage is present, or via a direct PATCH when it is not --
    // never skipped just because the DOM card can't be found.
    const cleanupRead = await page.evaluate(async (id) => {
      const response = await fetch(`/api/deals/${id}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      return { status: response.status, dealStatus: (payload as { deal?: { status?: unknown } }).deal?.status };
    }, dealId);
    const persistedStage = cleanupRead.status === 200 && typeof cleanupRead.dealStatus === "string"
      ? cleanupRead.dealStatus
      : currentStage;
    if (persistedStage !== originalStage) {
      await goto200(page, "/deal");
      const strandedCard = cardAt(persistedStage);
      if (await strandedCard.count()) {
        await moveByMenu(strandedCard, originalLabel, persistedStage, originalStage);
      } else {
        const restore = await page.evaluate(async ({ id, status }) => {
          const response = await fetch(`/api/deals/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          return response.status;
        }, { id: dealId, status: originalStage });
        if (restore !== 200) throw new Error(`F5 cleanup direct-PATCH restoration failed with status ${restore}`);
      }
      await verifyPersistedStage(originalStage, "F5 cleanup restoration");
    }
  }
  return evidence;
}

function buildFindingEvidence(): FindingEvidence[] {
  const plan = (id: FindingEvidence["id"]) => {
    const result = findingPlans.find((finding) => finding.id === id);
    if (!result) throw new Error(`Missing finding plan: ${id}`);
    return result;
  };
  // Builds a real per-finding record for every id instead of throwing at
  // the first failing finding: an early `expect(...).toBe(true)` here would
  // abort buildFindingEvidence entirely, leaving every finding after the
  // first failure stuck on its "not executed" placeholder rather than
  // reporting what actually happened. Each finding's status/evidence now
  // reflects its own verification, and the aggregate gate below (which
  // still fails the test if any finding isn't PASS) is what enforces the
  // requirement -- not a throw buried inside this helper.
  const linked = (
    id: FindingEvidence["id"],
    predicate: (artifact: T27Artifact) => boolean,
    assertion: string,
    verify: () => boolean,
    additionalPaths: string[] = [],
  ): FindingEvidence => {
    const candidatePaths = [...artifacts.filter(predicate).map((artifact) => artifact.path), ...additionalPaths];
    const artifactPaths = candidatePaths.filter((artifactPath) => existsSync(path.resolve(outputRoot, artifactPath)));
    const hasGroundedEvidence = candidatePaths.length > 0 && artifactPaths.length === candidatePaths.length;
    let verified = false;
    try {
      verified = verify();
    } catch {
      verified = false;
    }
    const status: FindingEvidence["status"] = hasGroundedEvidence && verified ? "PASS" : "INCOMPLETE";
    return {
      ...plan(id),
      evidence: `${artifactPaths.length}/${candidatePaths.length} linked capture artifact(s) found on disk`,
      artifactPaths,
      assertion,
      status,
    };
  };

  // These are derived state for the per-finding predicates below, not gates
  // of their own: an `expect(...)` here would throw and abort this function
  // before a single finding record is built, which is exactly the "stuck on
  // 'not executed'" failure mode the comment above `linked` describes. The
  // equivalent checks are asserted per-finding instead -- languageSet by F10,
  // xsArtifacts by F13 -- so each still gates its own finding's PASS/
  // INCOMPLETE without being able to blank out every other one.
  const languageSet = new Set(artifacts.map((artifact) => artifact.language));
  const viewportKeys = Object.keys(UX_VIEWPORTS) as UxViewportKey[];
  const xsArtifacts = artifacts.filter((artifact) => artifact.viewport === "xs320");

  return [
    linked(
      "F1",
      (artifact) => artifact.routeKey === "home" && artifact.stateKey === "populated",
      `populated home matrix has no responsive findings; bounded-width/no-embedded-board structure checked ${f1HomeStructureChecks} time(s), ${f1HomeStructurePasses} passed`,
      () => {
        const home = artifacts.filter((artifact) => artifact.routeKey === "home" && artifact.stateKey === "populated");
        return home.length === UX_LANGUAGES.length * Object.keys(UX_VIEWPORTS).length
          && home.every((artifact) => artifact.overflow.pageOverflow === false && artifact.smallTouchTargets.length === 0)
          && f1HomeStructureChecks > 0 && f1HomeStructurePasses === f1HomeStructureChecks;
      },
    ),
    linked(
      "F2",
      (artifact) => artifact.routeKey === "home" && artifact.stateKey === "account-menu-open",
      `account-menu reopened, remeasured, and Escape-dismissed at all ${viewportKeys.length} widths in both languages; overlap-vs-income-figure checked ${f2OverlapChecks} time(s), ${f2OverlapPasses} passed`,
      () => {
        const menuCaptures = artifacts.filter((artifact) => artifact.routeKey === "home" && artifact.stateKey === "account-menu-open");
        return accountMenuDismissals === UX_LANGUAGES.length * viewportKeys.length
          && new Set(menuCaptures.map((artifact) => artifact.language)).size === UX_LANGUAGES.length
          && new Set(menuCaptures.map((artifact) => artifact.viewport)).size === viewportKeys.length
          && f2OverlapChecks === accountMenuDismissals
          && f2OverlapPasses === f2OverlapChecks;
      },
    ),
    linked(
      "F3",
      (artifact) => artifact.routeKey === "invoice-detail" && artifact.stateKey === "sent-link-active",
      `sent-link captures have empty overflow and touch-target findings; single-line share-link/action-row check ran ${f3ShareLinkChecks} time(s), ${f3ShareLinkPasses} passed`,
      () => {
        const sent = artifacts.filter((artifact) => artifact.routeKey === "invoice-detail" && artifact.stateKey === "sent-link-active");
        return sent.length > 0
          && sent.every((artifact) => artifact.overflow.pageOverflow === false && artifact.smallTouchTargets.length === 0)
          && f3ShareLinkChecks > 0 && f3ShareLinkPasses === f3ShareLinkChecks;
      },
    ),
    linked(
      "F4",
      (artifact) => artifact.routeKey === "deal-board" && ["all-stages", "filtered-stage"].includes(artifact.stateKey),
      `all-stage and filtered-stage captures exist; stage-label redundancy checked ${f4LabelChecks} time(s), ${f4LabelViolations} violation(s); native-<select> absence checked ${f4SelectChecks} time(s), ${f4SelectPasses} passed`,
      () => {
        const boardStates = new Set(artifacts.filter((artifact) => artifact.routeKey === "deal-board").map((artifact) => artifact.stateKey));
        return boardStates.has("all-stages") && boardStates.has("filtered-stage")
          && f4LabelChecks > 0 && f4LabelViolations === 0
          && f4SelectChecks > 0 && f4SelectPasses === f4SelectChecks;
      },
    ),
    linked("F5", (artifact) => artifact.routeKey === "deal-board" && artifact.stateKey === "all-stages", `drag=${movementEvidence.drag}, menu=${movementEvidence.menu}, keyboard=${movementEvidence.keyboard}`, () => movementEvidence.drag === "PASS" && movementEvidence.menu === "PASS" && movementEvidence.keyboard === "PASS"),
    linked(
      "F6",
      (artifact) => artifact.routeKey === "deal-board" && artifact.stateKey === "zero-deals",
      `zero-deal board captures pass responsive checks; sm390 page scroll height stays under 1.5x the viewport height; narrow rail overflow/height/snap checked ${f6RailChecks} time(s), ${f6RailPasses} passed`,
      () => {
        const zeroBoards = artifacts.filter((artifact) => artifact.routeKey === "deal-board" && artifact.stateKey === "zero-deals");
        const sm390Boards = zeroBoards.filter((artifact) => artifact.viewport === "sm390");
        return zeroBoards.length > 0
          && zeroBoards.every((artifact) => artifact.overflow.pageOverflow === false && artifact.smallTouchTargets.length === 0)
          && sm390Boards.length > 0
          && sm390Boards.every((artifact) => artifact.cssViewport.documentScrollHeight <= artifact.cssViewport.height * 1.5)
          && f6RailChecks > 0 && f6RailPasses === f6RailChecks;
      },
    ),
    linked(
      "F7",
      (artifact) => artifact.routeKey === "public-invoice" && artifact.stateKey === "active",
      `PDF parity status=${String(pdfParity.status)}`,
      () => pdfParity.status === "verified" && pdfParity.pages === 1,
      [typeof pdfParity.path === "string" ? pdfParity.path : ""].filter(Boolean),
    ),
    linked(
      "F8",
      (artifact) => artifact.routeKey === "deal-detail" && artifact.stateKey === "populated",
      `populated deal-detail captures exist in both languages with no overflow/touch-target findings; seven-field visibility checked ${f8FieldChecks} time(s), ${f8FieldPasses} passed`,
      () => {
        const dealDetail = artifacts.filter((artifact) => artifact.routeKey === "deal-detail" && artifact.stateKey === "populated");
        return new Set(dealDetail.map((artifact) => artifact.language)).size === UX_LANGUAGES.length
          && dealDetail.every((artifact) => artifact.overflow.pageOverflow === false && artifact.smallTouchTargets.length === 0)
          && f8FieldChecks > 0 && f8FieldPasses === f8FieldChecks;
      },
    ),
    linked(
      "F9",
      (artifact) => artifact.routeKey === "invoice-detail" && ["invalid-contact-fix-open", "sent-link-active"].includes(artifact.stateKey),
      `invalid-contact and sent-link invoice-detail captures exist; DOM-order check ran ${f9DomOrderChecks} time(s), ${f9DomOrderPasses} passed`,
      () => {
        const states = new Set(artifacts.filter((artifact) => artifact.routeKey === "invoice-detail").map((artifact) => artifact.stateKey));
        return states.has("invalid-contact-fix-open") && states.has("sent-link-active")
          && f9DomOrderChecks > 0 && f9DomOrderPasses === f9DomOrderChecks;
      },
    ),
    linked(
      "F10",
      (artifact) => artifact.language === "id" || artifact.language === "en",
      `languages=${[...languageSet].sort().join(",")}; money-format checked across ${artifacts.reduce((total, artifact) => total + artifact.moneyMinimums.length, 0)} rendered amount(s) in both languages`,
      () => {
        // Money renders identically ("Rp 100.000.000", id-ID grouping) under
        // both uiLanguage values -- there is no combination in which it
        // renders as "IDR 100,000,000" (see the locale-model rendering
        // table). Checked against every money element already collected by
        // `capture()` across the whole run, not just one route/language.
        const moneyPattern = /^−?Rp[  ][\d.]+$/;
        const allMoneyTexts = artifacts.flatMap((artifact) => artifact.moneyMinimums.map((money) => money.text)).filter(Boolean);
        return languageSet.size === UX_LANGUAGES.length
          && UX_LANGUAGES.every((language) => languageSet.has(language))
          && allMoneyTexts.length > 0
          && allMoneyTexts.every((text) => moneyPattern.test(text));
      },
    ),
    linked(
      "F11",
      (artifact) => artifact.routeKey === "deal-detail" && artifact.stateKey === "populated",
      `apology-sentence repo grep clean=${f11ApologySentenceAbsent}; stage-history date-format checked ${f11DateFormatChecks} time(s), ${f11DateFormatPasses} passed`,
      () => f11ApologySentenceAbsent && f11DateFormatChecks > 0 && f11DateFormatPasses === f11DateFormatChecks,
    ),
    linked(
      "F12",
      (artifact) => artifact.routeKey === "landing" && artifact.stateKey === "anonymous",
      `landing captures exist across target widths and languages; xl1440 single-column/max-width/max-gap layout checked ${f12LandingLayoutChecks} time(s), ${f12LandingLayoutPasses} passed`,
      () =>
        artifacts.filter((artifact) => artifact.routeKey === "landing" && artifact.stateKey === "anonymous").length === UX_LANGUAGES.length * viewportKeys.length &&
        f12LandingLayoutChecks === UX_LANGUAGES.length &&
        f12LandingLayoutPasses === f12LandingLayoutChecks,
    ),
    linked("F13", (artifact) => artifact.viewport === "xs320", `xs320 captures=${xsArtifacts.length}; all detector findings empty`, () => xsArtifacts.length > 0 && xsArtifacts.every((artifact) => artifact.overflow.pageOverflow === false && artifact.smallTouchTargets.length === 0 && artifact.wrappedActionRows.length === 0 && artifact.responsiveRows.every((row) => row.direction === "column") && artifact.moneyMinimums.every((money) => money.fontSize >= (money.display ? 28 : 17)))),
    linked(
      "F14",
      (artifact) => artifact.routeKey === "home" && artifact.stateKey === "populated",
      `populated home matrix has the expected language/viewport cardinality and no overflow/touch-target findings; follow-up content checked ${f14FollowUpChecks} time(s), ${f14FollowUpPasses} passed; legacy ActionBar deleted=${f14ActionBarDeleted}`,
      () => {
        const home = artifacts.filter((artifact) => artifact.routeKey === "home" && artifact.stateKey === "populated");
        return home.length === UX_LANGUAGES.length * Object.keys(UX_VIEWPORTS).length
          && home.every((artifact) => artifact.overflow.pageOverflow === false && artifact.smallTouchTargets.length === 0)
          && f14FollowUpChecks > 0 && f14FollowUpPasses === f14FollowUpChecks
          && f14ActionBarDeleted;
      },
    ),
    linked(
      "F15",
      (artifact) => artifact.routeKey === "invoice-detail" && ["invalid-contact-fix-open", "sent-link-active"].includes(artifact.stateKey),
      `invalid-contact flow enables WhatsApp, reveals exact repair block, saves, and provides fallback; verified languages=${[...f15VerifiedLanguages].sort().join(",")}`,
      () => UX_LANGUAGES.every((language) => f15VerifiedLanguages.has(language)),
    ),
  ];
}

// --- Evidence-file privacy hardening ---------------------------------------
// Everything below sanitizes what actually gets written to disk in
// test.afterAll. It never touches the in-memory `artifacts`/`captureFailures`
// arrays the test body asserts against above -- those still see full DOM
// text so real defects are still caught -- it only narrows what is
// *persisted* as evidence, to repository-relative paths and redacted safe
// summaries (counts/lengths/booleans), never literal fixture content
// (brand names, phone numbers, bank details, addresses) or literal fixture
// row ids.
const FIXTURE_ID_PATTERN = /ux-t00[-A-Za-z0-9]*/g;

function redactFixtureIds(value: string) {
  return value.replace(FIXTURE_ID_PATTERN, "[fixture-id]");
}

function redactElementText<T extends { text: string }>(
  finding: T,
): Omit<T, "text"> & { textLength: number; textBlank: boolean } {
  const { text, ...rest } = finding;
  return { ...rest, textLength: text.length, textBlank: text.trim().length === 0 };
}

function redactOverflowReport(report: T27Artifact["overflow"]) {
  return { ...report, elements: report.elements.map(redactElementText) };
}

function redactMoneyMinimums(findings: MoneyFinding[]) {
  return findings.map(({ text, ...rest }) => ({ ...rest, textLength: text.length }));
}

function redactArtifactForEvidence(artifact: T27Artifact) {
  return {
    ...artifact,
    route: redactFixtureIds(artifact.route),
    overflow: redactOverflowReport(artifact.overflow),
    smallTouchTargets: artifact.smallTouchTargets.map(redactElementText),
    wrappedActionRows: artifact.wrappedActionRows.map(redactElementText),
    moneyMinimums: redactMoneyMinimums(artifact.moneyMinimums),
  };
}

// Rebuilds `issues` into fixed, content-free codes rather than persisting the
// raw strings: `money-floor:<rendered amount>:<font size>px` embeds a
// formatted money value from the fixture, so it is collapsed to the bare
// `money-floor` code. Every other issue string is already a fixed code and
// passes through unchanged.
function redactIssuesForEvidence(issues: string[]) {
  return issues.map((issue) => (issue.startsWith("money-floor:") ? "money-floor" : issue));
}

function redactCaptureFailureForEvidence(failure: (typeof captureFailures)[number]) {
  return {
    ...failure,
    route: redactFixtureIds(failure.route),
    issues: redactIssuesForEvidence(failure.issues as string[]),
    overflow: redactOverflowReport(failure.overflow as T27Artifact["overflow"]),
    smallTouchTargets: (failure.smallTouchTargets as T27Artifact["smallTouchTargets"]).map(redactElementText),
    wrappedActionRows: (failure.wrappedActionRows as T27Artifact["wrappedActionRows"]).map(redactElementText),
    moneyMinimums: redactMoneyMinimums(failure.moneyMinimums as MoneyFinding[]),
  };
}

function redactDiagnosticMessages(messages: string[]) {
  return messages.map((message) => redactFixtureIds(message).slice(0, 300));
}

type PersistedPdfParity = {
  status: unknown;
  path?: string;
  bytes?: number;
  pages?: number;
  sha256?: string;
  fieldsEqual?: boolean;
  htmlFieldCount?: number;
  pdfFieldCount?: number;
  missingFromHtmlCount?: number;
  missingFromPdfCount?: number;
  mismatchCount?: number;
  htmlOrderIncreasing?: boolean;
  pdfOrderIncreasing?: boolean;
};

// Deliberately rebuilds a brand-new object rather than spreading/redacting
// `parity` in place: htmlFields, pdfFields, parity.mismatches,
// parity.missingFromHtml/missingFromPdf, sourceLabels, and the raw
// text-offset order arrays all carry literal fixture field content (money,
// phone, brand, bank, address text) or the tokens used to locate it in the
// raw extracted text. None of those may ever reach the persisted evidence
// file -- only the scalar status/summary fields below do. The full-fidelity
// data stays reachable in-memory (the local `htmlFields`/`pdfFields.fields`/
// `parity`/`htmlOrder`/`pdfOrder` variables in runPdfParity) for the actual
// parity assertions above; this function only narrows what test.afterAll
// writes to disk.
function redactPdfParityForEvidence(parity: typeof pdfParity): PersistedPdfParity {
  const record = parity as {
    status?: unknown;
    path?: unknown;
    bytes?: unknown;
    pages?: unknown;
    sha256?: unknown;
    htmlFields?: DocumentField[];
    pdfFields?: DocumentField[];
    parity?: { equal: boolean; missingFromHtml: unknown[]; missingFromPdf: unknown[]; mismatches: unknown[] };
    order?: { html: number[]; pdf: number[] };
  };
  const increasing = (values: number[]) =>
    values.every((value, index) => value >= 0 && (index === 0 || value > values[index - 1]));
  return {
    status: record.status,
    path: typeof record.path === "string" ? record.path : undefined,
    bytes: typeof record.bytes === "number" ? record.bytes : undefined,
    pages: typeof record.pages === "number" ? record.pages : undefined,
    sha256: typeof record.sha256 === "string" ? record.sha256 : undefined,
    fieldsEqual: record.parity?.equal,
    htmlFieldCount: record.htmlFields?.length,
    pdfFieldCount: record.pdfFields?.length,
    missingFromHtmlCount: record.parity?.missingFromHtml.length,
    missingFromPdfCount: record.parity?.missingFromPdf.length,
    mismatchCount: record.parity?.mismatches.length,
    htmlOrderIncreasing: record.order ? increasing(record.order.html) : undefined,
    pdfOrderIncreasing: record.order ? increasing(record.order.pdf) : undefined,
  };
}

function redactCleanupSharesForEvidence(shares: Record<string, string>) {
  return Object.fromEntries(Object.entries(shares).map(([invoiceId, status]) => [redactFixtureIds(invoiceId), status]));
}

// A deterministic, repo-agnostic net over the two files test.afterAll
// actually writes to disk: even if a future edit to one of the redact*
// helpers above misses a spot, none of these patterns may ever appear in
// persisted evidence. Runs against the final serialized JSON string, not
// the in-memory objects the test's own assertions use above -- this never
// weakens (or substitutes for) those runtime checks, it only guards what
// crosses the persistence boundary.
const REPO_ROOT = process.cwd();
function assertNoSensitiveEvidence(serialized: string, fileLabel: string) {
  expect(serialized.includes(REPO_ROOT), `${fileLabel}: persisted evidence must not contain an absolute filesystem path`).toBe(false);
  expect(/ux-t00-[-A-Za-z0-9]+/.test(serialized), `${fileLabel}: persisted evidence must not contain a raw fixture row id`).toBe(false);
  expect(/Rp[\s\u00A0]?[\d.,]{4,}/.test(serialized), `${fileLabel}: persisted evidence must not contain a formatted money amount`).toBe(false);
  expect(/\b(?:\+?62|0)8\d{8,}\b/.test(serialized), `${fileLabel}: persisted evidence must not contain a raw phone number`).toBe(false);
  expect(/\bBrand [A-Za-z]/.test(serialized), `${fileLabel}: persisted evidence must not contain a raw fixture brand name`).toBe(false);
  expect(/Bank Fixture|Jl\. Fixture/.test(serialized), `${fileLabel}: persisted evidence must not contain raw fixture bank/address text`).toBe(false);
}

test.describe.serial("T-27 verification capture rerun", () => {
  test.beforeAll(async () => {
    fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as FixtureManifest;
  });

  test.afterEach(async ({ page, context, baseURL }) => {
    if (!fixtures || !baseURL) return;
    const cleanupErrors: string[] = [];
    try {
      // Best-effort per share, fail-closed overall: every armed invoice id
      // gets its own attempt regardless of whether an earlier one in this
      // same loop failed (a share left dangling for a draft invoice must
      // never be masked by an unrelated failure on the sent invoice's
      // share), while the run as a whole is still marked INCOMPLETE and
      // thrown if any single one didn't fully verify.
      if (armedShareInvoiceIds.size > 0) {
        await login(context, baseURL, fixtures.sessions.owner);
        for (const invoiceId of [...armedShareInvoiceIds]) {
          try {
            const cleanup = await page.evaluate(async (id) => {
              const before = await fetch(`/api/invoices/${id}/share`, { cache: "no-store" });
              const beforePayload = await before.json() as { active?: unknown };
              let revokeStatus: number | null = null;
              if (beforePayload.active === true) {
                const revoke = await fetch(`/api/invoices/${id}/share`, { method: "DELETE" });
                revokeStatus = revoke.status;
              }
              const after = await fetch(`/api/invoices/${id}/share`, { cache: "no-store" });
              const afterPayload = await after.json() as { active?: unknown };
              return {
                beforeStatus: before.status,
                beforeActive: beforePayload.active,
                revokeStatus,
                afterStatus: after.status,
                afterActive: afterPayload.active,
              };
            }, invoiceId);
            if (cleanup.beforeStatus !== 200) throw new Error(`cleanup share GET before revoke returned ${cleanup.beforeStatus}`);
            if (cleanup.revokeStatus !== null && cleanup.revokeStatus !== 200) throw new Error(`cleanup revoke returned ${cleanup.revokeStatus}`);
            if (cleanup.afterStatus !== 200) throw new Error(`cleanup read-back GET returned ${cleanup.afterStatus}`);
            if (cleanup.afterActive !== false) throw new Error("cleanup read-back still reports an active share");
            cleanupEvidence.shares[invoiceId] = cleanup.revokeStatus !== null ? "revoked-and-verified" : "already-inactive-verified";
            armedShareInvoiceIds.delete(invoiceId);
          } catch (error) {
            cleanupEvidence.shares[invoiceId] = "cleanup-failed";
            cleanupErrors.push(`share ${invoiceId}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      try {
        await login(context, baseURL, fixtures.sessions.owner);
        await setLanguage(page, "id", "owner");
        cleanupEvidence.language = "restored-id";
      } catch (error) {
        cleanupErrors.push(`language restore: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (consoleMessages.length > 0 || pageErrors.length > 0) {
        cleanupErrors.push("console warnings/errors or page errors were recorded during the run");
      }
      if (cleanupErrors.length > 0) throw new Error(`T-27 cleanup issues: ${cleanupErrors.join("; ")}`);
    } catch (error) {
      runStatus = "INCOMPLETE";
      throw error;
    }
  });

  test.afterAll(async () => {
    await mkdir(outputRoot, { recursive: true });
    const redactedArtifacts = artifacts.map(redactArtifactForEvidence);
    const redactedCaptureFailures = captureFailures.map(redactCaptureFailureForEvidence);
    const redactedPdfParity = redactPdfParityForEvidence(pdfParity);
    const redactedCleanup = { ...cleanupEvidence, shares: redactCleanupSharesForEvidence(cleanupEvidence.shares) };
    const redactedDiagnostics = {
      consoleMessages: redactDiagnosticMessages(consoleMessages),
      pageErrors: redactDiagnosticMessages(pageErrors),
    };
    const manifest = {
      schemaVersion: 1,
      task: "T-27",
      status: runStatus,
      expectedCount: 123,
      count: artifacts.length,
      artifacts: redactedArtifacts,
      captureFailures: redactedCaptureFailures,
      pdfParity: redactedPdfParity,
      movementEvidence,
      findingEvidence,
      cleanup: redactedCleanup,
      diagnostics: redactedDiagnostics,
      environment: {
        mode: "local-disposable-fixtures",
        fixturePrefix: "ux-t00",
        previewCapture: "blocked-authentication-not-used",
      },
    };
    const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
    const reportJson = `${JSON.stringify({
      task: "T-27",
      status: runStatus,
      expectedCaptures: 123,
      captured: artifacts.length,
      captureFailures: redactedCaptureFailures,
      pdfParity: redactedPdfParity,
      movementEvidence,
      findingEvidence,
      cleanup: redactedCleanup,
      limitation: "Local disposable fixture run; protected Preview could not be exercised because the authenticated browser context redirected to Vercel login.",
    }, null, 2)}\n`;
    assertNoSensitiveEvidence(manifestJson, "capture-manifest.json");
    assertNoSensitiveEvidence(reportJson, "t27-report.json");
    await writeFile(path.join(outputRoot, "capture-manifest.json"), manifestJson, "utf8");
    await writeFile(path.join(outputRoot, "t27-report.json"), reportJson, "utf8");
  });

  test("executes the 123-capture matrix and non-visual checks", async ({ page, context, baseURL }) => {
    test.setTimeout(600_000);
    if (!baseURL) throw new Error("baseURL required");
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      const text = message.text();
      if (expectingMalformedToken404 && isExpectedMalformedToken404Diagnostic(text)) return;
      consoleMessages.push(`${message.type()}: ${text}`);
    });
    page.on("pageerror", (error) => {
      if (expectingMalformedToken404 && isExpectedMalformedToken404Diagnostic(error.message)) return;
      pageErrors.push(error.message);
    });

    // F11 / F14: one-time static repo checks, run once up front rather than
    // per-capture -- their result doesn't depend on viewport, language, or
    // capture state, only on the source tree.
    f11ApologySentenceAbsent = await checkDateApologySentenceAbsent();
    f14ActionBarDeleted = checkActionBarDeleted();

    movementEvidence = await exerciseStageMovement(page, context, baseURL);
    await captureLandingMatrix(page, context, baseURL);
    await captureOwnerMatrix(page, context, baseURL, "/", "home", "populated", async () => {
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Brand Masuk", { exact: true })).toBeVisible();
      // F1: the separated home surface must be a single bounded-width column
      // made of exactly the three home sections (income, follow-up queue,
      // nearest deals) -- proving the old composite dashboard (which mixed
      // home, deals, and invoices) is gone, not merely that captures exist.
      // F14: the follow-up queue section within it must actually render live
      // reminder content (an <li> for the fixture's overdue invoice), not
      // just its empty state -- checked language-agnostically via markup
      // shape, since this check callback runs once per UI language.
      await page.setViewportSize(UX_VIEWPORTS.xl1440);
      const structure = await page.evaluate(() => {
        const main = document.querySelector("main");
        const rect = main?.getBoundingClientRect();
        const income = document.querySelector('section[aria-labelledby="home-net-bulan-ini"]');
        const queue = document.querySelector('section[aria-labelledby="home-perlu-dikejar"]');
        const nearest = document.querySelector('section[aria-labelledby="home-deal-terdekat"]');
        const incomeRect = income?.getBoundingClientRect();
        const queueRect = queue?.getBoundingClientRect();
        return {
          mainWidth: rect ? Math.round(rect.width) : null,
          hasDealBoard: Boolean(document.querySelector('[data-testid="deal-board-rail"]')),
          hasAllSections: Boolean(income && queue && nearest),
          queueRightOfIncome: Boolean(incomeRect && queueRect && queueRect.left > incomeRect.left),
          queueHasLiveItem: Boolean(queue?.querySelector(":scope > ul > li")),
        };
      });
      f1HomeStructureChecks += 1;
      const boundedStructure =
        structure.mainWidth !== null && structure.mainWidth <= 1280 &&
        structure.hasAllSections && !structure.hasDealBoard && structure.queueRightOfIncome;
      if (boundedStructure) f1HomeStructurePasses += 1;
      expect(
        boundedStructure,
        "F1: the separated home surface must be a bounded-width column of exactly the income/follow-up/nearest sections, with no deal board embedded inline",
      ).toBe(true);

      f14FollowUpChecks += 1;
      if (structure.queueHasLiveItem) f14FollowUpPasses += 1;
      expect(structure.queueHasLiveItem, "F14: the home follow-up queue must render at least one live reminder item, not only its empty state").toBe(true);
    });
    await captureOwnerMatrix(page, context, baseURL, "/deal", "deal-board", "all-stages", async () => {
      await expect(page.getByTestId("deal-board-rail")).toBeVisible();
      // F4: each stage's own name must appear exactly once per column (the
      // h3 header) -- not repeated inside every card in that column, which
      // was the original defect ("stage stated 4x"). Adjacent-stage names
      // inside a closed card's menu don't count: the menu only enters the
      // DOM once opened, so a plain full-text scan never sees them.
      const redundancy = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section[aria-labelledby^="stage-"]'));
        return sections.map((section) => {
          const heading = section.querySelector("h3");
          const label = (heading?.textContent ?? "").trim();
          const matches = Array.from(section.querySelectorAll("*")).filter(
            (element) => element.children.length === 0 && (element.textContent ?? "").trim() === label,
          );
          return { label, count: matches.length };
        });
      });
      f4LabelChecks += 1;
      f4LabelViolations += redundancy.filter((entry) => entry.label !== "" && entry.count !== 1).length;
      expect(
        redundancy.every((entry) => entry.label === "" || entry.count === 1),
        "F4: each stage label must appear exactly once (the column header) per stage, never repeated per card",
      ).toBe(true);
      // F4: no path to move a deal goes through a native <select> -- the
      // overflow-menu (role=menuitem) and drag are the only movement paths.
      const selectCount = await page.locator("select").count();
      f4SelectChecks += 1;
      if (selectCount === 0) f4SelectPasses += 1;
      expect(selectCount, "F4: /deal must contain no native <select> element").toBe(0);
    });
    await captureOwnerMatrix(page, context, baseURL, "/deal?tahap=INVOICE", "deal-board", "filtered-stage", async () => {
      await expect(page).toHaveURL(/tahap=INVOICE$/);
      await expect(page.getByTestId("deal-board-rail")).toBeVisible();
    });
    await captureOwnerMatrix(page, context, baseURL, `/deal/${fixtures.deals.invoice}`, "deal-detail", "populated", async () => {
      await expect(page.locator("main")).toBeVisible();
      // F8: every field the add-deal form can capture -- brand, fee,
      // deadline, WhatsApp number, payment terms, scope, contact name --
      // must be visible on the deal-detail route (dt/dd label present, not
      // that the value is non-empty: a deal without a deadline still shows
      // the field with its own empty-state copy, not a missing field).
      // F11: the stage-history dates on this same page (guaranteed non-empty
      // by the T-17 backfill) must render in the fixed Indonesian
      // `d MMM yyyy` form regardless of the active UI language.
      const inspection = await page.evaluate(() => {
        const main = document.querySelector("main");
        const brand = (main?.querySelector("h1")?.textContent ?? "").trim();
        const dl = main?.querySelector("dl");
        const dtDdPairs = dl
          ? Array.from(dl.querySelectorAll(":scope > div")).map((row) => ({
              label: (row.querySelector("dt")?.textContent ?? "").trim(),
              value: (row.querySelector("dd")?.textContent ?? "").trim(),
            }))
          : [];
        const contactNameFieldPresent = Boolean(
          document.querySelector('label[for="contactName"]') && document.querySelector("#contactName"),
        );
        const historyDates = Array.from(document.querySelectorAll("main ol > li span.shrink-0")).map(
          (element) => (element.textContent ?? "").trim(),
        );
        return { brand, dtDdPairs, contactNameFieldPresent, historyDates };
      });
      f8FieldChecks += 1;
      const sevenFieldsVisible =
        inspection.brand.length > 0 &&
        inspection.dtDdPairs.length === 5 &&
        inspection.dtDdPairs.every((pair) => pair.label.length > 0 && pair.value.length > 0) &&
        inspection.contactNameFieldPresent;
      if (sevenFieldsVisible) f8FieldPasses += 1;
      expect(
        sevenFieldsVisible,
        "F8: all seven deal fields (brand, fee, deadline, WhatsApp number, payment terms, scope, contact name) must be visible on /deal/:id",
      ).toBe(true);

      const indonesianDatePattern = /^\d{1,2} (Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des) \d{4}$/;
      f11DateFormatChecks += 1;
      const historyDatesFormatted =
        inspection.historyDates.length > 0 && inspection.historyDates.every((text) => indonesianDatePattern.test(text));
      if (historyDatesFormatted) f11DateFormatPasses += 1;
      expect(
        historyDatesFormatted,
        "F11: stage-history dates must render in the fixed Indonesian d MMM yyyy format regardless of UI language",
      ).toBe(true);
    });
    await captureOwnerMatrix(page, context, baseURL, "/invoice", "invoice-list", "populated", async () => {
      await expect(page.locator("main")).toBeVisible();
    });

    await login(context, baseURL, fixtures.sessions.owner);
    await goto200(page, `/invoice/${fixtures.invoices.sent}`);
    await createSentShare(page);
    await page.reload({ waitUntil: "networkidle" });
    await captureOwnerMatrix(page, context, baseURL, `/invoice/${fixtures.invoices.sent}`, "invoice-detail", "sent-link-active", async () => {
      await expect(page.getByText("UX/SENT/002", { exact: true }).first()).toBeVisible();
      // F9: the first interactive element in DOM order after the hero amount
      // must be the WhatsApp action row, not date housekeeping or anything
      // else -- checked directly against document order, not inferred from
      // which states got captured.
      const domOrder = await page.evaluate(() => {
        const money = document.querySelector(".ds-money.ds-display");
        if (!money) return null;
        const interactive = Array.from(
          document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button]'),
        );
        const firstAfterMoney = interactive.find(
          (element) => Boolean(money.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
        );
        if (!firstAfterMoney) return null;
        return { withinPrimaryActions: Boolean(firstAfterMoney.closest('[data-ux-action-row="invoice-primary-actions"]')) };
      });
      f9DomOrderChecks += 1;
      if (domOrder?.withinPrimaryActions) f9DomOrderPasses += 1;
      expect(domOrder, "F9: hero amount and a following interactive element must both exist").not.toBeNull();
      expect(domOrder?.withinPrimaryActions, "F9: the first interactive element after the amount must be the WhatsApp action").toBe(true);

      // F3: the sent-invoice share link must stay a single-line, non-wrapping
      // field -- the clipped track span's own scrollWidth must never exceed
      // its clientWidth (see share-link-field.tsx's own contract: only an
      // already-truncated string keeps this true) -- and the primary-actions
      // row it lives in must render on one line, not merely be absent from
      // the generic wrapped-action-row detector's findings list. Checked at
      // lg1024: the row intentionally stacks into a column below Tailwind's
      // 640px `sm:` breakpoint (see the `flex-col sm:flex-row` class on
      // `invoice-primary-actions`), so single-line is only the contract at
      // or above that breakpoint, not at every UX_VIEWPORTS width.
      await page.setViewportSize(UX_VIEWPORTS.lg1024);
      const shareLinkLayout = await page.evaluate(() => {
        const track = document.querySelector('[data-testid="share-link-track"]');
        const span = track?.querySelector(":scope > span");
        const actionRow = document.querySelector('[data-ux-action-row="invoice-primary-actions"]');
        const controls = actionRow
          ? (Array.from(actionRow.querySelectorAll(":scope > a[href],:scope > button,:scope > [role=button]")) as HTMLElement[])
          : [];
        const lines = [...new Set(controls.map((control) => Math.round(control.getBoundingClientRect().top)))];
        return {
          trackFound: Boolean(track && span),
          spanOverflows: span ? span.scrollWidth > span.clientWidth + 1 : null,
          actionRowSingleLine: lines.length <= 1,
        };
      });
      f3ShareLinkChecks += 1;
      const shareLinkOk = shareLinkLayout.trackFound && shareLinkLayout.spanOverflows === false && shareLinkLayout.actionRowSingleLine;
      if (shareLinkOk) f3ShareLinkPasses += 1;
      expect(shareLinkLayout.trackFound, "F3: the share-link track must be present").toBe(true);
      expect(shareLinkLayout.spanOverflows, "F3: the share-link text must be truncated to its track width, never overflowing it").toBe(false);
      expect(shareLinkLayout.actionRowSingleLine, "F3: the sent-invoice primary-actions row must render on a single line").toBe(true);
    });
    await captureOwnerMatrix(page, context, baseURL, "/pengaturan", "settings", "populated", async () => {
      await expect(page.locator("main")).toBeVisible();
    });

    await context.clearCookies();
    await goto200(page, `/i/${fixtures.publicTokens.active}`);
    await expect(page.locator("main.public-invoice")).toBeVisible();
    for (const viewport of Object.keys(UX_VIEWPORTS) as UxViewportKey[]) {
      await capture(page, "/i/[token]", "public-invoice", "active", viewport, "id");
    }
    await runPdfParity(page, baseURL);

    await captureZeroMatrix(page, context, baseURL, "/", "home", "zero-deals", async () => {
      await expect(page.getByText(/Belum ada deal|No deals yet/)).toBeVisible();
    });
    await captureZeroMatrix(page, context, baseURL, "/deal", "deal-board", "zero-deals", async () => {
      await expect(page.getByTestId("deal-board-rail")).toBeVisible();
      await expect(page.getByTestId("deal-board-rail").getByText("0", { exact: true })).toHaveCount(6);
      // F6: below the 640px stacking breakpoint, the rail must remain a
      // horizontally scrollable strip of scroll-snap-aligned stage sections
      // (never a tall vertical stack of six near-empty columns), and its own
      // box must stay bounded relative to the viewport -- checked directly
      // against the rail's overflow/scroll-snap CSS and geometry, not
      // inferred from total page height alone.
      await page.setViewportSize(UX_VIEWPORTS.sm390);
      await page.waitForTimeout(50);
      const rail = await page.evaluate(() => {
        const railEl = document.querySelector('[data-testid="deal-board-rail"]');
        if (!railEl) return null;
        const style = getComputedStyle(railEl);
        const sections = Array.from(railEl.querySelectorAll(":scope > section")) as HTMLElement[];
        return {
          overflowX: style.overflowX,
          scrollSnapType: style.scrollSnapType,
          scrollWidth: railEl.scrollWidth,
          clientWidth: railEl.clientWidth,
          sectionCount: sections.length,
          sectionsSnapAligned: sections.length > 0 && sections.every((section) => getComputedStyle(section).scrollSnapAlign !== "none"),
          railHeight: railEl.getBoundingClientRect().height,
          viewportHeight: window.innerHeight,
        };
      });
      f6RailChecks += 1;
      const railOk = rail !== null
        && (rail.overflowX === "auto" || rail.overflowX === "scroll")
        && rail.scrollSnapType.startsWith("x")
        && rail.scrollWidth > rail.clientWidth
        && rail.sectionCount === 6
        && rail.sectionsSnapAligned
        && rail.railHeight <= rail.viewportHeight * 1.5;
      if (railOk) f6RailPasses += 1;
      expect(rail, "F6: narrow deal-board rail must be present").not.toBeNull();
      expect(railOk, "F6: narrow deal-board rail must scroll horizontally with snap-aligned stage sections and a bounded height").toBe(true);
    });
    await captureZeroMatrix(page, context, baseURL, "/invoice", "invoice-list", "zero-invoices", async () => {
      await expect(page.getByText(/Belum ada invoice|No invoices yet/)).toBeVisible();
    });

    await login(context, baseURL, fixtures.sessions.owner);
    await goto200(page, "/");
    for (const language of languageVisitOrder("owner")) {
      await setLanguage(page, language, "owner");
      for (const viewport of Object.keys(UX_VIEWPORTS) as UxViewportKey[]) {
        await page.setViewportSize(UX_VIEWPORTS[viewport]);
        await page.locator('button[aria-haspopup="menu"]').click();
        await expect(page.getByRole("menu")).toBeVisible();
        // F2: the popover (not its backdrop -- [role="menu"] targets the
        // menu surface itself) must never overlap the income figure, at
        // every required width, not just the two widths the original defect
        // was reported at.
        const overlapsIncome = await rectanglesOverlap(page, '[role="menu"]', 'section[aria-labelledby="home-net-bulan-ini"]');
        f2OverlapChecks += 1;
        if (!overlapsIncome) f2OverlapPasses += 1;
        expect(overlapsIncome, `F2: account menu must not overlap the income figure at ${viewport}/${language}`).toBe(false);
        await capture(page, "/", "home", "account-menu-open", viewport, language);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).toBeHidden();
        accountMenuDismissals += 1;
      }
    }

    await exerciseInvalidContactFlow(page, context, baseURL);

    await context.clearCookies();
    // F7 / T-23 (see src/app/i/[token]/page.tsx): a token that exists but has
    // expired is a truthful, honest 200 with its own expired copy -- only an
    // unknown/revoked/malformed token gets the indistinguishable-from-probing
    // notFound() 404. Asserting 404 here would be testing the wrong contract.
    for (const viewport of ["sm390", "xl1440"] as const) {
      const response = await page.goto(`/i/${fixtures.publicTokens.expired}`, { waitUntil: "networkidle" });
      expect(response?.status(), "F7 expired-token page must respond 200 with the honest expired copy, not a 404").toBe(200);
      // page.getByRole("alert") resolves Next.js's empty route-announcer element
      // (also role="alert") before the page's own alert, so scope to main content.
      await expect(page.locator('main [role="alert"]')).toHaveText("Tautan ini sudah tidak berlaku.");
      await capture(page, "/i/[token]", "public-invoice", "expired", viewport, "id");
    }

    // A malformed token must still be indistinguishable from an unknown one
    // (both notFound()). Armed immediately before this one request and
    // disarmed immediately after, so the suppression can never leak onto a
    // console/page error from any other request in the run.
    expectingMalformedToken404 = true;
    try {
      const response = await page.goto("/i/not-a-real-token-000000000000", { waitUntil: "networkidle" });
      expect(response?.status(), "F7 malformed public token must still 404").toBe(404);
      // Phase 3 remediation (see OBSERVATIONS.md): this segment now has its
      // own branded not-found.tsx instead of falling through to Next's
      // generic default 404 -- same indistinguishable-from-any-other-404
      // contract, different (on-brand) copy.
      await expect(page.locator('main [role="alert"]')).toHaveText("Tautan ini tidak ditemukan.");
    } finally {
      expectingMalformedToken404 = false;
    }

    await captureZeroMatrix(page, context, baseURL, "/pengaturan", "settings", "incomplete-issuer-bank", async () => {
      await expect(page.getByText(/Lengkapi identitas|Complete your identity/)).toBeVisible();
    });

    expect(artifacts).toHaveLength(123);
    expect(new Set(artifacts.map((artifact) => artifact.path)).size, "T-27 capture paths must be unique").toBe(artifacts.length);
    expect(artifacts.every((artifact) => artifact.path.endsWith(deterministicCaptureName(artifact)))).toBe(true);
    expect(captureFailures, "T-27 detector/capture findings").toEqual([]);
    expect(consoleMessages, "T-27 console errors/warnings").toEqual([]);
    expect(pageErrors, "T-27 page errors").toEqual([]);
    expect(pdfParity.status, "T-27 PDF parity").toBe("verified");
    expect(movementEvidence).toEqual({ drag: "PASS", menu: "PASS", keyboard: "PASS" });
    findingEvidence = buildFindingEvidence();
    expect(findingEvidence).toHaveLength(15);
    expect(new Set(findingEvidence.map((finding) => finding.id)).size, "T-27 finding IDs must be unique").toBe(15);
    expect(findingEvidence.every((finding) => finding.status === "PASS" && finding.artifactPaths.length > 0 && finding.assertion.length > 0)).toBe(true);
    runStatus = "PASS";
  });
});
