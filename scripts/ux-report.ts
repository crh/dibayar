#!/usr/bin/env node
// Generates artifacts/ux-audit/UX-AUDIT-REPORT.md from the JSON output of
// two already-completed Playwright runs:
//   - test-results/ux-audit/results.json   (playwright.config.ts: the
//     deterministic/state/synthetic tests/ux-audit specs)
//   - test-results/e2e/results.json        (playwright.e2e.config.ts,
//     filtered to @visual: the existing, stable visual-regression suite --
//     see routes/matrix.spec.ts's header comment for why pixel diffing
//     isn't re-implemented inside tests/ux-audit)
//
// This script does no browser/DB work itself -- see scripts/ux-audit.ts,
// which runs both suites in order and then calls this. Severity/category
// rules are deliberately file-path-based (not per-assertion), documented in
// docs/testing/UX_AUDIT.md "Severity model", so where a failure lands is
// reviewable by reading this file, not implicit in scattered test code.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type CategoryStatus = "PASS" | "FAIL" | "NOT_RUN";

type PwTestResult = { status: string; errors: Array<{ message?: string }> };
type PwTest = { results: PwTestResult[] };
type PwSpec = { title: string; ok: boolean; file: string; line: number; tests: PwTest[] };
type PwSuite = { title: string; file: string; specs?: PwSpec[]; suites?: PwSuite[] };
type PwResults = {
  suites: PwSuite[];
  stats: { expected: number; unexpected: number; skipped: number; flaky: number };
  // Playwright's own top-level fatal-error slot (global setup throwing,
  // webServer failing to start, etc.). Populated with an empty `suites`
  // array in exactly this case, which -- unless checked for explicitly --
  // reads to every category below as "NOT_RUN" (nothing to report) rather
  // than the CRITICAL infrastructure failure it actually is. See
  // "Infrastructure failure" handling in main().
  errors?: Array<{ message?: string }>;
};

type Finding = {
  id: string;
  severity: Severity;
  category: string;
  route: string;
  viewport: string;
  state: string;
  description: string;
  expected: string;
  evidence: string;
  assertion: string;
};

type CaptureManifestEntry = {
  routeKey: string;
  stateKey: string;
  viewport: string;
  language: string;
  path: string;
  route: string;
};

const uxAuditResultsPath = path.resolve("test-results/ux-audit/results.json");
const e2eResultsPath = path.resolve("test-results/e2e/results.json");
const captureManifestPath = path.resolve("artifacts/ux-audit/manifest.json");
const reportPath = path.resolve("artifacts/ux-audit/UX-AUDIT-REPORT.md");
const aiReviewManifestPath = path.resolve("artifacts/ux-audit/ai-review-manifest.json");

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function flattenSpecs(suites: PwSuite[]): PwSpec[] {
  const specs: PwSpec[] = [];
  for (const suite of suites) {
    if (suite.specs) specs.push(...suite.specs);
    if (suite.suites) specs.push(...flattenSpecs(suite.suites));
  }
  return specs;
}

type Category = "detector-self-check" | "responsive-layout" | "state-data" | "functional-regression";

// Built from String.fromCharCode rather than a regex literal containing a
// raw escape byte, so Playwright's colored error text (ANSI SGR codes) can
// be stripped before it's embedded in the markdown report without an
// invisible control character sitting in this source file.
const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
}

function categoryForFile(file: string): Category {
  if (file.startsWith("synthetic/")) return "detector-self-check";
  if (file.startsWith("routes/")) return "responsive-layout";
  if (file.startsWith("states/")) return "state-data";
  return "functional-regression"; // baseline.landing, fixtures.baseline, detectors.selftest, t27.verification
}

function severityForCategory(category: Category): Severity {
  // A broken detector (detector-self-check) or a real desktop-scroll/
  // overflow regression (responsive-layout) can silently pass bad UX
  // through the whole harness -- CRITICAL. State/data and legacy functional
  // regressions are user-visible but narrower in blast radius -- HIGH. See
  // docs/testing/UX_AUDIT.md "Severity model" for the full rationale and
  // how to register a MEDIUM/LOW-only check if one is ever added.
  if (category === "detector-self-check" || category === "responsive-layout") return "CRITICAL";
  return "HIGH";
}

