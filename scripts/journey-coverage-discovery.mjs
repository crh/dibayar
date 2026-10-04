// Test discovery for scripts/journey-coverage.mjs. A test reference in the
// journey inventory counts only when it names a test that Playwright itself
// registers, in the project(s) the action claims, and that is not skipped,
// fixme'd, or expected to fail there. A matching string in a comment, a
// renamed test, or a test.skip()/test.fail() therefore no longer passes.
//
// Two sources of truth, both structural rather than text search:
//
// 1. Playwright's registry (`playwright test --list` with
//    journey-coverage-list-reporter.mjs): which tests exist, per project,
//    with declaration-level modifiers (test.skip("t", fn), test.fail("t", fn),
//    test.describe.skip, test.fixme) already resolved into expectedStatus.
//
// 2. The TypeScript AST of each listed test, for modifiers that Playwright
//    only resolves while running: test.skip/fail/fixme(condition) calls in
//    the test body or in an enclosing describe / file scope. Conditions over
//    the project are evaluated per project (testInfo.project.name,
//    browserName, isMobile, literals, !, ===, !==, &&, ||). Anything else is
//    classified "unknown" -- never assumed to run.
//
// Run results (Playwright's JSON reporter output) can then confirm the
// outcome of an actual run: see readPlaywrightResults().
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPORTER = fileURLToPath(new URL("./journey-coverage-list-reporter.mjs", import.meta.url));
const MODIFIERS = new Set(["skip", "fail", "fixme"]);

