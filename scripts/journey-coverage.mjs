#!/usr/bin/env node
// Validates docs/testing/journey-coverage.json (the user-action inventory)
// and generates docs/testing/JOURNEY-COVERAGE.md from it.
//
//   node scripts/journey-coverage.mjs check   # validate + report is current
//   node scripts/journey-coverage.mjs report  # validate + rewrite the report
//
// Metrics come only from the inventory and the referenced test files; nothing
// is estimated. Validation is deterministic and needs no browser, build or
// database, so it is cheap enough to run on every PR.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STATUSES = [
  "automated_real_interaction",
  "automated_partial",
  "manual_verified",
  "manual_pending",
  "not_covered",
  "blocked",
  "not_applicable",
];
export const PRIORITIES = ["P0", "P1", "P2"];
export const TEST_KINDS = ["real", "partial", "expected_failure"];
const ID_PATTERN = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/;
const REQUIRED_TEXT = ["domain", "route", "action", "persona", "interaction", "expected"];
// Action IDs mentioned in companion docs must exist in the inventory.
// The lookbehind keeps "MAN-DEAL-01" (a manual check) from reading as "DEAL-01".
const ACTION_REF_PATTERN = /(?<![A-Za-z0-9-])(?:AUTH|HOME|NAV|DEAL|INV|SHARE|PUB|SET|A11Y)(?:-[A-Z0-9]+)+\b/g;
const MANUAL_REF_PATTERN = /\bMAN-[A-Z0-9]+-\d+\b/g;

export const PATHS = {
  inventory: "docs/testing/journey-coverage.json",
  report: "docs/testing/JOURNEY-COVERAGE.md",
  graphs: "docs/testing/JOURNEY-GRAPHS.md",
  manual: "docs/testing/MANUAL-UAT.md",
  backlog: "docs/testing/JOURNEY-BACKLOG.md",
};

// readFile is injectable so the self-test can validate synthetic inventories
// without touching the real repository files.
export function validateInventory(inventory, { readFile, fileExists }) {
  const errors = [];
  const actions = Array.isArray(inventory?.actions) ? inventory.actions : null;
  if (!actions) return ["inventory.actions must be an array"];
  const findings = new Map((inventory.findings ?? []).map((finding) => [finding.id, finding]));
  const manualDoc = fileExists(PATHS.manual) ? readFile(PATHS.manual) : "";
  const manualIds = new Set(manualDoc.match(MANUAL_REF_PATTERN) ?? []);
  const seen = new Set();
  const fileCache = new Map();

  for (const [index, action] of actions.entries()) {
    const where = action?.id ? `${action.id}` : `actions[${index}]`;
    if (!action?.id || !ID_PATTERN.test(action.id)) errors.push(`${where}: invalid or missing id`);
    else if (seen.has(action.id)) errors.push(`${where}: duplicate id`);
    else seen.add(action.id);

    if (!PRIORITIES.includes(action.priority)) errors.push(`${where}: priority must be one of ${PRIORITIES.join(", ")}`);
    if (!STATUSES.includes(action.status)) errors.push(`${where}: status must be one of ${STATUSES.join(", ")}`);

    if (action.status !== "not_applicable") {
      for (const field of REQUIRED_TEXT) {
        if (typeof action[field] !== "string" || action[field].trim() === "") errors.push(`${where}: missing ${field}`);
      }
      // Scope may stay empty only while nothing covers the action yet.
      const hasScope = Array.isArray(action.scope) && action.scope.length > 0;
      if (!hasScope && action.status !== "not_covered") {
        errors.push(`${where}: scope must list at least one browser/project or manual target`);
      }
    }

    const tests = action.tests ?? [];
    if (!Array.isArray(tests)) {
      errors.push(`${where}: tests must be an array`);
      continue;
    }
    for (const [testIndex, ref] of tests.entries()) {
      const refWhere = `${where}.tests[${testIndex}]`;
      if (!TEST_KINDS.includes(ref?.kind)) errors.push(`${refWhere}: kind must be one of ${TEST_KINDS.join(", ")}`);
      if (typeof ref?.file !== "string" || ref.file === "") {
        errors.push(`${refWhere}: missing file`);
        continue;
      }
      if (!fileExists(ref.file)) {
        errors.push(`${refWhere}: file not found: ${ref.file}`);
        continue;
      }
      if (ref.title) {
        if (!fileCache.has(ref.file)) fileCache.set(ref.file, readFile(ref.file));
        if (!fileCache.get(ref.file).includes(ref.title)) errors.push(`${refWhere}: title not found in ${ref.file}: "${ref.title}"`);
      } else if (ref.kind === "real") {
        errors.push(`${refWhere}: a "real" test reference must name the test title`);
      }
    }

    const kinds = new Set(tests.map((ref) => ref.kind));
    switch (action.status) {
      case "automated_real_interaction":
        if (!kinds.has("real")) errors.push(`${where}: automated_real_interaction needs at least one test with kind "real"`);
        break;
      case "automated_partial":
        if (tests.length === 0) errors.push(`${where}: automated_partial needs at least one test reference`);
        if (kinds.has("real")) errors.push(`${where}: has a "real" test but is marked automated_partial -- pick one`);
        break;
      case "manual_verified":
        if (!action.manualCheck) errors.push(`${where}: manual_verified needs manualCheck`);
        if (!action.evidence) errors.push(`${where}: manual_verified needs evidence (environment, date, result)`);
        break;
      case "manual_pending":
        if (!action.manualCheck) errors.push(`${where}: manual_pending needs manualCheck`);
        break;
      case "not_covered":
        if (kinds.has("real")) errors.push(`${where}: has a "real" test but is marked not_covered`);
        if (!action.followUp) errors.push(`${where}: not_covered needs followUp`);
        break;
      case "blocked":
      case "not_applicable":
        if (!action.reason) errors.push(`${where}: ${action.status} needs reason`);
        break;
      default:
        break;
    }
    if (kinds.has("expected_failure") && action.status === "automated_real_interaction") {
      errors.push(`${where}: an expected-failure test cannot be the coverage for automated_real_interaction`);
    }
    if (action.manualCheck && !manualIds.has(action.manualCheck)) {
      errors.push(`${where}: manualCheck ${action.manualCheck} not found in ${PATHS.manual}`);
    }
    if (action.finding && !findings.has(action.finding)) errors.push(`${where}: unknown finding ${action.finding}`);
  }

  for (const finding of findings.values()) {
    for (const ref of finding.actions ?? []) {
      if (!seen.has(ref)) errors.push(`${finding.id}: references unknown action ${ref}`);
    }
  }

  for (const doc of [PATHS.graphs, PATHS.manual, PATHS.backlog]) {
    if (!fileExists(doc)) {
      errors.push(`missing companion doc ${doc}`);
      continue;
    }
    for (const ref of new Set(readFile(doc).match(ACTION_REF_PATTERN) ?? [])) {
      if (!seen.has(ref)) errors.push(`${doc}: references unknown action ${ref}`);
    }
  }
  return errors;
}