function statusFor(specs: PwSpec[], category: Category): CategoryStatus {
  const matching = specs.filter((spec) => categoryForFile(spec.file) === category);
  if (matching.length === 0) return "NOT_RUN";
  return matching.every((spec) => spec.ok) ? "PASS" : "FAIL";
}

function parseRouteContext(spec: PwSpec): { route: string; viewport: string; state: string } {
  // Best-effort extraction from the test title for report readability only
  // -- never used for gating. Titles that don't match just report "n/a".
  const viewportMatch = spec.title.match(/\b(mobile375|tablet768|laptop1280|desktop1440|desktop1920)\b/);
  return { route: spec.file, viewport: viewportMatch?.[1] ?? "n/a", state: "n/a" };
}

function buildFindings(specs: PwSpec[]): Finding[] {
  const findings: Finding[] = [];
  let counter = 1;
  for (const spec of specs) {
    if (spec.ok) continue;
    const category = categoryForFile(spec.file);
    const severity = severityForCategory(category);
    const failingResult = spec.tests.flatMap((t) => t.results).find((r) => r.status !== "passed");
    const rawMessage = failingResult?.errors[0]?.message?.split("\n")[0];
    const message = rawMessage ? stripAnsi(rawMessage) : "See test-results/ux-audit for details.";
    const { route, viewport, state } = parseRouteContext(spec);
    findings.push({
      id: `UX-${String(counter).padStart(3, "0")}`,
      severity,
      category,
      route,
      viewport,
      state,
      description: `${spec.title}: ${message}`,
      expected: "Test passes -- see the spec file for the exact assertion.",
      evidence: `${spec.file}:${spec.line}`,
      assertion: message,
    });
    counter += 1;
  }
  return findings;
}

function renderStatus(status: CategoryStatus): string {
  return status;
}

