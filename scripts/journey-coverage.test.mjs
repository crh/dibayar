// Self-test for scripts/journey-coverage.mjs: proves each validation rule
// actually rejects a bad inventory (negative controls), and that the real
// checked-in inventory passes. Run with `npm run test:journey-coverage`.
//
// Three layers:
// - rule tests against a fake registry (fast, exhaustive per rule);
// - discovery negative controls: the real Playwright registry + AST analysis
//   over scripts/journey-coverage-fixtures/coverage.spec.ts, where each
//   false-positive case (commented-out test, renamed test, test.skip(),
//   test.fail(), suite-level and project-specific skips) is a real test;
// - run-result negative controls: a real Playwright run of those fixtures
//   (no browser: no fixture test uses `page`) fed to verifyAgainstResults.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildRegistry, readPlaywrightResults } from "./journey-coverage-discovery.mjs";
import {
  EVIDENCE_FILES,
  PATHS,
  PLAYWRIGHT_CONFIGS,
  buildEvidence,
  computeMetrics,
  parseArgs,
  renderEvidence,
  renderReport,
  scopeProjectIds,
  validateInventory,
  verifyAgainstResults,
} from "./journey-coverage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = "e2e/example.spec.ts";
const files = {
  [SPEC]: 'test("clicks the visible thing", async () => {});',
  "src/lib/example.test.ts": 'it("computes", () => {});',
  [PATHS.manual]: "### MAN-X-01 — a manual check",
  [PATHS.graphs]: "Edge covered by AUTH-01.",
  [PATHS.backlog]: "Batch 1: AUTH-01.",
};

// Registry rows: [file, title, projectId, classification].
function fakeRegistry(rows) {
  const entries = rows.map(([file, title, projectId, classification]) => ({ file, title, fullTitle: `suite › ${title}`, projectId, classification }));
  return {
    projectIds: ["e2e:chromium", "e2e:chromium-mobile", "ux-audit:"],
    testDirs: ["e2e", "tests/ux-audit"],
    files: new Set(entries.map((entry) => entry.file)),
    find: (file, title) => entries.filter((entry) => entry.file === file && (entry.title === title || entry.fullTitle === title)),
  };
}

const runnableEverywhere = fakeRegistry([
  [SPEC, "clicks the visible thing", "e2e:chromium", "runnable"],
  [SPEC, "clicks the visible thing", "e2e:chromium-mobile", "runnable"],
]);

function ioWith(registry) {
  return {
    readFile: (file) => {
      if (!(file in files)) throw new Error(`unexpected read ${file}`);
      return files[file];
    },
    fileExists: (file) => file in files,
    registry,
  };
}

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

const validate = (actions, findings = [], registry = runnableEverywhere, exceptions = []) =>
  validateInventory({ actions, findings, exceptions }, ioWith(registry));

