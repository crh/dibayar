import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { UxLanguage } from "./viewports";

export type CaptureDescriptor = {
  routeKey: string;
  stateKey: string;
  // A viewport-set key (see ./viewports.ts's UxViewportKey and
  // ./viewport-matrix.ts's UxMatrixViewportKey). Kept as a plain string
  // here so capture.ts doesn't couple every caller to one specific viewport
  // set; deterministicCaptureName's own kebab-case validation is what keeps
  // this safe, not the type.
  viewport: string;
  language: UxLanguage;
};

export type CaptureArtifact = CaptureDescriptor & {
  path: string;
  route: string;
  width: number;
  height: number;
  fullPage: true;
};

const SAFE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSafeSegment(value: string, label: string) {
  if (!SAFE_SEGMENT.test(value)) throw new Error(`${label} must be lowercase kebab-case: ${value}`);
}

export function deterministicCaptureName(input: CaptureDescriptor): string {
  assertSafeSegment(input.routeKey, "routeKey");
  assertSafeSegment(input.stateKey, "stateKey");
  return `${input.routeKey}__${input.stateKey}__${input.viewport}__${input.language}.png`;
}

export async function capturePage(
  page: Page,
  outputDir: string,
  route: string,
  descriptor: CaptureDescriptor,
): Promise<CaptureArtifact> {
  const fileName = deterministicCaptureName(descriptor);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, fileName);
  await page.screenshot({ path: outputPath, fullPage: true, animations: "disabled" });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Capture requires an explicit viewport");
  return {
    ...descriptor,
    path: path.posix.join(path.basename(outputDir), fileName),
    route,
    width: viewport.width,
    height: viewport.height,
    fullPage: true,
  };
}

export async function writeCaptureManifest(outputPath: string, artifacts: CaptureArtifact[]) {
  const sorted = [...artifacts].sort((a, b) => a.path.localeCompare(b.path));
  const unique = new Set(sorted.map((item) => item.path));
  if (unique.size !== sorted.length) throw new Error("Duplicate deterministic capture path");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ schemaVersion: 1, count: sorted.length, artifacts: sorted }, null, 2)}\n`,
    "utf8",
  );
}
