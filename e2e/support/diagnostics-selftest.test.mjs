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

  // Regression coverage for the WebKit cross-browser finding: the /i/ 404
  // allowlist in e2e/support/test.ts must stay narrow (a 404 elsewhere keeps
  // failing) and must actually fire for its one intended case (an /i/ 404
  // gets suppressed, not silently broken by a future edit).
  const outsideINotFoundSpec = byTitle["does not suppress a 404 console error outside /i/ paths"];
  assert.ok(outsideINotFoundSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(outsideINotFoundSpec.ok, false, "a 404 outside /i/ paths must still be reported as failed");
  const outsideIText = specErrorText(outsideINotFoundSpec);
  assert.match(outsideIText, /Unexpected browser diagnostics/);
  assert.match(outsideIText, /404 \(Not Found\)/);

  const matchedINotFoundSpec = byTitle["suppresses only the matched /i/ 404 console error (control)"];
  assert.ok(matchedINotFoundSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(matchedINotFoundSpec.ok, true, "the matched /i/ 404 case must still pass (suppressed)");

  // Regression coverage for a codex review finding: suppression must be
  // keyed to the specific response URL, not a bare counter shared across
  // all 404s -- otherwise a suppressed /i/ 404 could leak into an unrelated
  // 404 that happens to fire around the same time.
  const concurrentSpec = byTitle["does not suppress an unrelated 404 fired concurrently with a suppressed /i/ 404"];
  assert.ok(concurrentSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(concurrentSpec.ok, false, "the unrelated concurrent 404 must still be reported as failed");
  const concurrentText = specErrorText(concurrentSpec);
  assert.match(concurrentText, /Unexpected browser diagnostics/);
  assert.match(concurrentText, /404 \(Not Found\)/);

  // Regression coverage for expectedErrorResponses (the server-validation
  // journey's opt-in mechanism): a deliberate 4xx not opted into must still
  // fail, and one that is opted in must be suppressed.
  const noOptinSpec = byTitle["fails a test on a deliberate 400 that was not opted into expectedErrorResponses"];
  assert.ok(noOptinSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(noOptinSpec.ok, false, "a non-opted-in 400 must still be reported as failed");
  const noOptinText = specErrorText(noOptinSpec);
  assert.match(noOptinText, /Unexpected browser diagnostics/);
  assert.match(noOptinText, /400 \(Bad Request\)/);

  const optedInSpec = byTitle["suppresses a deliberate 400 matching expectedErrorResponses (control)"];
  assert.ok(optedInSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(optedInSpec.ok, true, "an opted-in 400 must still pass (suppressed)");
  // The `status` form of expectedErrorResponses: only the named 5xx is
  // suppressed.
  const optedIn500Spec = byTitle["suppresses a deliberate 500 matching an expectedErrorResponses status (control)"];
  assert.ok(optedIn500Spec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(optedIn500Spec.ok, true, "an opted-in 500 must pass (suppressed)");

  const statuslessSpec = byTitle["fails a test on a 500 at an address opted in without a status"];
  assert.ok(statuslessSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(statuslessSpec.ok, false, "a 500 must still fail when the opt-in names no status");
  assert.match(specErrorText(statuslessSpec), /500 https:\/\/example\.invalid\/synthetic-500-statusless-optin/);

  const otherStatusSpec = byTitle["fails a test on a 503 at an address opted in for a 500"];
  assert.ok(otherStatusSpec, `spec not found in report. Titles seen: ${Object.keys(byTitle).join(", ")}`);
  assert.equal(otherStatusSpec.ok, false, "a 5xx other than the named one must still fail");
  assert.match(specErrorText(otherStatusSpec), /503 https:\/\/example\.invalid\/synthetic-500-opted-in/);
});
