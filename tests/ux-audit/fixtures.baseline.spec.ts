import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { capturePage, writeCaptureManifest, type CaptureArtifact } from "./support/capture";
import { detectHorizontalOverflow, detectSmallTouchTargets } from "./support/detectors";
import { compareDocumentFields, type DocumentField } from "./support/parity";
import { UX_LANGUAGES, UX_VIEWPORTS, type UxLanguage, type UxViewportKey } from "./support/viewports";

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

function extractPdfFields(pdfPath: string) {
  const rawText = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  const lines = rawText.split(/\r?\n/).map((line) => line.replace(/\s+$/, ""));
  const text = normalizeDocumentText(rawText);
  const lineContaining = (label: string) => {
    const index = lines.findIndex((line) => line.includes(label));
    if (index < 0) throw new Error(`Missing PDF label: ${label}`);
    return index;
  };
  const nextContentLine = (index: number) => {
    const next = lines.slice(index + 1).find((line) => line.trim().length > 0);
    if (!next) throw new Error(`Missing PDF value after line ${index + 1}`);
    return next;
  };

  lineContaining("DIBAYAR");
  const invoiceNumber = lines.find((line) => /^\s*[A-Z0-9]+(?:\/[A-Z0-9]+)+\s*$/.test(line));
  if (!invoiceNumber) throw new Error("Missing PDF invoice number");
  const billedLabelIndex = lineContaining("Ditagihkan kepada");
  const billedLabelLine = lines[billedLabelIndex];
  const dueColumn = billedLabelLine.indexOf("Jatuh tempo");
  if (dueColumn < 0) throw new Error("Missing PDF label: Jatuh tempo");
  const billedValueLine = nextContentLine(billedLabelIndex);
  const lineItemLabelIndex = lineContaining("Jasa kolaborasi");
  const taxLabelIndex = lineContaining("Pajak potong");
  const taxLabelLine = lines[taxLabelIndex];
  const totalLabelIndex = lineContaining("Total invoice");
  const totalLabelLine = lines[totalLabelIndex];

  const fields: DocumentField[] = [
    { key: "number", label: "Nomor invoice", value: invoiceNumber.trim() },
    { key: "billedTo", label: "Ditagihkan kepada", value: billedValueLine.slice(0, dueColumn).trim() },
    { key: "dueDate", label: "Jatuh tempo", value: billedValueLine.slice(dueColumn).trim() },
    { key: "scope", label: "Cakupan kerja", value: normalizeDocumentText(nextContentLine(lineItemLabelIndex)) },
    { key: "tax", label: "Pajak potong", value: taxLabelLine.slice(taxLabelLine.indexOf("Pajak potong") + "Pajak potong".length).trim() },
    { key: "total", label: "Nilai invoice", value: totalLabelLine.slice(totalLabelLine.indexOf("Total invoice") + "Total invoice".length).trim() },
  ];
  const sourceLabels = ["DIBAYAR", "Ditagihkan kepada", "Jatuh tempo", "Jasa kolaborasi", "Pajak potong", "Total invoice"];
  let cursor = 0;
  const positions: Record<string, number> = {};
  fields.forEach((field, index) => {
    const position = text.indexOf(sourceLabels[index], cursor);
    positions[field.key] = position;
    if (position >= 0) cursor = position + sourceLabels[index].length;
  });
  return { text, fields, positions, sourceLabels };
}

