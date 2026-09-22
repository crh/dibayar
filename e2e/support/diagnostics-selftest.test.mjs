// Proves e2e/support/test.ts's browserDiagnostics fixture still fails a test
// on a real pageerror/5xx, and does not false-positive on a clean page. Runs
// the synthetic spec (e2e/support/synthetic/diagnostics-negative-control.ts)
// as a real Playwright subprocess -- following the same isolated-subprocess
// pattern as scripts/cron-guard.test.mjs -- because the behavior under test
// (the fixture's teardown throwing based on Playwright's own testInfo.status)
// can only be observed by actually running a test through it, not by calling
// a function directly. Deleting a bad substring or making the fixture a
// no-op would silently defeat every downstream E2E run's error detection;
// this is the harness verification test that makes that regression loud.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const REPORT_PATH = join(ROOT, "test-results", "diagnostics-selftest", "results.json");

function collectSpecs(node, acc = []) {
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node.specs)) acc.push(...node.specs);
  if (Array.isArray(node.suites)) for (const suite of node.suites) collectSpecs(suite, acc);
  return acc;
}

function specErrorText(spec) {
  const messages = [];
  for (const t of spec.tests ?? []) {
    for (const r of t.results ?? []) {
      for (const e of r.errors ?? []) if (e?.message) messages.push(e.message);
      if (r.error?.message) messages.push(r.error.message);
    }
  }
  return messages.join("\n");
}

test("browserDiagnostics negative control: fixture fails on a real pageerror and a real 5xx, and does not false-positive on a clean page", () => {
  rmSync(REPORT_PATH, { force: true });

  const run = spawnSync(
    "npx",
    ["playwright", "test", "-c", "playwright.diagnostics-selftest.config.ts"],
    { cwd: ROOT, encoding: "utf8" },
  );

  assert.ok(
    existsSync(REPORT_PATH),
    `Playwright produced no report at ${REPORT_PATH}.\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
  );

  // The run as a whole must fail -- proving a real CI job invoking this
  // config would go red, not merely that some internal object says "failed".
  assert.notEqual(run.status, 0, `Expected the synthetic run to exit non-zero.\nstdout:\n${run.stdout}`);

  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  const specs = collectSpecs({ suites: report.suites });
  const byTitle = Object.fromEntries(specs.map((spec) => [spec.title, spec]));

  const pageErrorSpec = byTitle["fails a test on a deliberate unhandled page error"];
  assert.ok(pageErrorSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(pageErrorSpec.ok, false, "the pageerror spec must be reported as failed");
  const pageErrorText = specErrorText(pageErrorSpec);
  assert.match(pageErrorText, /Unexpected browser diagnostics/);
  assert.match(pageErrorText, /synthetic-pageerror-selftest/);

  const serverErrorSpec = byTitle["fails a test on a deliberate 5xx response"];
  assert.ok(serverErrorSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(serverErrorSpec.ok, false, "the 5xx spec must be reported as failed");
  const serverErrorText = specErrorText(serverErrorSpec);
  assert.match(serverErrorText, /Unexpected browser diagnostics/);
  assert.match(serverErrorText, /500 https:\/\/example\.invalid\/synthetic-500/);

  // Control case: if this one also failed, the harness is just broken (e.g.
  // browsers not installed), not proving anything about the fixture.
  const controlSpec = byTitle["does not fail a clean test (control)"];
  assert.ok(controlSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(controlSpec.ok, true, "the control spec must still pass");
});
