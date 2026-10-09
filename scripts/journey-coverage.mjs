#!/usr/bin/env node
// Validates docs/testing/journey-coverage.json (the user-action inventory)
// and generates docs/testing/JOURNEY-COVERAGE.md from it.
//
//   node scripts/journey-coverage.mjs check   # validate + report is current
//   node scripts/journey-coverage.mjs report  # validate + rewrite the report
//
//   node scripts/journey-coverage.mjs check --results test-results/e2e/results.json
//       # ... and confirm "real" claims against an actual Playwright run
//   node scripts/journey-coverage.mjs check --results <file> --require-results
//       # ... and fail when any real claim was not exercised by that run
//   node scripts/journey-coverage.mjs check --results <file> --require-results --evidence <dir>
//       # ... and write journey-coverage-evidence.{json,md} there: the commit,
//       # the claim counts and the verdict, for a release reviewer
//
// Metrics come only from the inventory and the referenced tests; nothing is
// estimated. A test reference is resolved through Playwright's own registry
// (`playwright test --list`) plus the test's TypeScript AST, never by text
// search (see journey-coverage-discovery.mjs): a title in a comment, a
// renamed or deleted test, or a test that is skipped / test.fail()-ed /
// fixme'd in a claimed project does not count. The static check needs no
// browser, build or database, so it runs on every PR; run results add what
// only a real run can show.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRegistry, readPlaywrightResults } from "./journey-coverage-discovery.mjs";

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

// Exception register (inventory.exceptions): why a P0/P1 action is not, or
// not only, automated_real_interaction, and what a release needs for it.
export const EXCEPTION_CATEGORIES = {
  physical_device: "Physical / native device",
  third_party_auth: "Third-party auth",
  partial_by_rule: "Partial by classification rule",
  product_decision: "Product decision",
};
const VERIFIED_STATUSES = ["automated_real_interaction", "manual_verified", "not_applicable"];
const isOutstanding = (action) => ["P0", "P1"].includes(action.priority) && !VERIFIED_STATUSES.includes(action.status);
export const EVIDENCE_FILES = { json: "journey-coverage-evidence.json", markdown: "journey-coverage-evidence.md" };

export const PATHS = {
  inventory: "docs/testing/journey-coverage.json",
  report: "docs/testing/JOURNEY-COVERAGE.md",
  graphs: "docs/testing/JOURNEY-GRAPHS.md",
  manual: "docs/testing/MANUAL-UAT.md",
  backlog: "docs/testing/JOURNEY-BACKLOG.md",
};

// Playwright configs whose tests the inventory may reference. Project ids
// are `${key}:${projectName}` (the ux-audit config has one unnamed project).
export const PLAYWRIGHT_CONFIGS = [
  { key: "e2e", file: "playwright.e2e.config.ts", testDir: "e2e" },
  { key: "ux-audit", file: "playwright.config.ts", testDir: "tests/ux-audit" },
];

