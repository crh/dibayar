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

function runFixtureAction(action: "seed" | "legacy-due-date" | "follow-up-states" | "follow-up-expired-share" | "income-boundaries" | "status-consistency" | "expire-disposable-session" | "incomplete-issuer-settings" | "invoice-table-outage" | "end-invoice-table-outage"): void {
  const env = { ...process.env, E2E_FIXTURE_CONFIRM: "non-production" };
  execFileSync("npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/e2e-fixtures.ts", action], {
    stdio: "inherit",
    env,
    // execFileSync blocks the worker, so Playwright's own timeout cannot end
    // a fixture action that hangs (a lock, a dead database).
    timeout: 60_000,
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

// Reseeds, then adds the follow-up overlay (scripts/e2e-fixtures.ts
// applyFollowUpStates): overdue, due-today, due-in-7/8-days invoices and a
// deal with an invalid WhatsApp number. The base seed stays exactly as
// before, so specs that apply this must reseed again in afterEach -- the
// read-only specs (filter-navigation, add-deal-dialog) and the @visual
// baselines assume the seven-deal, empty-queue base state.
export function applyFollowUpStates(): void {
  runFixtureAction("seed");
  runFixtureAction("follow-up-states");
}

// The follow-up overlay, plus an already-expired share on its stored-OVERDUE
// invoice (scripts/e2e-fixtures.ts followUpExpiredShare). Reseed afterwards,
// like every overlay.
export function applyFollowUpExpiredShare(): void {
  applyFollowUpStates();
  runFixtureAction("follow-up-expired-share");
}

// Reseeds, then adds four invoices on the edges of the "this Jakarta month,
// not a draft" rule behind Beranda's monthly total (scripts/e2e-fixtures.ts
// applyIncomeBoundaries). Reseed afterwards, like every overlay.
export function applyIncomeBoundaries(): void {
  runFixtureAction("seed");
  runFixtureAction("income-boundaries");
}

// The follow-up overlay, plus five invoices whose stored status and due date
// disagree (scripts/e2e-fixtures.ts applyStatusConsistency): stored DUE due
// yesterday, legacy stored OVERDUE that is not past due, and DRAFT/PAID with
// a past due date. Reseed afterwards, like every overlay.
export function applyStatusConsistency(): void {
  applyFollowUpStates();
  runFixtureAction("status-consistency");
}

// Expires the owner's disposable session while leaving its row in place
// (scripts/e2e-fixtures.ts expireDisposableSession). Does not reseed: it is
// called mid-test, with a page already open on that session. Reseed before
// the test (the row may have been consumed) and it is restored by the next
// seed.
export function expireDisposableOwnerSession(): void {
  runFixtureAction("expire-disposable-session");
}

// Reseeds, then removes the owner's UserSettings row (scripts/e2e-fixtures.ts
// incompleteIssuerSettings): an account that never saved Pengaturan. Reseed
// afterwards, like every overlay.
export function applyIncompleteIssuerSettings(): void {
  runFixtureAction("seed");
  runFixtureAction("incomplete-issuer-settings");
}

// Makes the Invoice table unavailable to the app (scripts/e2e-fixtures.ts
// invoiceTableOutage): every query on it fails until the outage ends. Called
// mid-test with a page open; does not reseed. Always pair it with
// endInvoiceTableOutage() in the test and in afterEach -- every other fixture
// action ends a left-over outage too, but a spec must not rely on that.
export function startInvoiceTableOutage(): void {
  runFixtureAction("invoice-table-outage");
}

// Ends the outage; safe to call when there is none.
export function endInvoiceTableOutage(): void {
  runFixtureAction("end-invoice-table-outage");
}
