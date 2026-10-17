// Self-test for scripts/capability-coverage.mjs: each rule rejects a bad
// capability model (negative controls), and the checked-in model passes
// against the checked-in inventory with a current matrix. Run with
// `npm run test:capability-coverage`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PATHS, computeSummary, evaluateCapability, manualCheckIds, renderMatrix, validateCapabilities } from "./capability-coverage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");

const inventory = {
  actions: [
    { id: "A-REAL", status: "automated_real_interaction", tests: [{ file: "e2e/a.spec.ts", title: "drives it", kind: "real" }, { file: "e2e/a.spec.ts", title: "partly", kind: "partial" }] },
    { id: "A-MANUAL", status: "manual_verified", tests: [] },
    { id: "A-PARTIAL", status: "automated_partial", tests: [] },
    { id: "A-NA", status: "not_applicable" },
  ],
  findings: [{ id: "FIND-01" }],
};
const manualDoc = "## Checks\n\n### MAN-X-01 — a manual check\n\nMentions MAN-Y-01 in passing.\n";
const io = { inventory, manualDoc };

function required(overrides = {}) {
  return {
    id: "CAP-T-01",
    domain: "deals",
    title: "Do the thing",
    expectedOutcome: "The thing is done",
    classification: "REQUIRED",
    priority: "P1",
    rationale: [{ source: "PRODUCT.md", says: "the thing" }],
    verification: { actions: ["A-REAL"] },
    ...overrides,
  };
}
const model = (...capabilities) => ({ schemaVersion: 1, capabilities });
const errorsFor = (...capabilities) => validateCapabilities(model(...capabilities), io);
const expectError = (errors, pattern) => assert.ok(errors.some((error) => pattern.test(error)), `expected an error matching ${pattern}, got:\n${errors.join("\n")}`);

test("a REQUIRED capability mapped to a real-interaction action passes", () => {
  assert.deepEqual(errorsFor(required()), []);
});

test("a manual_verified action or a named manual check covers a REQUIRED capability", () => {
  assert.deepEqual(errorsFor(required({ verification: { actions: ["A-MANUAL"] } })), []);
  assert.deepEqual(errorsFor(required({ verification: { actions: [], manualChecks: ["MAN-X-01"] } })), []);
});

test("partial evidence alone does not cover a REQUIRED capability", () => {
  expectError(errorsFor(required({ verification: { actions: ["A-PARTIAL"] } })), /REQUIRED but no mapped action/);
  const evaluation = evaluateCapability(required({ verification: { actions: ["A-REAL", "A-PARTIAL"] } }), inventory);
  assert.equal(evaluation.covered, true);
  assert.deepEqual(evaluation.weaker, ["A-PARTIAL (automated_partial)"]);
});

test("a REQUIRED capability with nothing mapped must carry a gap", () => {
  expectError(errorsFor(required({ verification: { actions: [] } })), /REQUIRED but no mapped action/);
  assert.deepEqual(errorsFor(required({ verification: { actions: [] }, gap: { kind: "missing", ref: "#55", summary: "no edit control" } })), []);
});

test("a mapped action that disappears from the inventory, or becomes not applicable, fails", () => {
  expectError(errorsFor(required({ verification: { actions: ["A-REAL", "A-GONE"] } })), /maps to A-GONE, which is not in/);
  expectError(errorsFor(required({ verification: { actions: ["A-REAL", "A-NA"] } })), /maps to A-NA, which the inventory marks not_applicable/);
});

