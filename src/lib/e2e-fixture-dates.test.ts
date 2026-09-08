import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format/date";
import { DUE_SOON_WINDOW_DAYS, daysUntilDue } from "@/lib/invoice-date-status";
import { FIXTURE_FUTURE_DATE, FIXTURE_PAST_DATE } from "./e2e-fixture-dates";

// Guards against a regression this repo hit for real: these dates are read
// into invoice fixtures that get rendered into checked-in visual-regression
// screenshots (see e2e/visual/visual.spec.ts), so their formatted text must
// never depend on when the test happens to run.
describe("E2E/visual fixture reference dates", () => {
  it("FIXTURE_FUTURE_DATE renders a fixed calendar date, not one derived from now()", () => {
    expect(formatDate(FIXTURE_FUTURE_DATE)).toBe("31 Des 2099");
  });

  it("FIXTURE_PAST_DATE renders a fixed calendar date, not one derived from now()", () => {
    expect(formatDate(FIXTURE_PAST_DATE)).toBe("1 Jan 2020");
  });

  it("FIXTURE_FUTURE_DATE stays outside the due-soon/overdue window indefinitely", () => {
    // Checked against both today and a date decades out: the invariant the
    // visual baselines depend on (this invoice never shows up as
    // due-soon/overdue -- see src/components/home/follow-up-queue.tsx)
    // must hold no matter which real calendar day the suite runs on, not
    // just today.
    const farFutureNow = new Date("2090-01-01T00:00:00.000Z");
    expect(daysUntilDue(FIXTURE_FUTURE_DATE, new Date())).toBeGreaterThan(DUE_SOON_WINDOW_DAYS);
    expect(daysUntilDue(FIXTURE_FUTURE_DATE, farFutureNow)).toBeGreaterThan(DUE_SOON_WINDOW_DAYS);
  });
});
