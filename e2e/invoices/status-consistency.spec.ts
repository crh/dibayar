// One invoice status rule everywhere (FIND-01, FIND-06;
// docs/testing/journey-coverage.json: INV-LIST-01, INV-STATUS-06).
//
// The status a person sees is deriveInvoiceDisplayStatus()
// (src/lib/invoice-date-status.ts): DRAFT and PAID as stored, anything else
// past its due date in Asia/Jakarta is overdue, and a stored OVERDUE that is
// not past due reads as sent. The invoice list used to group and label by
// the stored status instead, so a SENT invoice due yesterday sat under
// Terkirim while Beranda and its own detail page called it Terlambat.
//
// Rows come from the follow-up overlay (stored SENT and stored OVERDUE, due
// dates relative to today in Jakarta) plus the status-consistency overlay
// (stored DUE due yesterday, legacy stored OVERDUE that is not past due,
// DRAFT and PAID with a past due date); see applyStatusConsistency() in
// e2e/support/reseed.ts. Nothing here writes a status except the one
// "Tandai lunas" click in the legacy test.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyStatusConsistency, reseedFixtures } from "../support/reseed";
import { primaryNav } from "../support/nav";
import { addCalendarDays, expectSameJakartaDay, followUpRow, jakartaToday, shortIdDate } from "../support/follow-up";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function listGroup(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

function listRow(page: Page, group: string, brand: string): Locator {
  return listGroup(page, group).getByRole("link", { name: new RegExp(escapeRegExp(brand)) });
}

// Every row of a group, with the chip each row shows.
async function expectGroup(page: Page, group: string, rows: Array<{ brand: string; chip: string }>) {
  await expect(listGroup(page, group).getByRole("link")).toHaveCount(rows.length);
  for (const { brand, chip } of rows) {
    await expect(listRow(page, group, brand).getByText(chip, { exact: true }), `${brand} chip in ${group}`).toBeVisible();
  }
}

async function openInvoiceList(page: Page) {
  await page.goto("/");
  await primaryNav(page).getByRole("link", { name: "Invoice" }).click();
  await expect(page).toHaveURL(/\/invoice$/);
}

function detailChip(page: Page, chip: string): Locator {
  return page.getByRole("main").locator("header").first().getByText(chip, { exact: true });
}

function statusAction(page: Page, name: string): Locator {
  return page.getByRole("region", { name: "Status pembayaran" }).getByRole("button", { name, exact: true });
}

// "Tandai lunas" is the only status action offered: no manual overdue
// (FIND-01), no "mark due" on an invoice that is overdue or stored OVERDUE.
async function expectOnlyMarkPaid(page: Page) {
  await expect(statusAction(page, "Tandai lunas")).toBeVisible();
  for (const other of ["Tandai sudah dikirim", "Tandai jatuh tempo", "Tandai terlambat", "Batalkan status lunas"]) {
    await expect(page.getByRole("button", { name: other, exact: true }), `"${other}" must not be offered`).toHaveCount(0);
  }
}

test.describe("invoice status is the same on the list, the detail page and Beranda", { tag: "@critical" }, () => {
  let overlayDay = "";
  test.beforeEach(() => {
    overlayDay = jakartaToday();
    applyStatusConsistency();
  });
  test.afterEach(reseedFixtures);

  test("the invoice list groups and labels every invoice by the status its detail page shows, and keeps doing so after reload", async ({ page }) => {
    const { followUp, statusConsistency, brands, deals } = loadFixtureManifest();
    const rows = statusConsistency.rows;
    const expected = {
      Terlambat: [
        { brand: followUp.brands[followUp.deals.overdueStored], chip: "Terlambat" },
        // Stored SENT and stored DUE, both due yesterday.
        { brand: followUp.brands[followUp.deals.overdueSent], chip: "Terlambat" },
        { brand: rows.dueOverdue.brand, chip: "Terlambat" },
      ],
      Terkirim: [
        { brand: brands[deals.invoiceSent], chip: "Terkirim" },
        // Due today, in 7 days and in 8 days: not overdue.
        { brand: followUp.brands[followUp.deals.dueToday], chip: "Terkirim" },
        { brand: followUp.brands[followUp.deals.dueWindowEdge], chip: "Terkirim" },
        { brand: followUp.brands[followUp.deals.dueOutsideWindow], chip: "Terkirim" },
        // Stored OVERDUE that is not past due falls back to sent.
        { brand: rows.legacyOverdueFuture.brand, chip: "Terkirim" },
        { brand: rows.legacyOverdueNoDate.brand, chip: "Terkirim" },
      ],
      // A past due date never moves a draft or a paid invoice.
      Draf: [{ brand: rows.draftPastDue.brand, chip: "Draf" }],
      Lunas: [
        { brand: brands[deals.dibayar], chip: "Lunas ✓" },
        { brand: rows.paidPastDue.brand, chip: "Lunas ✓" },
      ],
    };

    await openInvoiceList(page);
    for (const pass of ["first load", "after reload"]) {
      await test.step(pass, async () => {
        await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Terlambat", "Terkirim", "Draf", "Lunas"]);
        for (const [group, groupRows] of Object.entries(expected)) await expectGroup(page, group, groupRows);
      });
      if (pass === "first load") await page.reload();
    }
    expectSameJakartaDay(overlayDay);
  });

  for (const source of ["stored SENT", "stored DUE"] as const) {
    test(`a ${source} invoice due yesterday is Terlambat on the list, its detail page and Beranda, with no status action that contradicts it`, async ({ page }) => {
      const { followUp, statusConsistency } = loadFixtureManifest();
      const invoice =
        source === "stored SENT"
          ? { id: followUp.invoices.overdueSent, brand: followUp.brands[followUp.deals.overdueSent] }
          : { id: statusConsistency.rows.dueOverdue.id, brand: statusConsistency.rows.dueOverdue.brand };
      const dueText = shortIdDate(addCalendarDays(overlayDay, -1));

      // List -> detail, through the row a person sees under Terlambat.
      await openInvoiceList(page);
      await expect(listRow(page, "Terkirim", invoice.brand)).toHaveCount(0);
      await listRow(page, "Terlambat", invoice.brand).click();
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoice.id}$`));

      const expectOverdueDetail = async () => {
        await expect(detailChip(page, "Terlambat")).toBeVisible();
        await expect(page.getByText(`Jatuh tempo: ${dueText}`)).toBeVisible();
        await expect(page.getByRole("button", { name: "Kirim pengingat" })).toBeVisible();
        await expectOnlyMarkPaid(page);
      };
      await expectOverdueDetail();
      await page.reload();
      await expectOverdueDetail();

      // Back to the list and forward again: the same answer both ways.
      await page.goBack();
      await expect(page).toHaveURL(/\/invoice$/);
      await expect(listRow(page, "Terlambat", invoice.brand).getByText("Terlambat", { exact: true })).toBeVisible();
      await page.goForward();
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoice.id}$`));
      await expectOverdueDetail();

      // Beranda gives the same reason.
      await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(followUpRow(page, invoice.brand)).toContainText(`${dueText} · Telat 1 hari`);
      expectSameJakartaDay(overlayDay);
    });
  }

  test("a legacy invoice stored as OVERDUE but not past due reads Terkirim everywhere and can still be marked paid", async ({ page }) => {
    const { statusConsistency } = loadFixtureManifest();
    const { legacyOverdueFuture, legacyOverdueNoDate } = statusConsistency.rows;

    // No due date at all: sent, payable, not a crash.
    await openInvoiceList(page);
    await listRow(page, "Terkirim", legacyOverdueNoDate.brand).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${legacyOverdueNoDate.id}$`));
    await expect(detailChip(page, "Terkirim")).toBeVisible();
    await expect(detailChip(page, "Terlambat")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeVisible();
    await expectOnlyMarkPaid(page);

    // Due in 8 days: same, and Beranda does not chase it.
    await page.goBack();
    await expect(page).toHaveURL(/\/invoice$/);
    await listRow(page, "Terkirim", legacyOverdueFuture.brand).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${legacyOverdueFuture.id}$`));
    await expect(detailChip(page, "Terkirim")).toBeVisible();
    await expect(page.getByText(`Jatuh tempo: ${shortIdDate(addCalendarDays(overlayDay, 8))}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim pengingat" })).toHaveCount(0);
    await expectOnlyMarkPaid(page);

    // The one action it offers is one the server accepts.
    const patch = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${legacyOverdueFuture.id}`,
    );
    await statusAction(page, "Tandai lunas").click();
    expect((await patch).ok()).toBe(true);
    await page.reload();
    await expect(detailChip(page, "Lunas ✓")).toBeVisible();

    await primaryNav(page).getByRole("link", { name: "Invoice" }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(listRow(page, "Lunas", legacyOverdueFuture.brand).getByText("Lunas ✓", { exact: true })).toBeVisible();
    await expect(listRow(page, "Terkirim", legacyOverdueFuture.brand)).toHaveCount(0);

    await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(followUpRow(page, legacyOverdueNoDate.brand)).toHaveCount(0);
    await expect(followUpRow(page, legacyOverdueFuture.brand)).toHaveCount(0);
    expectSameJakartaDay(overlayDay);
  });
});