export function computeMetrics(inventory) {
  const actions = inventory.actions;
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const byPriority = Object.fromEntries(PRIORITIES.map((priority) => [priority, Object.fromEntries(STATUSES.map((status) => [status, 0]))]));
  for (const action of actions) {
    byStatus[action.status] += 1;
    byPriority[action.priority][action.status] += 1;
  }
  const denominator = actions.length - byStatus.not_applicable;
  const pct = (count, total) => (total === 0 ? "n/a" : `${((100 * count) / total).toFixed(1)}%`);
  const priorityDenominator = (priority) => actions.filter((action) => action.priority === priority && action.status !== "not_applicable").length;
  const outstanding = actions.filter(
    (action) => ["P0", "P1"].includes(action.priority) && !["automated_real_interaction", "manual_verified", "not_applicable"].includes(action.status),
  );
  return {
    total: actions.length,
    excluded: byStatus.not_applicable,
    denominator,
    byStatus,
    byPriority,
    realPct: pct(byStatus.automated_real_interaction, denominator),
    manualVerifiedPct: pct(byStatus.manual_verified, denominator),
    p0RealPct: pct(byPriority.P0.automated_real_interaction, priorityDenominator("P0")),
    p0Denominator: priorityDenominator("P0"),
    outstanding,
  };
}

function cell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function testSummary(action) {
  const refs = action.tests ?? [];
  if (refs.length === 0) return "—";
  return refs
    .map((ref) => `${ref.kind === "real" ? "R" : ref.kind === "partial" ? "P" : "XF"}: \`${ref.file.replace(/^e2e\//, "")}\``)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join("<br>");
}

