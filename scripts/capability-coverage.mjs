#!/usr/bin/env node
// Validates docs/product/capabilities.json (what a creator must be able to
// do, written from the product documents, not from the UI) against the
// user-action inventory (docs/testing/journey-coverage.json) and the manual
// checks (docs/testing/MANUAL-UAT.md), and generates
// docs/product/capability-matrix.md from it.
//
//   node scripts/capability-coverage.mjs check   # validate + matrix is current
//   node scripts/capability-coverage.mjs report  # validate + rewrite the matrix
//
// Why a second file next to the inventory: the inventory lists the actions
// the UI offers, so a requirement the UI never offered has no row there and
// no coverage figure can miss it (DEAL-DELETE-01 is "not applicable" because
// no control exists). Capabilities are kept by hand. Each REQUIRED one must
// either map to at least one inventory action that a browser test drives for
// real (or a person verified), or name a manual check, or carry a gap with an
// issue or finding. Nothing here is estimated and no percentage is a gate.
//
// Deterministic: no browser, build, database or network. Issue numbers are
// checked for form only; whether an issue is open is not checked here.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PATHS = {
  capabilities: "docs/product/capabilities.json",
  matrix: "docs/product/capability-matrix.md",
  inventory: "docs/testing/journey-coverage.json",
  manual: "docs/testing/MANUAL-UAT.md",
};

