// "Needs Chasing" (FollowUpQueue, see src/components/home/follow-up-queue.tsx)
// state coverage: both the actionable case (an overdue and a due-soon
// invoice must appear, with the correct urgency reason) and the two
// distinct legitimate-zero cases -- "fresh-user" (no data at all: the
// `zero` fixture) and "nothing-needs-chasing" (real deal/invoice activity,
// but none of it currently qualifies: the `quiet` fixture, whose only
// invoice is PAID). Both zero cases must reach the SAME clear, intentional
// empty-state copy, not a broken/blank widget -- see docs/testing/UX_AUDIT.md
// "Needs Chasing coverage".
import { expect, test } from "@playwright/test";
import { loadUxFixtures, loginAs, goto200, type UxFixtureManifest } from "../support/session";

const QUEUE_SECTION = 'section[aria-labelledby="home-perlu-dikejar"]';

let fixtures: UxFixtureManifest;

test.beforeAll(async () => {
  fixtures = await loadUxFixtures();
});

test.describe("Needs Chasing state coverage", () => {
  test("actionable: overdue and due-soon invoices both appear with the correct reason", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await goto200(page, "/");
    const section = page.locator(QUEUE_SECTION);
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "Perlu dikejar" })).toBeVisible();

    // The overdue invoice (dueDate in the past) must appear and be labeled
    // as overdue, not merely "present somewhere on the page".
    const overdueItem = section.locator(`a[href="/invoice/${fixtures.invoices.overdue}"]`);
    await expect(overdueItem).toBeVisible();
    await expect(overdueItem.getByText(/Telat \d+ hari/)).toBeVisible();

    // The DUE invoice (dueDate === the seed's "now") must appear with a
    // due-today-or-just-overdue reason. Not pinned to exactly one of the two
    // strings: the fixture's dueDate is the seed run's wall-clock instant
    // (see scripts/ux-fixtures.ts), and Asia/Jakarta-calendar-day comparison
    // (see daysUntilDue) can land this on either side of midnight depending
    // on exactly when the seed ran relative to the UTC/Jakarta offset --
    // that is a property of the fixture's clock, not of what's under test
    // here, which is that the item is surfaced with A correct, consistent
    // reason at all (never silently dropped from the queue).
    const dueTodayItem = section.locator(`a[href="/invoice/${fixtures.invoices.due}"]`);
    await expect(dueTodayItem).toBeVisible();
    await expect(dueTodayItem.getByText(/Jatuh tempo hari ini|Telat \d+ hari/)).toBeVisible();

    // The SENT invoice due 14 days out is outside the 7-day due-soon window
    // and must NOT be pulled into the queue.
    await expect(section.locator(`a[href="/invoice/${fixtures.invoices.sent}"]`)).toHaveCount(0);

    // The widget must not incorrectly report zero actionable items.
    await expect(section.getByRole("link").filter({ hasText: /./ })).not.toHaveCount(0);
    await expect(page.getByText("Tidak ada yang perlu dikejar.")).toHaveCount(0);
  });

  test("legitimate zero: fresh-user with no data at all shows the onboarding empty state, not a broken widget", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "zero");
    await goto200(page, "/");

    // With zero deals at all, Beranda renders its own onboarding empty
    // state instead of the composite dashboard (FollowUpQueue included) --
    // a deliberately different, higher-level empty state from "quiet"'s
    // below, not a missing/incomplete render. Asserted explicitly so a
    // regression that silently dropped this page down to a blank shell
    // (rather than this onboarding copy) is caught.
    await expect(page.locator(QUEUE_SECTION)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Belum ada deal" })).toBeVisible();
    await expect(page.getByText("Catat deal pertama untuk mulai melacak pemasukan.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "+ Deal" })).toBeVisible();
  });

  test("legitimate zero: user with real activity but nothing currently due shows the same intentional empty state", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "quiet");

    // Prove this account is NOT actually empty -- it has a real, paid deal --
    // so the empty state below is reached through business logic (only a
    // terminal PAID invoice), not because there is nothing to show at all.
    await goto200(page, "/deal");
    await expect(page.getByText("Brand Tenang", { exact: true })).toBeVisible();

    await goto200(page, "/");
    const section = page.locator(QUEUE_SECTION);
    await expect(section).toBeVisible();
    await expect(section.getByText("Tidak ada yang perlu dikejar.")).toBeVisible();
    await expect(section.getByRole("link").filter({ hasText: /Rp/ })).toHaveCount(0);
  });
});