export function renderReport(inventory) {
  const metrics = computeMetrics(inventory);
  const lines = [];
  lines.push("# Journey coverage report");
  lines.push("");
  lines.push("<!-- GENERATED by `npm run coverage:journeys:report` from docs/testing/journey-coverage.json. Do not edit by hand; `npm run coverage:journeys` fails when this file is stale. -->");
  lines.push("");
  lines.push(`Inventory date: ${inventory.inventoryDate} · Baseline: ${inventory.baseline}`);
  lines.push("");
  lines.push("An entry in this inventory is not proof that the action works. Only `automated_real_interaction` (a browser test drives the visible control and checks the outcome) and `manual_verified` (recorded human check) count as verified. CI-green is not release readiness: see the outstanding P0/P1 list below and `docs/testing/MANUAL-UAT.md`.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Inventoried user-facing actions: **${metrics.total}** (${metrics.excluded} not applicable, so the denominator is **${metrics.denominator}**)`);
  lines.push(`- Automated real-interaction coverage: **${metrics.byStatus.automated_real_interaction}/${metrics.denominator} = ${metrics.realPct}**`);
  lines.push(`- P0 automated real-interaction coverage: **${metrics.byPriority.P0.automated_real_interaction}/${metrics.p0Denominator} = ${metrics.p0RealPct}**`);
  lines.push(`- Manually verified (recorded): **${metrics.byStatus.manual_verified}/${metrics.denominator} = ${metrics.manualVerifiedPct}**`);
  lines.push(`- Outstanding P0/P1 actions: **${metrics.outstanding.length}**`);
  lines.push("");
  lines.push("| Status | " + PRIORITIES.join(" | ") + " | Total |");
  lines.push("|---|" + PRIORITIES.map(() => "---:").join("|") + "|---:|");
  for (const status of STATUSES) {
    lines.push(`| \`${status}\` | ${PRIORITIES.map((priority) => metrics.byPriority[priority][status]).join(" | ")} | ${metrics.byStatus[status]} |`);
  }
  lines.push("");
  lines.push("## Outstanding P0/P1 actions");
  lines.push("");
  lines.push("| ID | Priority | Status | Action | Next step |");
  lines.push("|---|---|---|---|---|");
  for (const action of [...metrics.outstanding].sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id))) {
    lines.push(`| ${action.id} | ${action.priority} | \`${action.status}\` | ${cell(action.action)} | ${cell(action.followUp ?? action.reason ?? action.manualCheck ?? "")} |`);
  }
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("| ID | Severity | Summary | Status | Actions |");
  lines.push("|---|---|---|---|---|");
  for (const finding of inventory.findings ?? []) {
    lines.push(`| ${finding.id} | ${finding.severity} | ${cell(finding.summary)} | ${cell(finding.status)} | ${(finding.actions ?? []).join(", ")} |`);
  }
  lines.push("");
  lines.push("## All actions by domain");
  lines.push("");
  lines.push("Test kinds: **R** = real interaction, **P** = partial (URL entry, `fill()` on a picker, API/request, mock, render/scan only), **XF** = expected failure documenting a known defect (never counted).");
  const domains = [...new Set(inventory.actions.map((action) => action.domain))];
  for (const domain of domains) {
    lines.push("");
    lines.push(`### ${domain}`);
    lines.push("");
    lines.push("| ID | Pri | Status | Action | Scope | Tests |");
    lines.push("|---|---|---|---|---|---|");
    for (const action of inventory.actions.filter((item) => item.domain === domain)) {
      lines.push(`| ${action.id} | ${action.priority} | \`${action.status}\` | ${cell(action.action)} | ${cell((action.scope ?? []).join(", "))} | ${testSummary(action)} |`);
    }
  }
  lines.push("");
  lines.push("## Classification rules");
  lines.push("");
  for (const rule of inventory.classificationRules ?? []) lines.push(`- ${rule}`);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const resolve = (file) => path.join(root, file);
  const io = { readFile: (file) => readFileSync(resolve(file), "utf8"), fileExists: (file) => existsSync(resolve(file)) };
  const mode = process.argv[2] ?? "check";
  if (!["check", "report"].includes(mode)) {
    console.error(`usage: journey-coverage.mjs check|report (got "${mode}")`);
    process.exit(2);
  }
  const inventory = JSON.parse(io.readFile(PATHS.inventory));
  const errors = validateInventory(inventory, io);
  if (errors.length > 0) {
    console.error(`journey-coverage: ${errors.length} inventory error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  const report = renderReport(inventory);
  if (mode === "report") {
    writeFileSync(resolve(PATHS.report), report);
    console.log(`journey-coverage: wrote ${PATHS.report}`);
  } else if (!io.fileExists(PATHS.report) || io.readFile(PATHS.report) !== report) {
    console.error(`journey-coverage: ${PATHS.report} is stale -- run npm run coverage:journeys:report and commit the result`);
    process.exit(1);
  }
  const metrics = computeMetrics(inventory);
  console.log(
    `journey-coverage: OK -- ${metrics.total} actions (${metrics.denominator} applicable); real-interaction ${metrics.realPct}; P0 real ${metrics.p0RealPct}; manual verified ${metrics.manualVerifiedPct}; ${metrics.outstanding.length} outstanding P0/P1`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
