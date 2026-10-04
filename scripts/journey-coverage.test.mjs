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
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildRegistry, readPlaywrightResults } from "./journey-coverage-discovery.mjs";
import {
  PATHS,
  PLAYWRIGHT_CONFIGS,
  computeMetrics,
  parseArgs,
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

const validate = (actions, findings = [], registry = runnableEverywhere) => validateInventory({ actions, findings }, ioWith(registry));

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
  assert.deepEqual(validate([action({ status: "automated_partial", tests: [{ file: unit, title: "", kind: "partial" }] })]), []);
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
  const status = { status: "blocked", reason: "known defect" };
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

test("argument parsing", () => {
  assert.deepEqual(parseArgs([]), { mode: "check", results: [], requireResults: false });
  assert.deepEqual(parseArgs(["check", "--results", "a.json", "--results", "b.json", "--require-results"]), {
    mode: "check",
    results: ["a.json", "b.json"],
    requireResults: true,
  });
  assert.throws(() => parseArgs(["check", "--require-results"]), /needs --results/);
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
  const blocked = { status: "blocked", reason: "known defect" };
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