test("a gap on a covered capability is stale", () => {
  expectError(errorsFor(required({ gap: { kind: "missing", ref: "#55", summary: "x" } })), /has a gap \(#55\) but is covered by A-REAL/);
});

test("gap fields are checked: kind, reference form, known finding, summary", () => {
  const base = { verification: { actions: [] } };
  expectError(errorsFor(required({ ...base, gap: { kind: "vibes", ref: "#1", summary: "x" } })), /gap.kind must be one of/);
  expectError(errorsFor(required({ ...base, gap: { kind: "missing", ref: "issue 55", summary: "x" } })), /gap.ref must be an issue/);
  expectError(errorsFor(required({ ...base, gap: { kind: "defect", ref: "FIND-99", summary: "x" } })), /FIND-99 is not a finding/);
  expectError(errorsFor(required({ ...base, gap: { kind: "missing", ref: "#1", summary: "" } })), /gap.summary is required/);
});

test("a manual check must be a section heading in MANUAL-UAT.md, not a passing mention", () => {
  assert.deepEqual([...manualCheckIds(manualDoc)], ["MAN-X-01"]);
  expectError(errorsFor(required({ verification: { actions: [], manualChecks: ["MAN-Y-01"] } })), /manual check MAN-Y-01 has no "### MAN-Y-01" section/);
});

test("a pinned test must be a real test listed under a mapped action", () => {
  const pin = (overrides) => required({ verification: { actions: ["A-REAL"], tests: [{ action: "A-REAL", file: "e2e/a.spec.ts", title: "drives it", ...overrides }] } });
  assert.deepEqual(errorsFor(pin({})), []);
  expectError(errorsFor(pin({ title: "renamed" })), /pinned test "renamed" .* is not a real test of A-REAL/);
  expectError(errorsFor(pin({ title: "partly" })), /pinned test "partly" .* is not a real test of A-REAL/);
  expectError(errorsFor(pin({ action: "A-MANUAL" })), /pinned test names A-MANUAL, which the capability does not map to/);
});

test("ids, required fields, classification, rationale and priority are validated", () => {
  expectError(errorsFor(required({ id: "DEAL-1" })), /id must look like CAP-AREA-01/);
  expectError(errorsFor(required(), required()), /CAP-T-01: duplicate id/);
  expectError(errorsFor(required({ title: " " })), /title is required/);
  expectError(errorsFor(required({ classification: "MAYBE" })), /classification must be one of/);
  expectError(errorsFor(required({ rationale: [] })), /rationale needs at least one/);
  expectError(errorsFor(required({ rationale: [{ source: "PRODUCT.md", says: "" }] })), /rationale needs at least one/);
  expectError(errorsFor(required({ priority: undefined })), /needs a priority/);
});

test("non-REQUIRED capabilities: UNKNOWN names its question and owner; no priority or gap", () => {
  const unknown = required({ classification: "UNKNOWN", priority: undefined, verification: undefined });
  expectError(errorsFor(unknown), /UNKNOWN capability names its openQuestion and decisionOwner/);
  assert.deepEqual(errorsFor({ ...unknown, openQuestion: "Keep it?", decisionOwner: "Chris" }), []);
  expectError(errorsFor(required({ classification: "PROPOSED" })), /only a REQUIRED capability has a priority/);
  expectError(errorsFor(required({ classification: "PROPOSED", priority: undefined, gap: { kind: "missing", ref: "#1", summary: "x" } })), /only a REQUIRED capability has a gap/);
});

test("summary counts gaps and REQUIRED capabilities with nothing in the inventory", () => {
  const summary = computeSummary(model(required(), required({ id: "CAP-T-02", verification: { actions: [] }, gap: { kind: "missing", ref: "#2", summary: "x" } })), inventory);
  assert.equal(summary.required, 2);
  assert.equal(summary.covered, 1);
  assert.deepEqual(summary.gaps.map((row) => row.capability.id), ["CAP-T-02"]);
  assert.deepEqual(summary.notInInventory.map((row) => row.capability.id), ["CAP-T-02"]);
});

test("the checked-in model is valid against the checked-in inventory and the matrix is current", () => {
  const realModel = JSON.parse(read(PATHS.capabilities));
  const realInventory = JSON.parse(read(PATHS.inventory));
  assert.deepEqual(validateCapabilities(realModel, { inventory: realInventory, manualDoc: read(PATHS.manual) }), []);
  assert.equal(read(PATHS.matrix), renderMatrix(realModel, realInventory), `${PATHS.matrix} is stale: run npm run coverage:capabilities:report`);
});