// Lists every test a Playwright config registers. `root` is the repository
// root; returned files are repository-relative with forward slashes.
export function listPlaywrightTests(root, configFile) {
  const dir = mkdtempSync(path.join(tmpdir(), "journey-coverage-"));
  const output = path.join(dir, "registry.json");
  try {
    execFileSync(
      process.execPath,
      [path.join(root, "node_modules/@playwright/test/cli.js"), "test", "-c", configFile, "--list", `--reporter=${REPORTER}`],
      { cwd: root, env: { ...process.env, JOURNEY_COVERAGE_LIST_OUTPUT: output }, stdio: ["ignore", "ignore", "pipe"] },
    );
    const registry = JSON.parse(readFileSync(output, "utf8"));
    return {
      projects: registry.projects,
      tests: registry.tests.map((test) => ({ ...test, file: toRepoPath(root, test.file) })),
    };
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    throw new Error(`playwright --list failed for ${configFile}${stderr ? `:\n${stderr}` : `: ${error.message}`}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function toRepoPath(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// Runtime-modifier analysis
// ---------------------------------------------------------------------------

// Result per project: "runnable" | "skipped" | "expected_failure" | "fixme" |
// "unknown" (a modifier whose condition can't be evaluated statically).
export function classifyTest(source, fileName, test, project) {
  const declared = declaredClassification(test);
  if (declared) return declared;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const call = findTestCall(sourceFile, test.line, test.column);
  if (!call) return "unknown";
  let result = "runnable";
  for (const modifier of collectModifiers(call)) {
    const verdict = evaluateModifier(modifier, project);
    result = combine(result, verdict);
  }
  return result;
}

function declaredClassification(test) {
  if (test.annotations.includes("fixme")) return "fixme";
  if (test.expectedStatus === "skipped") return "skipped";
  // test.fail("title", fn) is still expectedStatus "passed" at list time;
  // the declaration shows up as a "fail" annotation.
  if (test.expectedStatus === "failed" || test.annotations.includes("fail")) return "expected_failure";
  return null;
}

// Severity order: once something is known not to run as a pass, keep the
// strongest reason; "unknown" outranks "runnable" but not a certain skip.
const RANK = { runnable: 0, unknown: 1, expected_failure: 2, fixme: 3, skipped: 3 };
function combine(current, next) {
  return RANK[next] > RANK[current] ? next : current;
}

// Playwright reports a test's location (1-based line and column) from the
// V8 call site: the `(` right after a plain callee (`test(`), the property
// name of a member callee (`skip` in `test.skip(`), or the call start.
function findTestCall(sourceFile, line, column) {
  const position = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);
  let found = null;
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      (node.expression.getEnd() === position ||
        node.getStart(sourceFile) === position ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.getStart(sourceFile) === position)) &&
      testCallback(node)
    ) {
      found = node;
      return;
    }
    if (node.getStart(sourceFile) <= position && position < node.getEnd()) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function testCallback(call) {
  const fn = call.arguments.at(-1);
  return fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) ? fn : null;
}

// Modifier calls that apply to this test: in its own body (statements of the
// callback, not nested functions), then in each enclosing describe callback
// and the file's top level (statements only, so another test's declaration
// such as test.skip("title", fn) is not mistaken for a modifier).
function collectModifiers(call) {
  const modifiers = [];
  const callback = testCallback(call);
  const testInfoName = parameterName(callback, 1);
  collectFromBody(callback.body, modifiers, { testInfoName, inBody: true });

  let node = call.parent;
  while (node) {
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent) && isDescribeCall(node.parent)) {
      collectFromBody(node.body, modifiers, { testInfoName: null, inBody: false });
    } else if (ts.isSourceFile(node)) {
      collectFromBody(node, modifiers, { testInfoName: null, inBody: false });
    }
    node = node.parent;
  }
  return modifiers;
}

function parameterName(fn, index) {
  const parameter = fn?.parameters[index];
  return parameter && ts.isIdentifier(parameter.name) ? parameter.name.text : null;
}

function isDescribeCall(call) {
  let expression = call.expression;
  while (ts.isPropertyAccessExpression(expression)) {
    if (expression.name.text === "describe") return true;
    expression = expression.expression;
  }
  return false;
}

function modifierCall(node, testInfoName) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  const { expression: target, name } = node.expression;
  if (!MODIFIERS.has(name.text) || !ts.isIdentifier(target)) return null;
  if (target.text !== "test" && target.text !== testInfoName) return null;
  // test.skip("title", fn) / test.fail("title", fn) declare a different
  // test; Playwright resolves those itself (expectedStatus).
  if (node.arguments.some((arg) => (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) && arg.body && ts.isBlock(arg.body))) return null;
  return { kind: name.text, args: node.arguments };
}

function collectFromBody(body, modifiers, { testInfoName, inBody }) {
  if (!body) return;
  const statements = ts.isBlock(body) || ts.isSourceFile(body) ? body.statements : null;
  if (!statements) return; // expression-bodied arrow: nothing to collect
  for (const statement of statements) {
    if (ts.isExpressionStatement(statement)) {
      const direct = modifierCall(statement.expression, testInfoName);
      if (direct) {
        modifiers.push(direct);
        continue;
      }
    }
    if (!inBody) continue;
    // A modifier under control flow inside the body (if/for/try/...) runs
    // only sometimes: its condition is opaque, so it is "unknown".
    const visit = (node) => {
      if (ts.isFunctionLike(node)) return;
      const nested = modifierCall(node, testInfoName);
      if (nested) modifiers.push({ ...nested, opaque: true });
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(statement, visit);
  }
}

function evaluateModifier(modifier, project) {
  const verdictIfTrue = modifier.kind === "fail" ? "expected_failure" : modifier.kind === "fixme" ? "fixme" : "skipped";
  if (modifier.opaque) return "unknown";
  if (modifier.args.length === 0) return verdictIfTrue;
  const [condition] = modifier.args;
  // test.skip("reason") with only a string is an unconditional skip.
  if (ts.isStringLiteralLike(condition) && modifier.args.length === 1) return verdictIfTrue;
  const value = evaluateCondition(condition, project, null);
  if (value === true) return verdictIfTrue;
  if (value === false) return "runnable";
  return "unknown";
}

const UNKNOWN = Symbol("unknown");

// Evaluates a skip/fail condition for one project. `bindings` maps local
// names (from a describe-level callback's destructured fixtures) to facts.
function evaluateCondition(node, project, bindings) {
  const value = evaluate(node, project, bindings);
  return typeof value === "boolean" ? value : null;
}

function evaluate(node, project, bindings) {
  if (ts.isParenthesizedExpression(node)) return evaluate(node.expression, project, bindings);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    // test.skip(({ isMobile }) => isMobile, "...") -- describe-level form.
    const local = {};
    const [parameter] = node.parameters;
    if (parameter && ts.isObjectBindingPattern(parameter.name)) {
      for (const element of parameter.name.elements) {
        const key = (element.propertyName ?? element.name).getText();
        if (ts.isIdentifier(element.name)) local[element.name.text] = key;
      }
    }
    if (!ts.isBlock(node.body)) return evaluate(node.body, project, local);
    return UNKNOWN;
  }
  if (ts.isIdentifier(node)) {
    const fact = bindings ? bindings[node.text] : node.text;
    if (fact === "isMobile") return project.isMobile;
    if (fact === "browserName") return project.browserName;
    return UNKNOWN;
  }
  // <testInfo>.project.name
  if (ts.isPropertyAccessExpression(node) && node.name.text === "name" && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "project") {
    return project.name;
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const value = evaluate(node.operand, project, bindings);
    return typeof value === "boolean" ? !value : UNKNOWN;
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    const left = evaluate(node.left, project, bindings);
    const right = evaluate(node.right, project, bindings);
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      if (left === false || right === false) return false;
      return left === true && right === true ? true : UNKNOWN;
    }
    if (op === ts.SyntaxKind.BarBarToken) {
      if (left === true || right === true) return true;
      return left === false && right === false ? false : UNKNOWN;
    }
    if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
    if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken) return left === right;
    if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken) return left !== right;
  }
  return UNKNOWN;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Builds the lookup the validator uses:
//   find(file, title) -> [{ projectId, classification, titlePath }]
// `configs` is [{ key, file }]; project ids are `${key}:${projectName}`.
export function buildRegistry(root, configs, { list = listPlaywrightTests, readSource } = {}) {
  const read = readSource ?? ((file) => readFileSync(path.join(root, file), "utf8"));
  const entries = [];
  const projectIds = [];
  const testDirs = new Set();
  const sources = new Map();
  for (const config of configs) {
    const { projects, tests } = list(root, config.file);
    const byName = new Map(projects.map((project) => [project.name, project]));
    for (const project of projects) {
      projectIds.push(`${config.key}:${project.name}`);
      testDirs.add(toRepoPath(root, project.testDir));
    }
    for (const test of tests) {
      if (!sources.has(test.file)) sources.set(test.file, read(test.file));
      const project = byName.get(test.project);
      entries.push({
        file: test.file,
        title: test.titlePath.at(-1),
        fullTitle: test.titlePath.join(" › "),
        projectId: `${config.key}:${test.project}`,
        classification: classifyTest(sources.get(test.file), test.file, test, project),
      });
    }
  }
  return {
    projectIds,
    // Repository-relative test directories: a reference under one of these
    // is a Playwright spec and must resolve through this registry.
    testDirs: [...testDirs],
    files: new Set(entries.map((entry) => entry.file)),
    find(file, title) {
      return entries.filter((entry) => entry.file === file && (entry.title === title || entry.fullTitle === title));
    },
  };
}

// ---------------------------------------------------------------------------
// Run results
// ---------------------------------------------------------------------------

// Reads one Playwright JSON reporter output (e.g. test-results/e2e/results.json)
// into outcome rows: { file, title, fullTitle, projectId, outcome } where
// outcome is "passed" | "flaky" | "skipped" | "expected_failure" | "failed".
// `configKeyForTestDir(absTestDir)` maps a project's testDir to a config key.
export function readPlaywrightResults(root, report, configKeyForTestDir) {
  const projects = new Map((report.config?.projects ?? []).map((project) => [project.name, project]));
  const rows = [];
  // Top-level suites are files; nested suites are describes.
  const visit = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const project = projects.get(test.projectName);
        if (!project) continue;
        const key = configKeyForTestDir(project.testDir);
        if (!key) continue;
        const file = toRepoPath(root, path.join(project.testDir, spec.file));
        rows.push({
          file,
          title: spec.title,
          fullTitle: [...titles, spec.title].join(" › "),
          projectId: `${key}:${test.projectName}`,
          outcome: outcomeOf(test),
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title]);
  };
  for (const suite of report.suites ?? []) visit(suite, []);
  return rows;
}

function outcomeOf(test) {
  const last = test.results?.at(-1);
  if (test.status === "skipped" || last?.status === "skipped") return "skipped";
  if (test.expectedStatus === "failed") return "expected_failure";
  if (test.status === "expected" && last?.status === "passed") return "passed";
  if (test.status === "flaky") return "flaky";
  return "failed";
}
