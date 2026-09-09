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

async function main() {
  console.log(`ux:audit starting${routeArg ? ` (focused: --route=${routeArg})` : ""}`);

  runOrAbort("seed ux-audit fixtures", "npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/ux-fixtures.ts", "seed"], {
    UX_FIXTURE_CONFIRM: "non-production",
  });

  runOrAbort("build", "npm", ["run", "build"]);

  // Playwright's own exit code is informational here -- see header comment.
  // The route filter matches against test titles (see routes/matrix.spec.ts
  // and routes/deals.desktop-scroll.spec.ts titles), so `--route=/deal`
  // matches "deals / ..." and "... Deals board ..." titles.
  const uxAuditArgs = ["playwright", "test", "-c", "playwright.config.ts"];
  if (routeArg) uxAuditArgs.push("--grep", routeArg.replace(/^\//, ""));
  run("npx", uxAuditArgs);

  if (!routeArg) {
    run("npx", ["playwright", "test", "-c", "playwright.e2e.config.ts", "--project=chromium", "--grep", "@visual"]);
  }

  const reportStatus = run("npx", ["tsx", "scripts/ux-report.ts"]);
  process.exit(reportStatus);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(2);
});
