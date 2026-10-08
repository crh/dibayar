// Reads the text of a downloaded invoice PDF with poppler's pdftotext, the
// same tool the ux-audit specs use (docs/testing/UX_AUDIT.md). The suite
// needs the `pdftotext` binary (poppler-utils); CI installs it in every job
// that runs these tests.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Download, Locator, Page, TestInfo } from "@playwright/test";
import { expect } from "./test";

// Whitespace-normalized text: -layout keeps each label next to its value,
// and collapsing runs of spaces (including the non-breaking space after
// "Rp") makes the result independent of column padding.
export function pdfText(pdfPath: string): string {
  expect(readFileSync(pdfPath).subarray(0, 5).toString(), "the download is a PDF").toBe("%PDF-");
  const raw = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  return raw
    .split("\n")
    .map((line) => line.replace(/[\s ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// Clicks a visible PDF link and waits for the browser's own download. The
// file is kept only under this test's output directory.
export async function downloadPdfByClick(page: Page, link: Locator, testInfo: TestInfo, saveAs: string): Promise<{ download: Download; path: string; text: string }> {
  await expect(link).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = testInfo.outputPath(saveAs);
  await download.saveAs(path);
  return { download, path, text: pdfText(path) };
}
