import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { capturePage, writeCaptureManifest, type CaptureArtifact } from "./support/capture";
import { detectHorizontalOverflow, detectSmallTouchTargets } from "./support/detectors";
import { UX_LANGUAGES, UX_VIEWPORTS, type UxLanguage, type UxViewportKey } from "./support/viewports";

const outputRoot = path.resolve("test-results/ux-audit/baseline");
const artifacts: CaptureArtifact[] = [];
const findings: Array<{
  viewport: UxViewportKey;
  language: UxLanguage;
  overflow: Awaited<ReturnType<typeof detectHorizontalOverflow>>;
  smallTouchTargets: Awaited<ReturnType<typeof detectSmallTouchTargets>>;
}> = [];
const runtimeDiagnostics = {
  consoleErrors: [] as string[],
  pageErrors: [] as string[],
  hydrationMessages: [] as string[],
};

test.describe("T-00 current landing baseline", () => {
  test.afterAll(async () => {
    await mkdir(outputRoot, { recursive: true });
    await writeCaptureManifest(path.join(outputRoot, "capture-manifest.json"), artifacts);
    await writeFile(path.join(outputRoot, "detector-findings.json"), `${JSON.stringify(findings, null, 2)}\n`, "utf8");
    await writeFile(path.join(outputRoot, "runtime-diagnostics.json"), `${JSON.stringify(runtimeDiagnostics, null, 2)}\n`, "utf8");
  });

  test("captures five widths and both UI languages without treating baseline findings as regressions", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    const origin = new URL(baseURL);
    page.on("console", (message) => {
      const text = message.text();
      if (/hydration|hydrated|server rendered html/i.test(text)) runtimeDiagnostics.hydrationMessages.push(text);
      if (message.type() === "error") runtimeDiagnostics.consoleErrors.push(text);
    });
    page.on("pageerror", (error) => runtimeDiagnostics.pageErrors.push(error.message));

    for (const [viewport, size] of Object.entries(UX_VIEWPORTS) as Array<[UxViewportKey, { width: number; height: number }]>) {
      for (const language of UX_LANGUAGES) {
        await page.setViewportSize(size);
        await context.clearCookies();
        await context.addCookies([{
          name: "dibayar-language",
          value: language,
          domain: origin.hostname,
          path: "/",
          sameSite: "Lax",
        }]);
        await page.goto("/", { waitUntil: "networkidle" });
        await expect(page.locator("main")).toBeVisible();
        artifacts.push(await capturePage(page, path.join(outputRoot, "captures"), "/", {
          routeKey: "landing-current",
          stateKey: "anonymous",
          viewport,
          language,
        }));
        findings.push({
          viewport,
          language,
          overflow: await detectHorizontalOverflow(page),
          smallTouchTargets: await detectSmallTouchTargets(page),
        });
      }
    }

    expect(artifacts).toHaveLength(10);
    expect(findings).toHaveLength(10);
    expect(runtimeDiagnostics.consoleErrors).toEqual([]);
    expect(runtimeDiagnostics.pageErrors).toEqual([]);
    expect(runtimeDiagnostics.hydrationMessages).toEqual([]);
  });
});
