// Real-interaction coverage for the invoice payment-status transitions a
// person can actually trigger (docs/testing/journey-coverage.json:
// DEAL-DETAIL-05, INV-STATUS-01..05; graph in
// docs/testing/JOURNEY-GRAPHS.md).
//
// The pre-existing "mark an invoice paid, then undo" journey starts from the
// seeded SENT invoice and only checks immediate client state. Nothing drove
// DRAFT -> SENT or SENT -> DUE through the UI, and no transition was proven
// to persist. This starts where a real invoice starts -- created from the
// deal detail page, so it is a DRAFT -- and reloads after every step,
// because the client sets its state from the PATCH response and only a
// reload proves the server stored it.
//
// Deliberately not exercised: DUE -> OVERDUE via "Tandai terlambat". With no
// past due date the displayed status is re-derived back to SENT
// (deriveInvoiceDisplayStatus in src/lib/invoice-date-status.ts), so the
// person sees "Terkirim" right after asking for "Terlambat". Whether that is
// intended is an open product question (FIND-01 in
// docs/testing/JOURNEY-COVERAGE.md); asserting either behaviour here would
// lock in an answer nobody has made yet.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

async function expectStatus(page: Page, chip: string, actions: string[]) {
  const header = page.getByRole("main").locator("header").first();
  await expect(header.getByText(chip, { exact: true })).toBeVisible();
  const statusSection = page.getByRole("region", { name: "Status pembayaran" });
  for (const action of actions) {
    await expect(statusSection.getByRole("button", { name: action, exact: true })).toBeVisible();
  }
}

async function clickAndPersist(page: Page, invoiceId: string, action: string) {
  const patch = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}`,
  );
  await page.getByRole("region", { name: "Status pembayaran" }).getByRole("button", { name: action, exact: true }).click();
  expect((await patch).ok()).toBe(true);
}

test.describe("invoice status lifecycle", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("an invoice created from the deal page moves DRAFT -> SENT -> DUE -> PAID -> SENT, persisting after every reload", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.invoicePending;
    const brand = manifest.brands[dealId];

    await page.goto(`/deal/${dealId}`);
    await expect(page.getByRole("heading", { name: brand })).toBeVisible();
    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/invoices",
    );
    await page.getByRole("button", { name: "Buat invoice" }).click();
    expect((await createResponse).ok()).toBe(true);
    await expect(page.getByText("Invoice dibuat.")).toBeVisible();

    // Follow the link the deal page offers, as a person would.
    await page.getByRole("link", { name: /^Lihat invoice .+ →$/ }).click();
    await expect(page).toHaveURL(/\/invoice\/[^/]+$/);
    const invoiceId = new URL(page.url()).pathname.split("/").pop()!;

    await expectStatus(page, "Draf", ["Tandai sudah dikirim"]);

    await clickAndPersist(page, invoiceId, "Tandai sudah dikirim");
    await expectStatus(page, "Terkirim", ["Tandai jatuh tempo", "Tandai lunas"]);
    await page.reload();
    await expectStatus(page, "Terkirim", ["Tandai jatuh tempo", "Tandai lunas"]);

    await clickAndPersist(page, invoiceId, "Tandai jatuh tempo");
    await expectStatus(page, "Jatuh tempo", ["Tandai terlambat", "Tandai lunas"]);
    await page.reload();
    await expectStatus(page, "Jatuh tempo", ["Tandai terlambat", "Tandai lunas"]);

    await clickAndPersist(page, invoiceId, "Tandai lunas");
    await expect(page.getByText("Invoice ini sudah ditandai lunas.")).toBeVisible();
    await page.reload();
    await expectStatus(page, "Lunas ✓", ["Batalkan status lunas"]);
    await expect(page.getByText("Invoice ini sudah ditandai lunas.")).toBeVisible();

    await clickAndPersist(page, invoiceId, "Batalkan status lunas");
    await page.reload();
    await expectStatus(page, "Terkirim", ["Tandai jatuh tempo", "Tandai lunas"]);
    await expect(page.getByText("Invoice ini sudah ditandai lunas.")).toHaveCount(0);

    // The invoice list agrees with the detail page after all of the above.
    await page.goto("/invoice");
    await expect(page.getByRole("link", { name: new RegExp(brand) })).toBeVisible();
  });
});
