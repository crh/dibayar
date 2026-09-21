#!/usr/bin/env node
// `npm run ux:audit` orchestrator. Runs, in order:
//   1. seed the tests/ux-audit fixture pipeline (ux-fixtures.ts). The @visual
//      suite's own fixtures (e2e-fixtures.ts) are seeded automatically by
//      playwright.e2e.config.ts's globalSetup -- no separate step needed.
//   2. a production build (shared by both Playwright configs' webServer)
//   3. the deterministic/state/synthetic tests/ux-audit specs
//      (playwright.config.ts)
//   4. the existing @visual regression suite (playwright.e2e.config.ts),
//      skipped in --route=<x> focused mode (see below)
//   5. scripts/ux-report.ts, which reads both runs' JSON output and writes
//      artifacts/ux-audit/UX-AUDIT-REPORT.md
//
// Exit code is the REPORT's verdict (CRITICAL/HIGH findings => non-zero),
// not simply "did every Playwright process exit 0" -- a spec failing is
// data for the report, not a crash. An actual infrastructure failure
// (fixture seed or build failing) does abort immediately, since no
// meaningful report can be produced without it.
//
// Usage: npm run ux:audit [-- --route=/deal]
// See docs/testing/UX_AUDIT.md "Running a route-focused audit".
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const routeArg = process.argv.slice(2).find((arg) => arg.startsWith("--route="))?.slice("--route=".length);

function run(command: string, args: string[], extraEnv: Record<string, string> = {}): number {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runOrAbort(step: string, command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const status = run(command, args, extraEnv);
  if (status !== 0) {
    console.error(`\nux:audit: aborting -- "${step}" exited ${status}`);
    process.exit(status);
  }
}

// scripts/ux-report.ts can only turn a Playwright run's own crash into a
// reportable CRITICAL finding if that run got far enough to write *some*
// JSON reporter output (Playwright does this even when e.g. its webServer
// fails to start, recording the fatal error in the JSON's top-level
// `errors` array). If the process is killed/crashes before the reporter
// itself is ever initialized (a segfault, an OOM kill, `npx` failing to
// resolve at all), no results file exists, ux-report.ts has nothing to
// read for that run, and its "no findings for this run" default has no
// way to distinguish that from "genuinely nothing failed" -- so it would
// report NOT_RUN/PASS and this whole gate would silently exit 0 having
// tested nothing. Abort here instead of handing that case to the report.
function runPlaywrightOrAbort(step: string, args: string[], resultsJsonPath: string) {
  // A stale results.json from a previous run would otherwise let this
  // run's own crash go unnoticed by the existsSync check below.
  rmSync(resultsJsonPath, { force: true });
  const status = run("npx", args);
  if (!existsSync(resultsJsonPath)) {
    console.error(
      `\nux:audit: aborting -- "${step}" exited ${status} and produced no ${path.relative(process.cwd(), resultsJsonPath)}; ` +
        "the report has no run to read for this suite, so it cannot be trusted to reflect what actually happened.",
    );
    process.exit(status !== 0 ? status : 1);
  }
}

async function main() {
  console.log(`ux:audit starting${routeArg ? ` (focused: --route=${routeArg})` : ""}`);

  runOrAbort("seed ux-audit fixtures", "npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/ux-fixtures.ts", "seed"], {
    UX_FIXTURE_CONFIRM: "non-production",
  });

  // Keep the browser server on the same explicit webpack build as the E2E
  // commands. The app's general `build` script may use Next's default
  // Turbopack path, while this verification job needs one reproducible build
  // strategy across local and CI runners.
  runOrAbort("build", "npm", ["run", "e2e:build"]);

  // Playwright's own exit code is otherwise informational here -- see header
  // comment -- but the run must at least have produced a results.json for
  // the report to read; see runPlaywrightOrAbort. The route filter matches
  // against test titles (see routes/matrix.spec.ts and
  // routes/deals.desktop-scroll.spec.ts titles), so `--route=/deal` matches
  // "deals / ..." and "... Deals board ..." titles.
  const uxAuditArgs = ["playwright", "test", "-c", "playwright.config.ts"];
  if (routeArg) uxAuditArgs.push("--grep", routeArg.replace(/^\//, ""));
  runPlaywrightOrAbort("tests/ux-audit run", uxAuditArgs, path.resolve("test-results/ux-audit/results.json"));

  if (!routeArg) {
    runPlaywrightOrAbort(
      "e2e @visual run",
      ["playwright", "test", "-c", "playwright.e2e.config.ts", "--project=chromium", "--grep", "@visual"],
      path.resolve("test-results/e2e/results.json"),
    );
  }

  const reportStatus = run("npx", ["tsx", "scripts/ux-report.ts"]);
  process.exit(reportStatus);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(2);
});
