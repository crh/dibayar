// Re-runs the fixture seed synchronously. globalSetup/globalTeardown (see
// e2e/global-setup.ts) only run once per `playwright test` invocation, not
// once per project -- but test:e2e and test:e2e:critical run the chromium
// and chromium-mobile projects in the SAME invocation, sharing one database.
// Any test that mutates shared owner data (moves a deal's stage, creates an
// invoice, deletes a session on sign-out) must reseed first, or the second
// project to run inherits the first project's mutations and its assertions
// about "the deal at stage X" / "this deal has no invoice yet" go stale.
// Tests that only read/filter (deal-filter-navigation, add-deal-dialog) need
// no reseed -- they never mutate fixture rows.
import { execFileSync } from "node:child_process";

function runFixtureAction(action: "seed" | "legacy-due-date"): void {
  const env = { ...process.env, E2E_FIXTURE_CONFIRM: "non-production" };
  execFileSync("npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/e2e-fixtures.ts", action], {
    stdio: "inherit",
    env,
  });
}

export function reseedFixtures(): void {
  runFixtureAction("seed");
}

// Overwrites the seeded SENT invoice's due date with year 0002 (the value
// FIND-03 used to let through). Only meaningful after reseedFixtures(), which
// also undoes it for the next test.
export function seedLegacyInvalidDueDate(): void {
  runFixtureAction("legacy-due-date");
}