async function main() {
  const uxAuditResults = await readJsonIfExists<PwResults>(uxAuditResultsPath);
  const e2eResults = await readJsonIfExists<PwResults>(e2eResultsPath);
  const captureManifest = await readJsonIfExists<{ artifacts: CaptureManifestEntry[] }>(captureManifestPath);

  const uxAuditSpecs = uxAuditResults ? flattenSpecs(uxAuditResults.suites) : [];
  const e2eSpecs = e2eResults ? flattenSpecs(e2eResults.suites) : [];

  // A Playwright run that fails before it can collect/execute any test
  // (webServer failed to start, global setup threw, etc.) still writes a
  // valid results.json -- with an empty `suites` array and the fatal error
  // recorded in the top-level `errors` array instead of any spec. Every
  // category status below is file-derived from `suites`, so this shape
  // reads as "nothing in this category ran" (NOT_RUN) rather than the
  // CRITICAL infrastructure failure it is -- and NOT_RUN does not fail the
  // gate. Surface it as an explicit, unmissable finding instead of letting
  // a run that tested nothing report a clean pass.
  const infrastructureFailures: Finding[] = [];
  for (const [label, results] of [
    ["tests/ux-audit", uxAuditResults] as const,
    ["e2e @visual", e2eResults] as const,
  ]) {
    const fatalErrors = results?.errors ?? [];
    if (fatalErrors.length > 0) {
      infrastructureFailures.push({
        id: `UX-INFRA-${label.replace(/[^a-z0-9]+/gi, "-")}`,
        severity: "CRITICAL",
        category: "infrastructure-failure",
        route: "n/a",
        viewport: "n/a",
        state: "n/a",
        description: `${label} run reported a fatal error before any test could be collected/executed: ${stripAnsi(fatalErrors[0]?.message ?? "unknown error")}`,
        expected: "The Playwright run starts its webServer/global setup successfully and collects at least one test.",
        evidence: label === "tests/ux-audit" ? uxAuditResultsPath : e2eResultsPath,
        assertion: stripAnsi(fatalErrors[0]?.message ?? "unknown error"),
      });
    }
  }

  const uxAuditInfraFailed = (uxAuditResults?.errors?.length ?? 0) > 0;
  const e2eInfraFailed = (e2eResults?.errors?.length ?? 0) > 0;

  const functionalStatus: CategoryStatus = uxAuditInfraFailed
    ? "FAIL"
    : uxAuditResults
      ? (["detector-self-check", "functional-regression"] as const).every(
          (category) => statusFor(uxAuditSpecs, category) !== "FAIL",
        )
        ? "PASS"
        : "FAIL"
      : "NOT_RUN";
  const responsiveLayoutStatus: CategoryStatus = uxAuditInfraFailed ? "FAIL" : statusFor(uxAuditSpecs, "responsive-layout");
  const stateDataStatus: CategoryStatus = uxAuditInfraFailed ? "FAIL" : statusFor(uxAuditSpecs, "state-data");
  const visualRegressionStatus: CategoryStatus = e2eInfraFailed
    ? "FAIL"
    : e2eResults
      ? e2eSpecs.length > 0 && e2eSpecs.every((spec) => spec.ok)
        ? "PASS"
        : e2eSpecs.length === 0
          ? "NOT_RUN"
          : "FAIL"
      : "NOT_RUN";

  const findings = [
    ...infrastructureFailures,
    ...buildFindings(uxAuditSpecs),
    ...buildFindings(e2eSpecs).map((finding) => ({ ...finding, category: "visual-regression" as const })),
  ];
  const bySeverityOrder: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  findings.sort((a, b) => bySeverityOrder.indexOf(a.severity) - bySeverityOrder.indexOf(b.severity));

  const gateFailingFindings = findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH");
  const overallStatus = gateFailingFindings.length > 0 ? "FAIL" : uxAuditResults ? "PASS" : "NOT_RUN";

  const lines: string[] = [];
  lines.push("# UX Audit Report", "");
  lines.push(`Generated: ${new Date().toISOString()}`, "");
  lines.push("## Functional status", "", `${renderStatus(functionalStatus)}`, "");
  lines.push("## Responsive/Layout status", "", `${renderStatus(responsiveLayoutStatus)}`, "");
  lines.push("## State/Data status", "", `${renderStatus(stateDataStatus)}`, "");
  lines.push("## Visual Regression status", "", `${renderStatus(visualRegressionStatus)}`, "");
  lines.push("## UX findings", "");
  if (findings.length === 0) {
    lines.push("No findings.", "");
  } else {
    for (const finding of findings) {
      lines.push(
        "```yaml",
        `id: ${finding.id}`,
        `severity: ${finding.severity}`,
        `category: ${finding.category}`,
        `route: ${finding.route}`,
        `viewport: ${finding.viewport}`,
        `state: ${finding.state}`,
        `description: ${JSON.stringify(finding.description)}`,
        `expected: ${JSON.stringify(finding.expected)}`,
        `evidence: ${finding.evidence}`,
        "```",
        "",
      );
    }
  }
  lines.push("## Overall status", "", overallStatus, "");
  lines.push(
    "## Screenshot corpus",
    "",
    captureManifest ? `${captureManifest.artifacts.length} curated screenshots under artifacts/ux-audit/screenshots/ (see manifest.json).` : "Not generated this run.",
    "",
  );
  lines.push(
    "## Severity gate",
    "",
    "CRITICAL and HIGH findings fail the gate (`npm run ux:audit` exits non-zero). MEDIUM/LOW are reported only. See docs/testing/UX_AUDIT.md \"Severity model\".",
    "",
  );

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");

  if (captureManifest) {
    const matrixFindingsPath = path.resolve("artifacts/ux-audit/matrix-findings.json");
    const matrixFindings = await readJsonIfExists<unknown[]>(matrixFindingsPath);
    await writeFile(
      aiReviewManifestPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          note: "Consumed by a later, separate AI review pass (see docs/testing/UX_AUDIT.md 'AI review'). Not read by ux:audit's own gate.",
          screenshots: captureManifest.artifacts,
          deterministicFindings: matrixFindings ?? [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  console.log(
    JSON.stringify({
      functionalStatus,
      responsiveLayoutStatus,
      stateDataStatus,
      visualRegressionStatus,
      overallStatus,
      findingCount: findings.length,
      gateFailingFindingCount: gateFailingFindings.length,
      reportPath: path.relative(process.cwd(), reportPath),
    }),
  );

  process.exitCode = overallStatus === "FAIL" ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 2;
});
