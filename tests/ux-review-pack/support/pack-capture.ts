import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { UxMatrixViewportKey } from "../../ux-audit/support/viewport-matrix";
import type { UxSessionKey } from "../../ux-audit/support/session";

// Screenshot sequence + manifest builder for the UX Review Pack V2 capture
// (see the pasted spec's Phase 5/6). Deliberately separate from
// tests/ux-audit/support/capture.ts: that module's CaptureDescriptor/manifest
// schema is route+state+viewport keyed for the curated corpus, not
// journey+step+persona+state-type keyed as Phase 6 requires here. Reuses
// tests/ux-audit's viewport-matrix/session fixtures instead of duplicating them.

export type StateType =
  | "baseline"
  | "empty"
  | "interaction"
  | "validation"
  | "error"
  | "success"
  | "transition";

export type ManifestEntry = {
  journeyId: string;
  stepId: string;
  screenshot: string;
  route: string;
  viewport: UxMatrixViewportKey;
  fixturePersona: UxSessionKey | "public";
  dataState: string;
  userAction: string;
  expectedOutcome: string;
  expectedPrimaryCta: string | null;
  stateType: StateType;
  externalActionIntent: string | null;
  passedFunctionalAssertions: boolean;
};

const SCREENSHOT_ROOT = path.resolve("ux-review-pack/screenshots");
const MANIFEST_PATH = path.resolve("ux-review-pack/manifest.json");

const entries: ManifestEntry[] = [];

export type CaptureStepInput = {
  journeyId: string;
  journeySlug: string;
  step: number;
  description: string;
  route: string;
  viewport: UxMatrixViewportKey;
  fixturePersona: UxSessionKey | "public";
  dataState: string;
  userAction: string;
  expectedOutcome: string;
  expectedPrimaryCta?: string | null;
  stateType: StateType;
  externalActionIntent?: string | null;
  passedFunctionalAssertions: boolean;
};

export async function captureStep(page: Page, input: CaptureStepInput): Promise<string> {
  const journeyDir = `${input.journeyId}-${input.journeySlug}`;
  const stepLabel = String(input.step).padStart(2, "0");
  const fileName = `${stepLabel}-${input.description}-${input.viewport}.png`;
  const outputDir = path.join(SCREENSHOT_ROOT, journeyDir);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, fileName);
  await page.screenshot({ path: outputPath, fullPage: true, animations: "disabled" });

  const relativePath = path.posix.join("screenshots", journeyDir, fileName);
  entries.push({
    journeyId: input.journeyId,
    stepId: `${input.journeyId}-S${stepLabel}`,
    screenshot: relativePath,
    route: input.route,
    viewport: input.viewport,
    fixturePersona: input.fixturePersona,
    dataState: input.dataState,
    userAction: input.userAction,
    expectedOutcome: input.expectedOutcome,
    expectedPrimaryCta: input.expectedPrimaryCta ?? null,
    stateType: input.stateType,
    externalActionIntent: input.externalActionIntent ?? null,
    passedFunctionalAssertions: input.passedFunctionalAssertions,
  });
  return relativePath;
}

export async function writePackManifest() {
  const sorted = [...entries].sort((a, b) => a.stepId.localeCompare(b.stepId));
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify({ schemaVersion: 1, count: sorted.length, entries: sorted }, null, 2)}\n`,
    "utf8",
  );
}

export function getCapturedJourneyIds(): string[] {
  return [...new Set(entries.map((entry) => entry.journeyId))].sort();
}

export function getEntryCount(): number {
  return entries.length;
}