export const CLASSIFICATIONS = ["REQUIRED", "PROPOSED", "NOT_APPLICABLE", "UNKNOWN"];
export const PRIORITIES = ["P0", "P1", "P2"];
export const GAP_KINDS = ["missing", "partial", "defect", "discoverability"];
// Inventory statuses that are evidence a person can do the action.
export const VERIFIED_STATUSES = ["automated_real_interaction", "manual_verified"];
const ID_PATTERN = /^CAP-[A-Z0-9]+-\d{2}$/;
const GAP_REF_PATTERN = /^(#\d+|FIND-\d+)$/;
const MANUAL_HEADING_PATTERN = /^###\s+(MAN-[A-Z0-9]+-\d+)\b/gm;

export function manualCheckIds(manualDoc) {
  return new Set([...manualDoc.matchAll(MANUAL_HEADING_PATTERN)].map((match) => match[1]));
}

const isText = (value) => typeof value === "string" && value.trim().length > 0;

// What the evidence says about one REQUIRED capability, from the inventory
// alone. `covered` is the bar: at least one mapped action a person can be
// shown to do, or a named manual check.
export function evaluateCapability(capability, inventory) {
  const byId = new Map(inventory.actions.map((action) => [action.id, action]));
  const verification = capability.verification ?? {};
  const actions = (verification.actions ?? []).map((id) => ({ id, action: byId.get(id) ?? null }));
  const verified = actions.filter(({ action }) => action && VERIFIED_STATUSES.includes(action.status)).map(({ id }) => id);
  const weaker = actions.filter(({ action }) => action && action.status !== "not_applicable" && !VERIFIED_STATUSES.includes(action.status)).map(({ id, action }) => `${id} (${action.status})`);
  const manualChecks = verification.manualChecks ?? [];
  return {
    covered: verified.length > 0 || manualChecks.length > 0,
    inInventory: actions.length > 0,
    verified,
    weaker,
    manualChecks,
  };
}

export function validateCapabilities(model, { inventory, manualDoc }) {
  const errors = [];
  if (model?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!Array.isArray(model?.capabilities) || model.capabilities.length === 0) {
    errors.push("capabilities must be a non-empty array");
    return errors;
  }
  const byId = new Map(inventory.actions.map((action) => [action.id, action]));
  const findings = new Set((inventory.findings ?? []).map((finding) => finding.id));
  const manualIds = manualCheckIds(manualDoc);
  const seen = new Set();

  for (const capability of model.capabilities) {
    const where = capability?.id ?? "(capability without id)";
    if (!ID_PATTERN.test(capability?.id ?? "")) errors.push(`${where}: id must look like CAP-AREA-01`);
    if (seen.has(capability.id)) errors.push(`${where}: duplicate id`);
    seen.add(capability.id);
    for (const field of ["domain", "title", "expectedOutcome"]) {
      if (!isText(capability[field])) errors.push(`${where}: ${field} is required`);
    }
    if (!CLASSIFICATIONS.includes(capability.classification)) {
      errors.push(`${where}: classification must be one of ${CLASSIFICATIONS.join(", ")}`);
      continue;
    }
    const rationale = Array.isArray(capability.rationale) ? capability.rationale : [];
    if (rationale.length === 0 || rationale.some((entry) => !isText(entry?.source) || !isText(entry?.says))) {
      errors.push(`${where}: rationale needs at least one { source, says } entry, each non-empty`);
    }
    if (capability.classification === "UNKNOWN" && (!isText(capability.openQuestion) || !isText(capability.decisionOwner))) {
      errors.push(`${where}: an UNKNOWN capability names its openQuestion and decisionOwner`);
    }

    const verification = capability.verification ?? {};
    for (const id of verification.actions ?? []) {
      const action = byId.get(id);
      // The guard against a requirement vanishing through the inventory: a
      // mapped action that is deleted or re-marked not applicable fails here.
      if (!action) errors.push(`${where}: maps to ${id}, which is not in ${PATHS.inventory}`);
      else if (action.status === "not_applicable") errors.push(`${where}: maps to ${id}, which the inventory marks not_applicable`);
    }
    for (const id of verification.manualChecks ?? []) {
      if (!manualIds.has(id)) errors.push(`${where}: manual check ${id} has no "### ${id}" section in ${PATHS.manual}`);
    }
    for (const pin of verification.tests ?? []) {
      const action = byId.get(pin?.action);
      if (!(verification.actions ?? []).includes(pin?.action)) errors.push(`${where}: pinned test names ${pin?.action}, which the capability does not map to`);
      else if (!action?.tests?.some((test) => test.file === pin.file && test.title === pin.title && test.kind === "real")) {
        errors.push(`${where}: pinned test "${pin?.title}" (${pin?.file}) is not a real test of ${pin?.action} in the inventory`);
      }
    }

    if (capability.classification !== "REQUIRED") {
      if (capability.priority !== undefined) errors.push(`${where}: only a REQUIRED capability has a priority`);
      if (capability.gap) errors.push(`${where}: only a REQUIRED capability has a gap`);
      continue;
    }
    if (!PRIORITIES.includes(capability.priority)) errors.push(`${where}: a REQUIRED capability needs a priority (${PRIORITIES.join(", ")})`);
    const evaluation = evaluateCapability(capability, inventory);
    const gap = capability.gap;
    if (gap) {
      if (!GAP_KINDS.includes(gap.kind)) errors.push(`${where}: gap.kind must be one of ${GAP_KINDS.join(", ")}`);
      if (!GAP_REF_PATTERN.test(gap.ref ?? "")) errors.push(`${where}: gap.ref must be an issue (#55) or a finding (FIND-11)`);
      else if (gap.ref.startsWith("FIND-") && !findings.has(gap.ref)) errors.push(`${where}: gap.ref ${gap.ref} is not a finding in ${PATHS.inventory}`);
      if (!isText(gap.summary)) errors.push(`${where}: gap.summary is required`);
      if (evaluation.covered) errors.push(`${where}: has a gap (${gap.ref}) but is covered by ${[...evaluation.verified, ...evaluation.manualChecks].join(", ")}; close the gap or narrow the mapping`);
    } else if (!evaluation.covered) {
      errors.push(`${where}: REQUIRED but no mapped action is automated_real_interaction or manual_verified, no manual check is named, and no gap records why`);
    }
  }
  return errors;
}

const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function computeSummary(model, inventory) {
  const required = model.capabilities.filter((capability) => capability.classification === "REQUIRED");
  const evaluations = required.map((capability) => ({ capability, ...evaluateCapability(capability, inventory) }));
  const count = (classification) => model.capabilities.filter((capability) => capability.classification === classification).length;
  return {
    total: model.capabilities.length,
    required: required.length,
    proposed: count("PROPOSED"),
    unknown: count("UNKNOWN"),
    notApplicable: count("NOT_APPLICABLE"),
    covered: evaluations.filter((row) => row.covered).length,
    gaps: evaluations.filter((row) => row.capability.gap),
    notInInventory: evaluations.filter((row) => !row.inInventory),
    weaker: evaluations.filter((row) => row.covered && row.weaker.length > 0),
    evaluations,
  };
}

export function renderMatrix(model, inventory) {
  const summary = computeSummary(model, inventory);
  const mapped = new Set(model.capabilities.flatMap((capability) => capability.verification?.actions ?? []));
  const unmapped = inventory.actions.filter((action) => action.status !== "not_applicable" && !mapped.has(action.id));
  const lines = [
    "# Product capability matrix",
    "",
    `<!-- GENERATED by \`npm run coverage:capabilities:report\` from ${PATHS.capabilities}. Do not edit by hand; \`npm run coverage:capabilities\` fails when this file is stale. -->`,
    "",
    `Reviewed: ${model.reviewedOn}. ${model.basis}`,
    "",
    "What a creator must be able to do, kept independently of the screens and of the user-action inventory (`docs/testing/journey-coverage.json`). The inventory can only list actions the UI offers; this matrix also lists what the UI does not offer. **Covered** means at least one mapped inventory action is driven for real by a browser test or verified by a person, or a manual check is named. It does not mean every part of the capability works: see the partial evidence column and the gaps.",
    "",
    "## Summary",
    "",
    `- Capabilities: **${summary.total}** (REQUIRED ${summary.required}, PROPOSED ${summary.proposed}, UNKNOWN ${summary.unknown}, NOT_APPLICABLE ${summary.notApplicable})`,
    `- REQUIRED and covered: **${summary.covered}/${summary.required}**`,
    `- REQUIRED with an open gap: **${summary.gaps.length}**`,
    `- REQUIRED with no action at all in the inventory: **${summary.notInInventory.length}** (${summary.notInInventory.map((row) => row.capability.id).join(", ") || "none"})`,
    "",
    "## Open gaps (REQUIRED, not covered)",
    "",
    "| ID | Pri | Capability | Kind | Tracked in | What is missing |",
    "|---|---|---|---|---|---|",
    ...summary.gaps
      .sort((a, b) => a.capability.priority.localeCompare(b.capability.priority) || a.capability.id.localeCompare(b.capability.id))
      .map(({ capability }) => `| ${capability.id} | ${capability.priority} | ${cell(capability.title)} | ${capability.gap.kind} | ${capability.gap.ref} | ${cell(capability.gap.summary)} |`),
    "",
    "## Decisions the owner has not made (UNKNOWN)",
    "",
    "| ID | Question | Decides |",
    "|---|---|---|",
    ...model.capabilities.filter((capability) => capability.classification === "UNKNOWN").map((capability) => `| ${capability.id} | ${cell(capability.openQuestion)} | ${cell(capability.decisionOwner)} |`),
    "",
    "## All capabilities",
    "",
    "| ID | Class | Pri | Capability | Expected outcome | Evidence (real / manual) | Partial evidence | Source |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const capability of model.capabilities) {
    const evaluation = capability.classification === "REQUIRED" ? evaluateCapability(capability, inventory) : null;
    const evidence = evaluation
      ? [...evaluation.verified, ...evaluation.manualChecks].join(", ") || (capability.gap ? `gap ${capability.gap.ref}` : "—")
      : "—";
    lines.push(
      `| ${capability.id} | ${capability.classification} | ${capability.priority ?? ""} | ${cell(capability.title)} | ${cell(capability.expectedOutcome)} | ${cell(evidence)} | ${cell(evaluation?.weaker.join(", ") ?? "")} | ${cell(capability.rationale.map((entry) => entry.source).join("; "))} |`,
    );
  }
  lines.push(
    "",
    "## Inventory actions no capability maps to",
    "",
    "Informational: an inventory action outside every capability is not an error (navigation details, detectors), but a long list here means the capability model has drifted.",
    "",
    unmapped.map((action) => `\`${action.id}\``).join(", ") || "none",
    "",
  );
  return `${lines.join("\n")}`;
}

function main() {
  const mode = process.argv[2];
  if (mode !== "check" && mode !== "report") {
    console.error("usage: capability-coverage.mjs check|report");
    process.exit(2);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (file) => readFileSync(path.join(root, file), "utf8");
  const model = JSON.parse(read(PATHS.capabilities));
  const inventory = JSON.parse(read(PATHS.inventory));
  const errors = validateCapabilities(model, { inventory, manualDoc: read(PATHS.manual) });
  if (errors.length > 0) {
    console.error(`capability-coverage: ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  const matrix = renderMatrix(model, inventory);
  if (mode === "report") {
    writeFileSync(path.join(root, PATHS.matrix), matrix);
    console.log(`capability-coverage: wrote ${PATHS.matrix}`);
  } else if (!existsSync(path.join(root, PATHS.matrix)) || read(PATHS.matrix) !== matrix) {
    console.error(`capability-coverage: ${PATHS.matrix} is stale -- run npm run coverage:capabilities:report and commit the result`);
    process.exit(1);
  }
  const summary = computeSummary(model, inventory);
  console.log(
    `capability-coverage: OK -- ${summary.total} capabilities; REQUIRED covered ${summary.covered}/${summary.required}; ${summary.gaps.length} open gap(s) (${summary.gaps.map((row) => `${row.capability.id} ${row.capability.gap.ref}`).join(", ") || "none"}); ${summary.unknown} undecided`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
