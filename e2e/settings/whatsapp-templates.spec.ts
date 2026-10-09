// Real-interaction coverage for editing the WhatsApp templates
// (docs/testing/journey-coverage.json: SET-04).
//
// INV-WA-01 and INV-STATUS-06 only ever proved the default templates. Here
// both templates are rewritten in Settings, saved, checked after a reload,
// and then the messages actually sent from two invoices are compared with
// the edited text: the send template on an invoice that is not overdue, the
// reminder template on one that is. Each edited template uses every token
// once in an order the defaults never use, so a message built from the
// default, or from the other template, cannot match.
//
// Runs on the follow-up overlay (it has the overdue invoice; the base seed's
// SENT invoice is still there). WhatsApp never leaves the machine
// (keepWhatsAppLocal()). The templates belong to the fixture owner, so the
// test reseeds before and after.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { addCalendarDays, jakartaToday, keepWhatsAppLocal, parseWhatsAppLink, shortIdDate } from "../support/follow-up";

const NBSP = "\u00a0";
const SEND_TEMPLATE = "UJI-KIRIM {nomor_invoice} untuk {brand}\nTempo {jatuh_tempo} | Total {jumlah}\nBuka: {tautan}";
const CHASE_TEMPLATE = "UJI-PENGINGAT {brand}: {jumlah} belum dibayar ({nomor_invoice}), tempo {jatuh_tempo}\nLihat {tautan}";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Clicks the invoice page's WhatsApp action and returns the number and
// message of the chat it opened.
async function sendFromInvoice(page: Page, buttonName: string) {
  const action = page.getByRole("button", { name: buttonName });
  await expect(action).toBeEnabled();
  const [popup] = await Promise.all([page.waitForEvent("popup"), action.click()]);
  await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\//);
  const sent = parseWhatsAppLink(popup.url());
  await popup.close();
  await expect(action).toBeEnabled();
  return sent;
}

async function openInvoiceFromList(page: Page, brand: string, invoiceId: string) {
  await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
  await expect(page).toHaveURL(/\/invoice$/);
  await page.getByRole("link", { name: new RegExp(escapeRegExp(brand)) }).click();
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
}

test.describe("WhatsApp templates in settings", { tag: "@critical" }, () => {
  test.afterEach(reseedFixtures);

  test("edited send and reminder templates persist and shape the next WhatsApp messages", async ({ page, context }) => {
    const overlayDay = jakartaToday();
    applyFollowUpStates();
    const manifest = loadFixtureManifest();
    const { followUp } = manifest;
    const sentBrand = manifest.brands[manifest.deals.invoiceSent];
    const overdueBrand = followUp.brands[followUp.deals.overdueStored];
    const overdueDue = shortIdDate(addCalendarDays(overlayDay, followUp.dueOffsetDays.overdueStored));
    await keepWhatsAppLocal(context);

    // Settings, through the nav.
    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    const templates = page.getByRole("region", { name: /Template WhatsApp/ });
    const send = templates.getByLabel("Pesan kirim invoice");
    const chase = templates.getByLabel("Pesan pengingat");
    // Starts from the defaults.
    await expect(send).toHaveValue(/^Halo \{brand\}, berikut invoice/);
    await expect(chase).toHaveValue(/^Halo \{brand\}, izin mengingatkan/);

    await send.fill(SEND_TEMPLATE);
    await chase.fill(CHASE_TEMPLATE);
    const save = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/me/settings",
    );
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();
    expect((await save).ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();

    await page.reload();
    await expect(send).toHaveValue(SEND_TEMPLATE);
    await expect(chase).toHaveValue(CHASE_TEMPLATE);

    const origin = escapeRegExp(new URL(page.url()).origin);
    const link = `${origin}/i/[A-Za-z0-9_-]{20,}`;

    // An invoice that is not overdue uses the edited send template.
    await openInvoiceFromList(page, sentBrand, manifest.invoices.sent);
    const first = await sendFromInvoice(page, "Kirim lewat WhatsApp");
    expect(first.number).toBe("628110000006");
    expect(first.text).toMatch(new RegExp(
      `^UJI-KIRIM E2E/SENT/001 untuk ${escapeRegExp(sentBrand)}\\nTempo 31 Des 2099 \\| Total Rp${NBSP}6\\.000\\.000\\nBuka: ${link}$`,
    ));

    // An overdue invoice uses the edited reminder template.
    await openInvoiceFromList(page, overdueBrand, followUp.invoices.overdueStored);
    const second = await sendFromInvoice(page, "Kirim pengingat");
    expect(second.number).toBe("628110000008");
    expect(second.text).toMatch(new RegExp(
      `^UJI-PENGINGAT ${escapeRegExp(overdueBrand)}: Rp${NBSP}8\\.000\\.000 belum dibayar \\(E2E/OVERDUE/003\\), tempo ${escapeRegExp(overdueDue)}\\nLihat ${link}$`,
    ));
    // Neither message fell back to a default.
    for (const text of [first.text, second.text]) {
      expect(text).not.toContain("Halo ");
      expect(text).not.toContain("Terima kasih");
    }
    expect(jakartaToday(), "test crossed Asia/Jakarta midnight; the overlay's relative due date no longer matches").toBe(overlayDay);
  });
});
