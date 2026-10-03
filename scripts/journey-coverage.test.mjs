// Self-test for scripts/journey-coverage.mjs: proves each validation rule
// actually rejects a bad inventory (negative controls), and that the real
// checked-in inventory passes. Run with `npm run test:journey-coverage`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { PATHS, computeMetrics, renderReport, validateInventory } from "./journey-coverage.mjs";

const SPEC = "e2e/example.spec.ts";
const files = {
  [SPEC]: 'test("clicks the visible thing", async () => {});',
  [PATHS.manual]: "### MAN-X-01 — a manual check",
  [PATHS.graphs]: "Edge covered by AUTH-01.",
  [PATHS.backlog]: "Batch 1: AUTH-01.",
};
const io = {
  readFile: (file) => {
    if (!(file in files)) throw new Error(`unexpected read ${file}`);
    return files[file];
  },
  fileExists: (file) => file in files,
};

function action(overrides = {}) {
  return {
    id: "AUTH-01",
    domain: "auth",
    route: "/",
    action: "Do the thing",
    persona: "owner",
    interaction: "Click it",
    expected: "It happens",
    scope: ["chromium"],
    priority: "P0",
    status: "automated_real_interaction",
    tests: [{ file: SPEC, title: "clicks the visible thing", kind: "real" }],
    ...overrides,
  };
}

const validate = (actions, findings = []) => validateInventory({ actions, findings }, io);

test("a well-formed inventory passes", () => {
  assert.deepEqual(validate([action()]), []);
});

test("rejects duplicate ids", () => {
  assert.match(validate([action(), action()]).join("\n"), /duplicate id/);
});

test("rejects malformed ids, statuses and priorities", () => {
  const errors = validate([action({ id: "auth 1", status: "done", priority: "P9" })]).join("\n");
  assert.match(errors, /invalid or missing id/);
  assert.match(errors, /status must be one of/);
  assert.match(errors, /priority must be one of/);
});

test("rejects a test reference to a missing file or a title that does not exist", () => {
  assert.match(validate([action({ tests: [{ file: "e2e/nope.spec.ts", title: "x", kind: "real" }] })]).join("\n"), /file not found/);
  assert.match(validate([action({ tests: [{ file: SPEC, title: "renamed test", kind: "real" }] })]).join("\n"), /title not found/);
});

test("automated_real_interaction requires a real test, and an expected failure never counts", () => {
  assert.match(validate([action({ tests: [{ file: SPEC, title: "clicks the visible thing", kind: "partial" }] })]).join("\n"), /needs at least one test with kind "real"/);
  assert.match(
    validate([action({ tests: [
      { file: SPEC, title: "clicks the visible thing", kind: "real" },
      { file: SPEC, title: "clicks the visible thing", kind: "expected_failure" },
    ] })]).join("\n"),
    /expected-failure test cannot be the coverage/,
  );
});

test("status-specific evidence is required", () => {
  const noTests = { tests: [] };
  assert.match(validate([action({ ...noTests, status: "automated_partial" })]).join("\n"), /needs at least one test reference/);
  assert.match(validate([action({ ...noTests, status: "manual_verified" })]).join("\n"), /needs manualCheck/);
  assert.match(validate([action({ ...noTests, status: "manual_verified", manualCheck: "MAN-X-01" })]).join("\n"), /needs evidence/);
  assert.match(validate([action({ ...noTests, status: "manual_pending", manualCheck: "MAN-Y-09" })]).join("\n"), /not found in docs\/testing\/MANUAL-UAT.md/);
  assert.match(validate([action({ ...noTests, status: "not_covered" })]).join("\n"), /needs followUp/);
  assert.match(validate([action({ ...noTests, status: "blocked" })]).join("\n"), /needs reason/);
  assert.match(validate([action({ status: "not_covered", followUp: "later" })]).join("\n"), /has a "real" test but is marked not_covered/);
});

test("companion docs and findings may only reference existing actions", () => {
  files[PATHS.graphs] = "Edge covered by AUTH-99.";
  try {
    assert.match(validate([action()]).join("\n"), /references unknown action AUTH-99/);
  } finally {
    files[PATHS.graphs] = "Edge covered by AUTH-01.";
  }
  assert.match(validate([action({ finding: "FIND-9" })]).join("\n"), /unknown finding FIND-9/);
  assert.match(validate([action()], [{ id: "FIND-1", actions: ["NAV-77"] }]).join("\n"), /references unknown action NAV-77/);
});

test("metrics exclude not_applicable from the denominator and list outstanding P0/P1 only", () => {
  const metrics = computeMetrics({
    actions: [
      action(),
      action({ id: "AUTH-02", status: "not_covered", priority: "P1" }),
      action({ id: "AUTH-03", status: "not_covered", priority: "P2" }),
      action({ id: "AUTH-04", status: "not_applicable", priority: "P2" }),
    ],
  });
  assert.equal(metrics.denominator, 3);
  assert.equal(metrics.realPct, "33.3%");
  assert.deepEqual(metrics.outstanding.map((item) => item.id), ["AUTH-02"]);
});

test("the checked-in inventory is valid and its generated report is current", () => {
  const realIo = { readFile: (file) => readFileSync(file, "utf8"), fileExists: (file) => existsSync(file) };
  const inventory = JSON.parse(realIo.readFile(PATHS.inventory));
  assert.deepEqual(validateInventory(inventory, realIo), []);
  assert.equal(realIo.readFile(PATHS.report), renderReport(inventory));
});