// Maps an action's free-text scope entries to the Playwright projects they
// claim: a bare project name ("chromium", "chromium-mobile") is an e2e
// project; "chromium ... (ux-audit ...)" is the ux-audit project. "unit"
// and "manual: ..." entries claim no Playwright project.
export function scopeProjectIds(scope) {
  const ids = [];
  for (const entry of Array.isArray(scope) ? scope : []) {
    if (typeof entry !== "string") continue;
    if (/\(ux-audit\b/.test(entry)) ids.push("ux-audit:");
    else if (/^[a-z0-9-]+$/.test(entry) && entry !== "unit") ids.push(`e2e:${entry}`);
  }
  return [...new Set(ids)];
}


function projectLabel(projectId) {
  return projectId.endsWith(":") ? projectId.slice(0, -1) : projectId.split(":")[1];
}

// readFile/fileExists/registry are injectable so the self-test can validate
// synthetic inventories without touching the real repository files.
// `registry` is buildRegistry()'s lookup (or a fake with the same shape).
export function validateInventory(inventory, { readFile, fileExists, registry }) {
  const errors = [];
  const actions = Array.isArray(inventory?.actions) ? inventory.actions : null;
  if (!actions) return ["inventory.actions must be an array"];
  const findings = new Map((inventory.findings ?? []).map((finding) => [finding.id, finding]));
  const manualDoc = fileExists(PATHS.manual) ? readFile(PATHS.manual) : "";
  const manualIds = new Set(manualDoc.match(MANUAL_REF_PATTERN) ?? []);
  const seen = new Set();

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
    const scopeProjects = scopeProjectIds(action.scope);
    for (const projectId of scopeProjects) {
      if (!registry.projectIds.includes(projectId)) errors.push(`${where}: scope names unknown Playwright project ${projectLabel(projectId)}`);
    }
    // ref -> registry hits, for the status rules below.
    const resolved = [];
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
      if (!registry.testDirs.some((dir) => ref.file.startsWith(`${dir}/`))) {
        // Unit/component tests are evidence of logic, never of a real
        // interaction, and their titles are not resolved here.
        if (ref.kind !== "partial") errors.push(`${refWhere}: only a Playwright spec can be a "${ref.kind}" reference`);
        if (ref.title) errors.push(`${refWhere}: a title can only be verified for a Playwright spec; reference ${ref.file} without one`);
        continue;
      }
      if (!ref.title) {
        if (ref.kind !== "partial") errors.push(`${refWhere}: a "${ref.kind}" test reference must name the test title`);
        else if (!registry.files.has(ref.file)) errors.push(`${refWhere}: Playwright registers no tests in ${ref.file}`);
        continue;
      }
      const hits = registry.find(ref.file, ref.title);
      if (hits.length === 0) {
        errors.push(`${refWhere}: "${ref.title}" is not a test Playwright registers in ${ref.file} (a comment, renamed, or deleted test does not count)`);
        continue;
      }
      if (new Set(hits.map((hit) => hit.fullTitle)).size > 1) {
        errors.push(`${refWhere}: "${ref.title}" matches several tests in ${ref.file}; use the full title (describe › test)`);
        continue;
      }
      resolved.push({ ref, refWhere, hits });
      const inScope = scopeProjects.length > 0 ? hits.filter((hit) => scopeProjects.includes(hit.projectId)) : hits;
      if (ref.kind === "expected_failure" && !inScope.some((hit) => hit.classification === "expected_failure")) {
        errors.push(`${refWhere}: marked expected_failure but the test is not test.fail()-annotated in ${scopeProjects.length > 0 ? "any claimed project" : "any project"} -- the defect may be fixed; update the inventory`);
      }
      if (ref.kind === "partial" && hits.every((hit) => ["skipped", "fixme", "expected_failure"].includes(hit.classification))) {
        errors.push(`${refWhere}: never runs as a passing test (${describeHits(hits)}); use kind "expected_failure" or drop it`);
      }
    }

    // A real claim needs, for every claimed Playwright project, at least one
    // "real" reference that runs there as a pass -- not skipped, fixme'd,
    // expected to fail, or under a condition that can't be evaluated.
    const realRefs = resolved.filter(({ ref }) => ref.kind === "real");
    if (action.status === "automated_real_interaction" && realRefs.length > 0) {
      if (scopeProjects.length === 0) errors.push(`${where}: automated_real_interaction needs a Playwright project in scope`);
      for (const projectId of scopeProjects) {
        if (!realRefs.some(({ hits }) => hits.some((hit) => hit.projectId === projectId && hit.classification === "runnable"))) {
          const reasons = realRefs.map(({ ref, hits }) => {
            const hit = hits.find((candidate) => candidate.projectId === projectId);
            return `"${ref.title}": ${hit ? hit.classification : "not registered"}`;
          });
          errors.push(`${where}: no "real" test runs as a pass in ${projectLabel(projectId)} (${reasons.join("; ")})`);
        }
      }
      for (const { refWhere, hits } of realRefs) {
        if (!hits.some((hit) => scopeProjects.includes(hit.projectId) && hit.classification === "runnable")) {
          errors.push(`${refWhere}: a "real" reference must run as a pass in at least one claimed project (${describeHits(hits)})`);
        }
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

  errors.push(...validateExceptions(inventory, { manualIds, findings }));

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

// The register must account for every P0/P1 action that is not verified, and
// for every P0/P1 action that still carries a manual check, so neither can
// be dropped or reclassified without the reason being edited too.
export function validateExceptions(inventory, { manualIds, findings }) {
  const errors = [];
  const exceptions = inventory.exceptions ?? [];
  if (!Array.isArray(exceptions)) return ["inventory.exceptions must be an array"];
  const actions = new Map((inventory.actions ?? []).filter((action) => action?.id).map((action) => [action.id, action]));
  const entryOf = new Map();
  const text = (value) => typeof value === "string" && value.trim() !== "";

  for (const [index, entry] of exceptions.entries()) {
    const ids = Array.isArray(entry?.actions) ? entry.actions : [];
    const where = `exceptions[${index}]${ids.length > 0 ? ` (${ids.join(", ")})` : ""}`;
    if (ids.length === 0) errors.push(`${where}: actions must list at least one action id`);
    if (!Object.hasOwn(EXCEPTION_CATEGORIES, entry?.category)) errors.push(`${where}: category must be one of ${Object.keys(EXCEPTION_CATEGORIES).join(", ")}`);
    for (const field of ["reason", "releaseEvidence"]) {
      if (!text(entry?.[field])) errors.push(`${where}: missing ${field}`);
    }
    if (typeof entry?.blocksRelease !== "boolean") errors.push(`${where}: blocksRelease must be true or false`);
    if (typeof entry?.futureAutomation?.exists !== "boolean" || !text(entry?.futureAutomation?.strategy)) {
      errors.push(`${where}: futureAutomation needs exists (true/false) and strategy`);
    }
    if (entry?.manualCheck && !manualIds.has(entry.manualCheck)) errors.push(`${where}: manualCheck ${entry.manualCheck} not found in ${PATHS.manual}`);
    if (entry?.finding && !findings.has(entry.finding)) errors.push(`${where}: unknown finding ${entry.finding}`);

    const members = [];
    for (const id of ids) {
      const action = actions.get(id);
      if (!action) {
        errors.push(`${where}: references unknown action ${id}`);
        continue;
      }
      if (entryOf.has(id)) errors.push(`${where}: ${id} is already in another exception entry`);
      entryOf.set(id, entry);
      if (!["P0", "P1"].includes(action.priority)) errors.push(`${where}: ${id} is ${action.priority}; the register covers P0/P1 only`);
      if (action.manualCheck && action.manualCheck !== entry.manualCheck) {
        errors.push(`${where}: ${id} has manualCheck ${action.manualCheck}, so the entry must name it`);
      }
      members.push(action);
    }
    if (members.length === 0) continue;

    if (!members.some(isOutstanding) && !entry.manualCheck) {
      errors.push(`${where}: every action is verified and no manual check remains -- remove the entry`);
    }
    if (members.some((action) => action.priority === "P0" && isOutstanding(action)) && entry.blocksRelease === false) {
      errors.push(`${where}: an outstanding P0 action blocks a release (fixed, signed off, or accepted by Chris); blocksRelease cannot be false`);
    }
    if (["physical_device", "third_party_auth"].includes(entry.category) && !entry.manualCheck) {
      errors.push(`${where}: category ${entry.category} needs manualCheck`);
    }
    if (entry.category === "partial_by_rule") {
      for (const action of members) {
        if (action.status !== "automated_partial") errors.push(`${where}: partial_by_rule but ${action.id} is ${action.status}`);
      }
    }
    if (entry.category === "product_decision") {
      if (!entry.finding) errors.push(`${where}: category product_decision needs finding`);
      for (const action of members) {
        if (action.status !== "blocked") errors.push(`${where}: product_decision but ${action.id} is ${action.status}`);
      }
    }
  }

  for (const action of actions.values()) {
    if (entryOf.has(action.id) || !["P0", "P1"].includes(action.priority)) continue;
    if (isOutstanding(action)) errors.push(`${action.id}: ${action.priority} ${action.status} has no entry in the exception register (inventory.exceptions)`);
    else if (action.manualCheck) errors.push(`${action.id}: manual check ${action.manualCheck} has no entry in the exception register (inventory.exceptions)`);
  }
  return errors;
}

function describeHits(hits) {
  return hits.map((hit) => `${projectLabel(hit.projectId)}=${hit.classification}`).join(", ");
}

// Confirms "real" claims against rows from readPlaywrightResults(). For each
// automated_real_interaction action and claimed project, a claim is
// "verified" when one of its real tests ran there and passed (a flaky pass
// counts, with a warning), an error when a real test ran there and was
// skipped, failed, or expected to fail, and "unverified" when the run did
// not include it (e.g. a non-@critical test in the PR-gate run).
const OUTCOME_TEXT = {
  skipped: "ran but was skipped",
  expected_failure: "ran as an expected failure (test.fail)",
  failed: "ran and failed",
};

export function verifyAgainstResults(inventory, rows) {
  const errors = [];
  const warnings = [];
  const verified = [];
  const unverified = [];
  const failed = [];
  const flaky = [];
  const rowsFor = (file, title, projectId) =>
    rows.filter((row) => row.file === file && row.projectId === projectId && (row.title === title || row.fullTitle === title));
  for (const action of inventory.actions) {
    if (action.status !== "automated_real_interaction") continue;
    const realRefs = (action.tests ?? []).filter((ref) => ref.kind === "real" && ref.title);
    for (const projectId of scopeProjectIds(action.scope)) {
      const label = `${action.id} [${projectLabel(projectId)}]`;
      let passed = false;
      let ran = false;
      for (const ref of realRefs) {
        for (const row of rowsFor(ref.file, ref.title, projectId)) {
          ran = true;
          if (row.outcome === "passed" || row.outcome === "flaky") {
            passed = true;
            if (row.outcome === "flaky") {
              warnings.push(`${label}: "${ref.title}" passed only on retry (flaky)`);
              if (!flaky.includes(label)) flaky.push(label);
            }
          } else {
            errors.push(`${label}: real test "${ref.title}" ${OUTCOME_TEXT[row.outcome] ?? row.outcome}`);
          }
        }
      }
      if (passed) verified.push(label);
      else if (!ran) unverified.push(label);
      else {
        failed.push(label);
        errors.push(`${label}: no real test passed in this run`);
      }
    }
  }
  return { errors: [...new Set(errors)], warnings, verified, unverified, failed, flaky };
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
  const outstanding = actions.filter(isOutstanding);
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
  lines.push("An entry in this inventory is not proof that the action works. Only `automated_real_interaction` (a browser test drives the visible control and checks the outcome) and `manual_verified` (recorded human check) count as verified. Every titled test reference is resolved through Playwright's own registry, and a real claim needs a test that is not skipped, fixme'd or expected to fail in each claimed project (see the classification rules below). CI-green is not release readiness: see the outstanding P0/P1 list below and `docs/testing/MANUAL-UAT.md`.");
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
  lines.push("## Exception register (P0/P1 not fully automated)");
  lines.push("");
  lines.push("Every outstanding P0/P1 action above, plus every P0/P1 action that is automated or recorded but still has a manual check. \"Blocks a release\" means a normal `staging -> main` release waits for the evidence in the next column or for Chris's explicit acceptance in the release PR (`REVIEW_CHECKLIST.md` Gate F). A FAIL on any check is a finding, whatever this column says.");
  lines.push("");
  lines.push("| Actions | Category | Manual check / finding | Why it is not fully automated | Blocks a release | Evidence required before release | Future automation |");
  lines.push("|---|---|---|---|---|---|---|");
  const actionById = new Map(inventory.actions.map((action) => [action.id, action]));
  for (const entry of inventory.exceptions ?? []) {
    const members = entry.actions.map((id) => `${id} (${actionById.get(id).priority}, \`${actionById.get(id).status}\`)`).join("<br>");
    const refs = [entry.manualCheck, entry.finding].filter(Boolean).join(", ") || "—";
    const automation = `${entry.futureAutomation.exists ? "Yes" : "No"}: ${entry.futureAutomation.strategy}`;
    lines.push(
      `| ${members} | ${EXCEPTION_CATEGORIES[entry.category]} | ${refs} | ${cell(entry.reason)} | ${entry.blocksRelease ? "Yes" : "No"} | ${cell(entry.releaseEvidence)} | ${cell(automation)} |`,
    );
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

export function parseArgs(argv) {
  const [mode = "check", ...rest] = argv;
  const options = { mode, results: [], requireResults: false, evidence: null };
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--results" && rest[index + 1]) options.results.push(rest[(index += 1)]);
    else if (rest[index] === "--evidence" && rest[index + 1]) options.evidence = rest[(index += 1)];
    else if (rest[index] === "--require-results") options.requireResults = true;
    else throw new Error(`unknown argument "${rest[index]}"`);
  }
  if (!["check", "report"].includes(mode)) throw new Error(`mode must be check or report (got "${mode}")`);
  if (options.requireResults && options.results.length === 0) throw new Error("--require-results needs --results <file>");
  if (options.evidence && options.results.length === 0) throw new Error("--evidence needs --results <file>");
  return options;
}

// What a run of `check --results ... --evidence <dir>` proved, for someone
// who should not have to read the raw log: which commit, how many real
// claims (action x project), and whether every one was exercised and passed.
// Built only from its arguments, so the same inputs give the same evidence.
// `source` is { commit, ref, event, runId, runAttempt, runUrl } (null when
// unknown); `reports` is [{ file, report }] of Playwright JSON output.
export function buildEvidence({ inventory, outcome, reports, requireResults, source }) {
  const metrics = computeMetrics(inventory);
  const total = outcome.verified.length + outcome.unverified.length + outcome.failed.length;
  const everyClaimPassed = requireResults && outcome.errors.length === 0 && outcome.unverified.length === 0 && total > 0;
  return {
    schemaVersion: 1,
    everyRealClaimExercisedAndPassed: everyClaimPassed,
    requireResults,
    source,
    inventory: {
      date: inventory.inventoryDate ?? null,
      actions: metrics.total,
      applicable: metrics.denominator,
      automatedRealInteraction: metrics.byStatus.automated_real_interaction,
      p0AutomatedRealInteraction: metrics.byPriority.P0.automated_real_interaction,
      p0Applicable: metrics.p0Denominator,
      outstandingP0P1: metrics.outstanding.map((action) => action.id),
    },
    realClaims: {
      total,
      passed: outcome.verified.length,
      notExercised: outcome.unverified,
      failed: outcome.failed,
      passedOnlyOnRetry: outcome.flaky,
    },
    errors: outcome.errors,
    results: reports.map(({ file, report }) => ({
      // Parent directory kept: two inputs are often both named results.json.
      file: path.join(path.basename(path.dirname(path.resolve(file))), path.basename(file)),
      startTime: report.stats?.startTime ?? null,
      expected: report.stats?.expected ?? null,
      unexpected: report.stats?.unexpected ?? null,
      flaky: report.stats?.flaky ?? null,
      skipped: report.stats?.skipped ?? null,
    })),
  };
}

export function renderEvidence(evidence) {
  const { source, inventory, realClaims } = evidence;
  const list = (labels) => (labels.length === 0 ? "0" : `${labels.length}: ${labels.join(", ")}`);
  const run = source.runId ? `${source.runUrl ? `[${source.runId}](${source.runUrl})` : source.runId}${source.runAttempt ? ` (attempt ${source.runAttempt})` : ""}` : "not a CI run";
  const lines = [];
  lines.push("## Journey coverage: full real-claim verification");
  lines.push("");
  if (evidence.everyRealClaimExercisedAndPassed) lines.push(`**PASS** -- every real claim was exercised and passed on \`${source.commit ?? "unknown commit"}\`.`);
  else if (!evidence.requireResults) lines.push("**NOT A FULL VERIFICATION** -- run without `--require-results`, so claims the run did not exercise were not errors.");
  else lines.push(`**FAIL** -- not every real claim was exercised and passed on \`${source.commit ?? "unknown commit"}\`.`);
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  lines.push(`| Commit | \`${source.commit ?? "unknown"}\` |`);
  lines.push(`| Ref / event | ${source.ref ?? "unknown"} / ${source.event ?? "local"} |`);
  lines.push(`| Run | ${run} |`);
  lines.push(`| Inventory | ${inventory.actions} actions (${inventory.applicable} applicable), ${inventory.automatedRealInteraction} automated real interaction, P0 ${inventory.p0AutomatedRealInteraction}/${inventory.p0Applicable} |`);
  lines.push(`| Real claims (action x project) | ${realClaims.total} |`);
  lines.push(`| Passed in this run | ${realClaims.passed} |`);
  lines.push(`| Not exercised | ${list(realClaims.notExercised)} |`);
  lines.push(`| Failed | ${list(realClaims.failed)} |`);
  lines.push(`| Passed only on retry | ${list(realClaims.passedOnlyOnRetry)} |`);
  for (const result of evidence.results) {
    lines.push(`| Results file \`${result.file}\` | started ${result.startTime ?? "?"}: ${result.expected ?? "?"} passed, ${result.unexpected ?? "?"} failed, ${result.flaky ?? "?"} flaky, ${result.skipped ?? "?"} skipped |`);
  }
  if (evidence.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    lines.push("");
    for (const error of evidence.errors) lines.push(`- ${error}`);
  }
  lines.push("");
  lines.push(`This is not release readiness and enforces no coverage percentage. Outstanding P0/P1 actions (${inventory.outstandingP0P1.length}): ${inventory.outstandingP0P1.join(", ") || "none"} -- see the exception register in \`${PATHS.report}\`.`);
  lines.push("");
  return lines.join("\n");
}

function evidenceSource(root, env) {
  let commit = env.GITHUB_SHA ?? null;
  if (!commit) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      commit = null;
    }
  }
  const runId = env.GITHUB_RUN_ID ?? null;
  return {
    commit,
    ref: env.GITHUB_REF_NAME ?? null,
    event: env.GITHUB_EVENT_NAME ?? null,
    runId,
    runAttempt: env.GITHUB_RUN_ATTEMPT ?? null,
    runUrl: runId && env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${runId}` : null,
  };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const resolve = (file) => path.join(root, file);
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`usage: journey-coverage.mjs check|report [--results <playwright-json>]... [--require-results] [--evidence <dir>]: ${error.message}`);
    process.exit(2);
  }
  const registry = buildRegistry(root, PLAYWRIGHT_CONFIGS);
  const io = { readFile: (file) => readFileSync(resolve(file), "utf8"), fileExists: (file) => existsSync(resolve(file)), registry };
  const inventory = JSON.parse(io.readFile(PATHS.inventory));
  const errors = validateInventory(inventory, io);
  if (errors.length > 0) {
    console.error(`journey-coverage: ${errors.length} inventory error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  const report = renderReport(inventory);
  if (options.mode === "report") {
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

  if (options.results.length === 0) return;
  const configKeyForTestDir = (testDir) =>
    PLAYWRIGHT_CONFIGS.find((config) => path.resolve(root, config.testDir) === path.resolve(testDir))?.key ?? null;
  const reports = options.results.map((file) => {
    try {
      return { file, report: JSON.parse(readFileSync(path.resolve(file), "utf8")) };
    } catch (error) {
      console.error(`journey-coverage: cannot read Playwright results file ${file}: ${error.message}`);
      console.error("journey-coverage: no claim was checked against a run");
      return process.exit(2);
    }
  });
  const rows = reports.flatMap(({ report }) => readPlaywrightResults(root, report, configKeyForTestDir));
  const outcome = verifyAgainstResults(inventory, rows);
  if (options.evidence) {
    const evidence = buildEvidence({ inventory, outcome, reports, requireResults: options.requireResults, source: evidenceSource(root, process.env) });
    const dir = path.resolve(options.evidence);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, EVIDENCE_FILES.json), `${JSON.stringify(evidence, null, 2)}\n`);
    writeFileSync(path.join(dir, EVIDENCE_FILES.markdown), renderEvidence(evidence));
    console.log(`journey-coverage: wrote ${path.join(options.evidence, EVIDENCE_FILES.json)} and ${EVIDENCE_FILES.markdown}`);
  }
  for (const warning of outcome.warnings) console.warn(`journey-coverage: warning: ${warning}`);
  console.log(
    `journey-coverage: run results -- ${outcome.verified.length} real claim(s) passed in the run, ${outcome.unverified.length} not exercised by it${outcome.unverified.length ? ` (${outcome.unverified.join(", ")})` : ""}`,
  );
  const failures = [...outcome.errors, ...(options.requireResults ? outcome.unverified.map((label) => `${label}: not exercised by the given run results`) : [])];
  if (failures.length > 0) {
    console.error(`journey-coverage: ${failures.length} run-result error(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    if (options.requireResults && outcome.unverified.length > outcome.verified.length) {
      console.error(
        `journey-coverage: most real claims (${outcome.unverified.length} of ${outcome.verified.length + outcome.unverified.length + outcome.failed.length}) were not exercised -- check that --results points at the full \`npm run test:e2e\` results. \`npm run ux:audit\` overwrites test-results/e2e/results.json with its @visual run.`,
      );
    }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