test.describe.serial("T-00 fixture-backed baseline", () => {
  test.beforeAll(async () => {
    fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as FixtureManifest;
  });

  test.afterAll(async () => {
    await mkdir(outputRoot, { recursive: true });
    await writeCaptureManifest(path.join(outputRoot, "capture-manifest.json"), artifacts);
    await writeFile(path.join(outputRoot, "geometry-findings.json"), `${JSON.stringify(geometryFindings, null, 2)}\n`, "utf8");
  });

  test("captures populated owner dashboard at five widths in ID and EN", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.owner);
    expect((await page.goto("/dashboard", { waitUntil: "networkidle" }))?.status()).toBe(200);

    for (const language of UX_LANGUAGES) {
      await setLanguage(page, language);
      const response = await page.reload({ waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.getByText("Brand Masuk", { exact: true })).toBeVisible();
      await expect(page.getByText("UX/OVERDUE/004", { exact: true }).first()).toBeVisible();
      for (const [viewport, size] of Object.entries(UX_VIEWPORTS) as Array<[UxViewportKey, { width: number; height: number }]>) {
        await page.setViewportSize(size);
        await captureAndMeasure(page, "/dashboard", "dashboard-current", "populated", viewport, language);
      }
    }
    await setLanguage(page, "id");
    expect(artifacts.filter((item) => item.routeKey === "dashboard-current")).toHaveLength(10);
  });

  test("captures zero-state owner and proves no cross-owner cards", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.zero);
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    const response = await page.goto("/dashboard", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Brand Masuk", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Other Owner Secret Brand", { exact: true })).toHaveCount(0);
    await expect(page.locator('a[href^="/dashboard/invoices/"]')).toHaveCount(0);
    await captureAndMeasure(page, "/dashboard", "dashboard-current", "zero-state", "sm390", "id");
  });

  test("enforces second-owner invoice isolation in both directions", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.other);
    expect((await page.goto(`/dashboard/invoices/${fixtures.invoices.draft}`))?.status()).toBe(404);
    await login(context, baseURL, fixtures.sessions.owner);
    expect((await page.goto(`/dashboard/invoices/${fixtures.invoices.other}`))?.status()).toBe(404);
  });

  test("captures no-tax/empty-date/invalid-phone and tax-bearing invoice detail", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.owner);
    await page.setViewportSize(UX_VIEWPORTS.sm390);

    let response = await page.goto(`/dashboard/invoices/${fixtures.invoices.draft}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("UX/DRAFT/001", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Bagikan via WhatsApp" })).toBeDisabled();
    await captureAndMeasure(page, "/dashboard/invoices/[id]", "invoice-detail-current", "draft-no-tax-empty-date-invalid-phone", "sm390", "id");

    response = await page.goto(`/dashboard/invoices/${fixtures.invoices.sent}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("PPh 21 (5%)", { exact: true })).toBeVisible();
    await captureAndMeasure(page, "/dashboard/invoices/[id]", "invoice-detail-current", "sent-tax", "sm390", "id");

    await setLanguage(page, "en");
    await page.setViewportSize(UX_VIEWPORTS.xl1440);
    await page.goto(`/dashboard/invoices/${fixtures.invoices.sent}`, { waitUntil: "networkidle" });
    await captureAndMeasure(page, "/dashboard/invoices/[id]", "invoice-detail-current", "sent-tax", "xl1440", "en");
    await setLanguage(page, "id");
  });

  test("records active, expired, and invalid public-token behavior", async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    const active = await page.goto(`/i/${fixtures.publicTokens.active}`, { waitUntil: "networkidle" });
    expect(active?.status()).toBe(200);
    await expect(page.getByText("UX/OVERDUE/004", { exact: true }).first()).toBeVisible();
    await captureAndMeasure(page, "/i/[token]", "public-invoice-current", "active-long-content", "sm390", "id");

    expect((await page.goto(`/i/${fixtures.publicTokens.expired}`))?.status()).toBe(404);
    expect((await page.goto(`/i/${fixtures.publicTokens.invalid}`))?.status()).toBe(404);
  });

  test("downloads owner/public PDFs and verifies canonical HTML/PDF parity", async ({ page, context, request, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await login(context, baseURL, fixtures.sessions.owner);
    const htmlResponse = await page.goto(`/i/${fixtures.publicTokens.active}`, { waitUntil: "networkidle" });
    expect(htmlResponse?.status()).toBe(200);
    const htmlFields = await page.locator("main.public-invoice").evaluate((main): DocumentField[] => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const headerLines = Array.from(main.querySelectorAll("header p")).map((element) => text(element));
      const details = new Map(Array.from(main.querySelectorAll("dl > div")).map((row) => [
        text(row.querySelector("dt")),
        text(row.querySelector("dd")),
      ]));
      return [
        { key: "number", label: "Nomor invoice", value: details.get("Nomor invoice") ?? "" },
        { key: "billedTo", label: "Ditagihkan kepada", value: (headerLines.find((line) => line.startsWith("Ditagihkan kepada ")) ?? "").replace("Ditagihkan kepada ", "") },
        { key: "dueDate", label: "Jatuh tempo", value: (headerLines.find((line) => line.startsWith("Jatuh tempo: ")) ?? "").replace("Jatuh tempo: ", "") },
        { key: "scope", label: "Cakupan kerja", value: details.get("Cakupan kerja") ?? "" },
        { key: "tax", label: "Pajak potong", value: details.get("Pajak potong") ?? "" },
        { key: "total", label: "Nilai invoice", value: details.get("Nilai invoice") ?? "" },
      ];
    });
    expect(htmlFields.every((field) => field.value.length > 0)).toBe(true);

    const ownerPdf = await context.request.get(`${baseURL}/api/invoices/${fixtures.invoices.overdue}/pdf`);
    expect(ownerPdf.status()).toBe(200);
    expect(ownerPdf.headers()["content-type"]).toContain("application/pdf");
    expect((await request.storageState()).cookies).toHaveLength(0);
    const publicPdf = await request.get(`${baseURL}/api/public/invoices/${fixtures.publicTokens.active}/pdf`);
    expect(publicPdf.status()).toBe(200);
    expect(publicPdf.headers()["content-type"]).toContain("application/pdf");
    await mkdir(path.join(outputRoot, "pdf"), { recursive: true });
    const ownerPdfPath = path.join(outputRoot, "pdf", "owner-overdue.pdf");
    const publicPdfPath = path.join(outputRoot, "pdf", "public-overdue.pdf");
    await writeFile(ownerPdfPath, await ownerPdf.body());
    await writeFile(publicPdfPath, await publicPdf.body());

    const ownerFields = extractPdfFields(ownerPdfPath);
    const publicFields = extractPdfFields(publicPdfPath);
    const ownerParity = compareDocumentFields(htmlFields, ownerFields.fields);
    const publicParity = compareDocumentFields(htmlFields, publicFields.fields);
    const expectedOrder = htmlFields.map((field) => field.key);
    const ownerOrder = expectedOrder.map((key) => ownerFields.positions[key]);
    const publicOrder = expectedOrder.map((key) => publicFields.positions[key]);
    const strictlyIncreasing = (values: number[]) => values.every((value, index) => value >= 0 && (index === 0 || value > values[index - 1]));
    const ownerPublicTextEqual = ownerFields.text === publicFields.text;

    expect(ownerParity.equal).toBe(true);
    expect(publicParity.equal).toBe(true);
    expect(strictlyIncreasing(ownerOrder)).toBe(true);
    expect(strictlyIncreasing(publicOrder)).toBe(true);
    expect(ownerPublicTextEqual).toBe(true);

    await writeFile(path.join(outputRoot, "pdf", "parity-report.json"), `${JSON.stringify({
      htmlFields,
      ownerParity,
      publicParity,
      ownerOrder,
      publicOrder,
      ownerSourceLabels: ownerFields.sourceLabels,
      publicSourceLabels: publicFields.sourceLabels,
      ownerPublicTextEqual,
    }, null, 2)}\n`, "utf8");
  });
});