test("a well-formed inventory passes", () => {
  assert.deepEqual(validate([action()]), []);
  assert.deepEqual(validate([action({ scope: ["chromium", "chromium-mobile"] })]), []);
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

test("rejects a reference to a missing file, or to a title Playwright does not register", () => {
  assert.match(validate([action({ tests: [{ file: "e2e/nope.spec.ts", title: "x", kind: "real" }] })]).join("\n"), /file not found/);
  assert.match(
    validate([action({ tests: [{ file: SPEC, title: "renamed test", kind: "real" }] })]).join("\n"),
    /is not a test Playwright registers/,
  );
});

test("a title matching several tests must be disambiguated with the full title", () => {
  const registry = fakeRegistry([
    [SPEC, "same title", "e2e:chromium", "runnable"],
    [SPEC, "same title", "e2e:chromium", "runnable"],
  ]);
  registry.find = () => [
    { file: SPEC, title: "same title", fullTitle: "a › same title", projectId: "e2e:chromium", classification: "runnable" },
    { file: SPEC, title: "same title", fullTitle: "b › same title", projectId: "e2e:chromium", classification: "runnable" },
  ];
  assert.match(validate([action({ tests: [{ file: SPEC, title: "same title", kind: "real" }] })], [], registry).join("\n"), /matches several tests/);
});

test("unit tests can only be untitled partial evidence", () => {
  const unit = "src/lib/example.test.ts";
  assert.deepEqual(validate([action({ status: "automated_partial", priority: "P2", tests: [{ file: unit, title: "", kind: "partial" }] })]), []);
  assert.match(validate([action({ tests: [{ file: unit, title: "", kind: "real" }] })]).join("\n"), /only a Playwright spec can be a "real" reference/);
  assert.match(
    validate([action({ status: "automated_partial", tests: [{ file: unit, title: "computes", kind: "partial" }] })]).join("\n"),
    /a title can only be verified for a Playwright spec/,
  );
});

test("automated_real_interaction requires a real test, and an expected failure never counts", () => {
  assert.match(validate([action({ tests: [{ file: SPEC, title: "clicks the visible thing", kind: "partial" }] })]).join("\n"), /needs at least one test with kind "real"/);
  const xf = fakeRegistry([[SPEC, "clicks the visible thing", "e2e:chromium", "expected_failure"]]);
  assert.match(
    validate([action({ tests: [
      { file: SPEC, title: "clicks the visible thing", kind: "real" },
      { file: SPEC, title: "clicks the visible thing", kind: "expected_failure" },
    ] })], [], xf).join("\n"),
    /expected-failure test cannot be the coverage/,
  );
});

test("a real claim fails for every claimed project where no real test runs as a pass", () => {
  for (const classification of ["skipped", "expected_failure", "fixme", "unknown"]) {
    const registry = fakeRegistry([
      [SPEC, "clicks the visible thing", "e2e:chromium", "runnable"],
      [SPEC, "clicks the visible thing", "e2e:chromium-mobile", classification],
    ]);
    const errors = validate([action({ scope: ["chromium", "chromium-mobile"] })], [], registry).join("\n");
    assert.match(errors, new RegExp(`no "real" test runs as a pass in chromium-mobile \\("clicks the visible thing": ${classification}\\)`), classification);
    assert.doesNotMatch(errors, /runs as a pass in chromium \(/);
  }
  const desktopOnly = fakeRegistry([[SPEC, "clicks the visible thing", "e2e:chromium", "runnable"]]);
  assert.match(validate([action({ scope: ["chromium-mobile"] })], [], desktopOnly).join("\n"), /chromium-mobile \("clicks the visible thing": not registered\)/);
});

test("two real tests may split the claimed projects between them", () => {
  const registry = fakeRegistry([
    [SPEC, "desktop path", "e2e:chromium", "runnable"],
    [SPEC, "desktop path", "e2e:chromium-mobile", "skipped"],
    [SPEC, "mobile path", "e2e:chromium", "skipped"],
    [SPEC, "mobile path", "e2e:chromium-mobile", "runnable"],
  ]);
  const tests = [
    { file: SPEC, title: "desktop path", kind: "real" },
    { file: SPEC, title: "mobile path", kind: "real" },
  ];
  assert.deepEqual(validate([action({ scope: ["chromium", "chromium-mobile"], tests })], [], registry), []);
});

test("an expected_failure reference must still be test.fail()-annotated, so a fixed defect forces an inventory update", () => {
  const status = { status: "blocked", reason: "known defect", priority: "P2" };
  const tests = [{ file: SPEC, title: "clicks the visible thing", kind: "expected_failure" }];
  assert.match(validate([action({ ...status, tests })]).join("\n"), /marked expected_failure but the test is not test\.fail\(\)-annotated/);
  const xf = fakeRegistry([[SPEC, "clicks the visible thing", "e2e:chromium", "expected_failure"]]);
  assert.deepEqual(validate([action({ ...status, tests })], [], xf), []);
});

test("scope must name real Playwright projects; free-text manual/unit targets are not projects", () => {
  assert.match(validate([action({ scope: ["chromiun"] })]).join("\n"), /unknown Playwright project chromiun/);
  assert.deepEqual(scopeProjectIds(["chromium", "chromium-mobile", "unit", "manual: real phones", "chromium 390 (ux-audit, id+en)"]), [
    "e2e:chromium",
    "e2e:chromium-mobile",
    "ux-audit:",
  ]);
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

// ---------------------------------------------------------------------------
// Exception register.
// ---------------------------------------------------------------------------

function exception(overrides = {}) {
  return {
    actions: ["AUTH-01"],
    category: "physical_device",
    manualCheck: "MAN-X-01",
    reason: "Native UI outside the page",
    blocksRelease: true,
    releaseEvidence: "MAN-X-01 logged PASS",
    futureAutomation: { exists: false, strategy: "Not planned" },
    ...overrides,
  };
}
const pending = { status: "manual_pending", manualCheck: "MAN-X-01", tests: [] };
const partial = { status: "automated_partial", tests: [{ file: SPEC, title: "clicks the visible thing", kind: "partial" }] };
const blockedOn = { status: "blocked", reason: "undecided", finding: "FIND-1", tests: [] };
const finding = [{ id: "FIND-1", actions: ["AUTH-01"] }];
const validateRegister = (actions, exceptions, findings = []) => validate(actions, findings, runnableEverywhere, exceptions);

test("exception register: a complete entry for each outstanding P0/P1 action passes", () => {
  assert.deepEqual(validateRegister([action(pending)], [exception()]), []);
  assert.deepEqual(validateRegister([action(partial)], [exception({ category: "partial_by_rule", manualCheck: undefined, blocksRelease: true })]), []);
  assert.deepEqual(validateRegister([action(blockedOn)], [exception({ category: "product_decision", manualCheck: undefined, finding: "FIND-1" })], finding), []);
  // A verified action that still carries a manual check (the device-only remainder).
  assert.deepEqual(validateRegister([action({ manualCheck: "MAN-X-01" })], [exception({ blocksRelease: false })]), []);
  // P2 and verified actions need no entry.
  assert.deepEqual(validateRegister([action(), action({ id: "AUTH-02", priority: "P2", status: "not_covered", followUp: "later", tests: [] })], []), []);
});

test("exception register negative control: an outstanding P0/P1 action, or a P0/P1 manual check, cannot go unregistered", () => {
  assert.match(validateRegister([action(pending)], []).join("\n"), /AUTH-01: P0 manual_pending has no entry in the exception register/);
  assert.match(validateRegister([action({ ...partial, priority: "P1" })], []).join("\n"), /AUTH-01: P1 automated_partial has no entry/);
  assert.match(validateRegister([action({ manualCheck: "MAN-X-01" })], []).join("\n"), /AUTH-01: manual check MAN-X-01 has no entry/);
  assert.match(validateInventory({ actions: [action(pending)], findings: [] }, ioWith(runnableEverywhere)).join("\n"), /has no entry in the exception register/);
  assert.match(validateInventory({ actions: [action()], findings: [], exceptions: {} }, ioWith(runnableEverywhere)).join("\n"), /exceptions must be an array/);
});

test("exception register negative control: a stale or contradictory entry is rejected", () => {
  const errorsFor = (actions, exceptions, findings) => validateRegister(actions, exceptions, findings).join("\n");
  // The action became real and has no manual check left: the entry must go.
  assert.match(errorsFor([action()], [exception({ category: "partial_by_rule", manualCheck: undefined })]), /every action is verified and no manual check remains -- remove the entry/);
  assert.match(errorsFor([action()], [exception({ category: "partial_by_rule", manualCheck: undefined })]), /partial_by_rule but AUTH-01 is automated_real_interaction/);
  assert.match(errorsFor([action(partial)], [exception({ category: "product_decision", manualCheck: undefined, finding: "FIND-1" })], finding), /product_decision but AUTH-01 is automated_partial/);
  assert.match(errorsFor([action(blockedOn)], [exception({ category: "product_decision", manualCheck: undefined })], finding), /category product_decision needs finding/);
  assert.match(errorsFor([action(blockedOn)], [exception({ category: "product_decision", manualCheck: undefined, finding: "FIND-9" })], finding), /unknown finding FIND-9/);
  assert.match(errorsFor([action(partial)], [exception({ manualCheck: undefined })]), /category physical_device needs manualCheck/);
  assert.match(errorsFor([action(pending)], [exception({ manualCheck: "MAN-Y-09" })]), /manualCheck MAN-Y-09 not found/);
  assert.match(errorsFor([action(pending)], [exception({ manualCheck: undefined, category: "partial_by_rule" })]), /AUTH-01 has manualCheck MAN-X-01, so the entry must name it/);
  assert.match(errorsFor([action(pending)], [exception({ blocksRelease: false })]), /an outstanding P0 action blocks a release/);
  assert.match(errorsFor([action(pending)], [exception({ actions: ["NAV-77"] })]), /references unknown action NAV-77/);
  assert.match(errorsFor([action(pending)], [exception(), exception()]), /AUTH-01 is already in another exception entry/);
  assert.match(errorsFor([action({ ...pending, priority: "P2" })], [exception()]), /AUTH-01 is P2; the register covers P0\/P1 only/);
});

// PR #33 review (Codex P2): entry.manualCheck alone must not keep an entry
// alive. The members decide whether a manual check remains.
test("exception register negative control (PR #33 review): an entry whose manual check no member declares any more is stale", () => {
  const errorsFor = (actions, exceptions) => validateRegister(actions, exceptions).join("\n");
  const stale = /manualCheck MAN-X-01 is not declared by any member action any more -- the entry is stale; remove it or its manualCheck/;
  // Fully automated, the action's own manualCheck removed, the old entry left behind.
  assert.match(errorsFor([action()], [exception({ blocksRelease: false })]), stale);
  assert.match(errorsFor([action({ priority: "P1" })], [exception({ blocksRelease: false })]), stale);
  // Several members, none of which still references the entry's check.
  const mixed = [action(), action({ id: "AUTH-02", priority: "P1" })];
  assert.match(errorsFor(mixed, [exception({ actions: ["AUTH-01", "AUTH-02"], blocksRelease: false })]), stale);
  // An outstanding member does not excuse a manual check nobody declares.
  assert.match(errorsFor([action(partial)], [exception()]), stale);
  // A member that declares a different check than the entry.
  files[PATHS.manual] = "### MAN-X-01 — a manual check\n### MAN-Z-02 — another";
  try {
    const other = errorsFor([action({ manualCheck: "MAN-Z-02" })], [exception({ blocksRelease: false })]);
    assert.match(other, /AUTH-01 has manualCheck MAN-Z-02, so the entry must name it/);
    assert.match(other, stale);
  } finally {
    files[PATHS.manual] = "### MAN-X-01 — a manual check";
  }
});

test("exception register (PR #33 review): a verified action that still declares the entry's manual check keeps a valid entry", () => {
  assert.deepEqual(validateRegister([action({ manualCheck: "MAN-X-01" })], [exception({ blocksRelease: false })]), []);
  // One member still declaring it is enough for a shared entry.
  const shared = [action({ manualCheck: "MAN-X-01" }), action({ id: "AUTH-02", priority: "P1" })];
  assert.deepEqual(validateRegister(shared, [exception({ actions: ["AUTH-01", "AUTH-02"], blocksRelease: false })]), []);
});

// PR #33 review (Codex P2): the register must send the reviewer to the
// decision that actually blocks the action, checked in both directions.
test("exception register negative control (PR #33 review): a product_decision entry must name the finding that blocks its actions", () => {
  const decision = (overrides = {}) => exception({ category: "product_decision", manualCheck: undefined, finding: "FIND-1", ...overrides });
  const errorsFor = (actions, exceptions, findings) => validateRegister(actions, exceptions, findings).join("\n");
  const both = [{ id: "FIND-1", actions: ["AUTH-01"] }, { id: "FIND-2", actions: ["AUTH-01"] }];
  // Correct association in both directions.
  assert.deepEqual(validateRegister([action(blockedOn)], [decision()], both), []);
  // Blocked on FIND-1, entry names FIND-2; both findings exist.
  assert.match(errorsFor([action(blockedOn)], [decision({ finding: "FIND-2" })], both), /AUTH-01 is blocked on FIND-1, but the entry names FIND-2/);
  // The finding does not list the member action.
  assert.match(
    errorsFor([action(blockedOn)], [decision()], [{ id: "FIND-1", actions: ["NAV-01"] }, { id: "FIND-2", actions: [] }]),
    /finding FIND-1 does not list AUTH-01 in its actions/,
  );
  assert.match(errorsFor([action(blockedOn)], [decision()], [{ id: "FIND-1" }]), /finding FIND-1 does not list AUTH-01 in its actions/);
  // The member action declares no finding at all.
  assert.match(
    errorsFor([action({ ...blockedOn, finding: undefined })], [decision()], both),
    /product_decision but AUTH-01 declares no finding; it must declare FIND-1/,
  );
});

test("exception register: every field is required", () => {
  const errors = validateRegister([action(pending)], [{ actions: ["AUTH-01"], manualCheck: "MAN-X-01" }]).join("\n");
  assert.match(errors, /category must be one of physical_device, third_party_auth, partial_by_rule, product_decision/);
  assert.match(errors, /missing reason/);
  assert.match(errors, /missing releaseEvidence/);
  assert.match(errors, /blocksRelease must be true or false/);
  assert.match(errors, /futureAutomation needs exists/);
  assert.match(validateRegister([action(pending)], [exception({ actions: [] })]).join("\n"), /actions must list at least one action id/);
});

test("the report renders the exception register from the inventory", () => {
  const report = renderReport({ inventoryDate: "d", baseline: "b", actions: [action(pending)], findings: [], exceptions: [exception()] });
  assert.match(report, /## Exception register \(P0\/P1 not fully automated\)/);
  assert.match(report, /\| AUTH-01 \(P0, `manual_pending`\) \| Physical \/ native device \| MAN-X-01 \| Native UI outside the page \| Yes \| MAN-X-01 logged PASS \| No: Not planned \|/);
});

test("argument parsing", () => {
  assert.deepEqual(parseArgs([]), { mode: "check", results: [], requireResults: false, evidence: null });
  assert.deepEqual(parseArgs(["check", "--results", "a.json", "--results", "b.json", "--require-results", "--evidence", "out"]), {
    mode: "check",
    results: ["a.json", "b.json"],
    requireResults: true,
    evidence: "out",
  });
  assert.throws(() => parseArgs(["check", "--require-results"]), /needs --results/);
  assert.throws(() => parseArgs(["check", "--evidence", "out"]), /--evidence needs --results/);
  assert.throws(() => parseArgs(["check", "--bogus"]), /unknown argument/);
  assert.throws(() => parseArgs(["lint"]), /mode must be/);
});

// ---------------------------------------------------------------------------
// Negative controls against the real Playwright registry and a real run.
// ---------------------------------------------------------------------------

const FIXTURE_CONFIG = "scripts/journey-coverage-fixtures/playwright.config.ts";
const FIXTURE_SPEC = "scripts/journey-coverage-fixtures/coverage.spec.ts";
const fixtureRegistry = buildRegistry(ROOT, [{ key: "e2e", file: FIXTURE_CONFIG }]);

function fixtureIo() {
  return {
    readFile: (file) => (file in files ? files[file] : readFileSync(path.join(ROOT, file), "utf8")),
    fileExists: (file) => file in files || existsSync(path.join(ROOT, file)),
    registry: fixtureRegistry,
  };
}

function fixtureAction(title, scope = ["desktop", "mobile"], kind = "real", overrides = {}) {
  return action({ scope, tests: [{ file: FIXTURE_SPEC, title, kind }], ...overrides });
}

const validateFixture = (actions) => validateInventory({ actions, findings: [] }, fixtureIo());

test("discovery control: a runnable test in every claimed project passes", () => {
  assert.deepEqual(validateFixture([fixtureAction("passes everywhere")]), []);
  assert.deepEqual(validateFixture([fixtureAction("desktop only by project name", ["desktop"])]), []);
  assert.deepEqual(validateFixture([fixtureAction("mobile only by isMobile", ["mobile"])]), []);
  assert.deepEqual(validateFixture([fixtureAction("member of a mobile-skipped suite", ["desktop"])]), []);
});

test("discovery negative control: a commented-out test, or a renamed test still named in a comment, does not count", () => {
  const source = readFileSync(path.join(ROOT, FIXTURE_SPEC), "utf8");
  for (const title of ["commented-out test", "old title before the rename"]) {
    assert.ok(source.includes(title), `fixture must still mention "${title}" in a comment`);
    assert.match(validateFixture([fixtureAction(title)]).join("\n"), /is not a test Playwright registers/, title);
  }
});

test("discovery negative control: test.skip(), test.fail(), and test.fixme() never count as real coverage", () => {
  for (const [title, classification] of [
    ["unconditional skip in the body", "skipped"],
    ["expected failure in the body", "expected_failure"],
    ["declared skip", "skipped"],
    ["declared expected failure", "expected_failure"],
    ["declared fixme", "fixme"],
    ["member of a skipped suite", "skipped"],
    ["skip under an opaque condition", "unknown"],
  ]) {
    const errors = validateFixture([fixtureAction(title, ["desktop"])]).join("\n");
    assert.match(errors, new RegExp(`no "real" test runs as a pass in desktop \\("${title}": ${classification}\\)`), title);
  }
});

test("discovery negative control: project-specific and suite-level skips are evaluated per project", () => {
  assert.match(validateFixture([fixtureAction("desktop only by project name")]).join("\n"), /runs as a pass in mobile \("desktop only by project name": skipped\)/);
  assert.match(validateFixture([fixtureAction("mobile only by isMobile")]).join("\n"), /runs as a pass in desktop \("mobile only by isMobile": skipped\)/);
  assert.match(validateFixture([fixtureAction("member of a mobile-skipped suite")]).join("\n"), /runs as a pass in mobile \("member of a mobile-skipped suite": skipped\)/);
});

test("discovery control: expected_failure references must point at a test.fail() test", () => {
  const blocked = { status: "blocked", reason: "known defect", priority: "P2" };
  assert.deepEqual(validateFixture([fixtureAction("expected failure in the body", ["desktop"], "expected_failure", blocked)]), []);
  assert.match(
    validateFixture([fixtureAction("passes everywhere", ["desktop"], "expected_failure", blocked)]).join("\n"),
    /marked expected_failure but the test is not test\.fail\(\)-annotated/,
  );
});

// A real run of the fixture project, so run-result handling is proven on
// Playwright's actual JSON output (runtime skips, expected failures).
function runFixtures() {
  const dir = mkdtempSync(path.join(tmpdir(), "journey-coverage-run-"));
  const output = path.join(dir, "results.json");
  try {
    try {
      execFileSync(process.execPath, [path.join(ROOT, "node_modules/@playwright/test/cli.js"), "test", "-c", FIXTURE_CONFIG, "--reporter=json"], {
        cwd: ROOT,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: output },
        stdio: "ignore",
      });
    } catch {
      // Nothing in the fixture fails unexpectedly; a non-zero exit is checked
      // through the report below.
    }
    return JSON.parse(readFileSync(output, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const fixtureReport = runFixtures();
const fixtureTestDir = path.join(ROOT, "scripts/journey-coverage-fixtures");
const fixtureRows = readPlaywrightResults(ROOT, fixtureReport, (testDir) => (path.resolve(testDir) === fixtureTestDir ? "e2e" : null));

test("run results: the fixture run itself has no unexpected outcome", () => {
  assert.equal(fixtureReport.stats.unexpected, 0);
  const outcome = (title, project) => fixtureRows.find((row) => row.title === title && row.projectId === `e2e:${project}`)?.outcome;
  assert.equal(outcome("passes everywhere", "desktop"), "passed");
  assert.equal(outcome("desktop only by project name", "mobile"), "skipped");
  assert.equal(outcome("expected failure in the body", "desktop"), "expected_failure");
  assert.equal(fixtureRows.find((row) => row.title === "member of a mobile-skipped suite")?.fullTitle, "suite skipped on mobile › member of a mobile-skipped suite");
});

test("run results: a real claim is verified only where a real test passed, and a skip or expected failure is an error", () => {
  const verify = (actions) => verifyAgainstResults({ actions }, fixtureRows);

  const passing = verify([fixtureAction("passes everywhere")]);
  assert.deepEqual(passing.errors, []);
  assert.deepEqual(passing.verified, ["AUTH-01 [desktop]", "AUTH-01 [mobile]"]);

  const skipped = verify([fixtureAction("desktop only by project name")]);
  assert.deepEqual(skipped.verified, ["AUTH-01 [desktop]"]);
  assert.match(skipped.errors.join("\n"), /AUTH-01 \[mobile\]: real test "desktop only by project name" ran but was skipped/);

  const xf = verify([fixtureAction("expected failure in the body", ["desktop"])]);
  assert.match(xf.errors.join("\n"), /ran as an expected failure \(test\.fail\)/);

  const notRun = verifyAgainstResults({ actions: [fixtureAction("passes everywhere")] }, []);
  assert.deepEqual(notRun.unverified, ["AUTH-01 [desktop]", "AUTH-01 [mobile]"]);
  assert.deepEqual(notRun.errors, []);
});

// ---------------------------------------------------------------------------
// Evidence for a release reviewer (--evidence), on the same real fixture run.
// ---------------------------------------------------------------------------

const SOURCE = { commit: "0123abc", ref: "staging", event: "workflow_dispatch", runId: "42", runAttempt: "1", runUrl: "https://example.test/runs/42" };
function evidenceFor(actions, rows, requireResults = true) {
  const inventory = { inventoryDate: "2026-10-09", actions };
  return buildEvidence({
    inventory,
    outcome: verifyAgainstResults(inventory, rows),
    reports: [{ file: "/tmp/somewhere/results.json", report: fixtureReport }],
    requireResults,
    source: SOURCE,
  });
}

test("evidence: every claim exercised and passed is reported as such, with the commit and the counts", () => {
  const evidence = evidenceFor([fixtureAction("passes everywhere")], fixtureRows);
  assert.equal(evidence.everyRealClaimExercisedAndPassed, true);
  assert.deepEqual(evidence.realClaims, { total: 2, passed: 2, notExercised: [], failed: [], passedOnlyOnRetry: [] });
  assert.equal(evidence.source.commit, "0123abc");
  assert.deepEqual(evidence.inventory.outstandingP0P1, []);
  assert.equal(evidence.results[0].file, "somewhere/results.json");
  assert.equal(evidence.results[0].unexpected, 0);
  // Same inputs, same evidence: nothing is read from the clock or the environment.
  assert.deepEqual(evidenceFor([fixtureAction("passes everywhere")], fixtureRows), evidence);
  const markdown = renderEvidence(evidence);
  assert.match(markdown, /\*\*PASS\*\* -- every real claim was exercised and passed on `0123abc`/);
  assert.match(markdown, /\| Real claims \(action x project\) \| 2 \|/);
  assert.match(markdown, /\| Not exercised \| 0 \|/);
  assert.match(markdown, /\[42\]\(https:\/\/example\.test\/runs\/42\) \(attempt 1\)/);
});

test("evidence negative control: a claim that was not exercised, or did not pass, is never reported as verified", () => {
  const notRun = evidenceFor([fixtureAction("passes everywhere")], []);
  assert.equal(notRun.everyRealClaimExercisedAndPassed, false);
  assert.deepEqual(notRun.realClaims.notExercised, ["AUTH-01 [desktop]", "AUTH-01 [mobile]"]);
  assert.match(renderEvidence(notRun), /\*\*FAIL\*\*/);
  assert.match(renderEvidence(notRun), /\| Not exercised \| 2: AUTH-01 \[desktop\], AUTH-01 \[mobile\] \|/);

  const skipped = evidenceFor([fixtureAction("desktop only by project name")], fixtureRows);
  assert.equal(skipped.everyRealClaimExercisedAndPassed, false);
  assert.deepEqual(skipped.realClaims.failed, ["AUTH-01 [mobile]"]);
  assert.equal(skipped.realClaims.total, 2);
  assert.match(renderEvidence(skipped), /- AUTH-01 \[mobile\]: real test "desktop only by project name" ran but was skipped/);

  // Without --require-results a green check proves less, and the evidence says so.
  const lenient = evidenceFor([fixtureAction("passes everywhere")], fixtureRows, false);
  assert.equal(lenient.everyRealClaimExercisedAndPassed, false);
  assert.match(renderEvidence(lenient), /NOT A FULL VERIFICATION/);
  // An inventory with no real claim at all is not "every claim passed".
  assert.equal(evidenceFor([], fixtureRows).everyRealClaimExercisedAndPassed, false);
});

// The CLI itself, as the Journey coverage (full) workflow calls it.
function runCli(args, env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(ROOT, "scripts/journey-coverage.mjs"), ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    return { status: error.status, output: `${error.stdout}${error.stderr}` };
  }
}

test("CLI negative control: a results file that does not exist or is not JSON fails clearly, and writes no evidence", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "journey-coverage-cli-"));
  try {
    const missing = runCli(["check", "--results", path.join(dir, "nope.json"), "--require-results", "--evidence", dir]);
    assert.equal(missing.status, 2);
    assert.match(missing.output, /cannot read Playwright results file .*nope\.json/);
    assert.match(missing.output, /no claim was checked against a run/);
    assert.equal(existsSync(path.join(dir, EVIDENCE_FILES.json)), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI negative control: results from the wrong run fail --require-results and the evidence says FAIL", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "journey-coverage-cli-"));
  try {
    // The fixture project's results are a real Playwright report that
    // exercises none of the repository's claims.
    const wrong = path.join(dir, "wrong-results.json");
    writeFileSync(wrong, JSON.stringify(fixtureReport));
    const run = runCli(["check", "--results", wrong, "--require-results", "--evidence", dir], { GITHUB_SHA: "feedc0de" });
    assert.equal(run.status, 1);
    assert.match(run.output, /0 real claim\(s\) passed in the run/);
    assert.match(run.output, /not exercised by the given run results/);
    assert.match(run.output, /most real claims \(\d+ of \d+\) were not exercised -- check that --results points at the full/);
    const evidence = JSON.parse(readFileSync(path.join(dir, EVIDENCE_FILES.json), "utf8"));
    assert.equal(evidence.everyRealClaimExercisedAndPassed, false);
    assert.equal(evidence.source.commit, "feedc0de");
    assert.equal(evidence.realClaims.passed, 0);
    assert.equal(evidence.realClaims.notExercised.length, evidence.realClaims.total);
    assert.match(readFileSync(path.join(dir, EVIDENCE_FILES.markdown), "utf8"), /\*\*FAIL\*\* -- not every real claim was exercised and passed on `feedc0de`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The real repository.
// ---------------------------------------------------------------------------

test("regression (PR #25 review): the NAV-03 title repeated in a comment in add-deal-dialog.spec.ts resolves to the real test, not the comment", () => {
  const registry = buildRegistry(ROOT, PLAYWRIGHT_CONFIGS);
  const file = "e2e/deals/add-deal-dialog.spec.ts";
  const inventory = JSON.parse(readFileSync(path.join(ROOT, PATHS.inventory), "utf8"));
  const nav03 = inventory.actions.find((item) => item.id === "NAV-03");
  const ref = nav03.tests.find((item) => item.file === file);
  const source = readFileSync(path.join(ROOT, file), "utf8");
  assert.ok(source.split(ref.title).length > 2, "the title is expected to appear more than once (test + comment)");
  const hits = registry.find(file, ref.title);
  assert.ok(hits.length > 0);
  // Every hit is the one registered test declaration, never the comment.
  assert.equal(new Set(hits.map((hit) => hit.fullTitle)).size, 1);
});

test("the checked-in inventory is valid and its generated report is current", () => {
  const registry = buildRegistry(ROOT, PLAYWRIGHT_CONFIGS);
  const realIo = {
    readFile: (file) => readFileSync(path.join(ROOT, file), "utf8"),
    fileExists: (file) => existsSync(path.join(ROOT, file)),
    registry,
  };
  const inventory = JSON.parse(realIo.readFile(PATHS.inventory));
  assert.deepEqual(validateInventory(inventory, realIo), []);
  assert.equal(realIo.readFile(PATHS.report), renderReport(inventory));
});
