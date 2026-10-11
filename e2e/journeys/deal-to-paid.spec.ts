// Long journey B1: a deal from the first tap to a paid invoice, with the
// brand's own view of it in between.
//
// One person's whole workflow, across Beranda, the deal board, deal detail,
// invoice detail, the public invoice page and its PDF, the invoice list and
// back to Beranda. The short specs prove each step on its own; this proves
// the steps still connect: the fee typed in the dialog is the amount the
// brand is asked to pay, the contact typed in the dialog is the number
// WhatsApp opens, and the invoice the brand reads is the one the owner
// marks paid.
//
// Checkpoints, in order (each is a test.step):
//   1. Beranda -> + Deal (floating button on the phone, top bar on desktop)
//   2. the deal is saved and still there after a reload
//   3. Masuk -> Nego from the board card's menu, then Deal, Konten, Invoice on
//      deal detail; the stage history lists every move after a reload
//   4. Buat invoice on deal detail -> the invoice opens as a draft
//   5. desktop only: a due date typed with the keyboard (see below)
//   6. Tandai sudah dikirim, kept after a reload
//   7. Buat tautan berbagi, then Kirim lewat WhatsApp (answered locally)
//   8. the brand, in a browser with no session: page, PDF, no owner controls
//   9. Tandai lunas, kept after a reload; invoice list, deal stage, Beranda
//  10. the brand's link still works and still offers no owner controls
//
// Preconditions come from the base seed only (scripts/e2e-fixtures.ts): the
// fixture owner, their complete issuer and bank settings, and two existing
// invoices whose net (Rp 12.700.000) is Beranda's starting monthly total.
// Everything the journey asserts about the new deal and invoice is created
// through the UI.
//
// Due date: a phone has no way to type one, and choosing a date inside a
// native picker cannot be driven from Playwright (MAN-DUE-01). So the desktop
// project types it through the real keyboard and the brand must then see it;
// the phone project sets none and the brand must see no due date at all.
// Nothing is filled into the hidden date input.
//
// WhatsApp never leaves the machine (keepWhatsAppLocal()). The share link is
// a bearer token: it is compared as a boolean and never printed.
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { focusFieldForTyping, visibleDisplay } from "../support/due-date";
import { expectSameJakartaDay, jakartaToday, keepWhatsAppLocal, parseWhatsAppLink, trackOpenedPages } from "../support/follow-up";
import { downloadPdfByClick } from "../support/pdf";
import { shareTest as test, shownShareLink, trackShareMutations } from "../support/share-links";
import { escapeRegExp, expectNoOwnerControls, press, responseTo, rupiah, typeInto } from "../support/journey";

const DEAL = {
  brand: "E2E Brand Perjalanan Lunas",
  contactWa: "628177000123",
  // src/lib/format/phone.ts formatPhone("628177000123").
  contactWaShown: "+62 817-7000-123",
  contactName: "Dewi Pemasaran",
  scope: "Satu video ulasan dan dua story",
  feeIdr: 2_500_000,
  paymentTerms: "Lunas 14 hari setelah invoice diterima",
};
// The base seed's two invoices (SENT 6.000.000 with PPh 21 5%, PAID 7.000.000).
const BASE_SEED_NET = 12_700_000;
const DUE_DATE = { typed: "01152030", value: "2030-01-15", short: "15 Jan 2030", long: "15 Januari 2030" };

function incomeCard(page: Page) {
  return page.getByRole("region", { name: "Net ditagihkan bulan ini" });
}

function statusChip(page: Page, label: string) {
  return page.getByRole("main").locator("header").first().getByText(label, { exact: true });
}

function statusAction(page: Page, name: string) {
  return page.getByRole("region", { name: "Status pembayaran" }).getByRole("button", { name, exact: true });
}

test.describe("journey: deal to paid invoice", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  // The journey leaves a deal, an invoice and a share behind.
  test.afterEach(reseedFixtures);

  test("a deal created from Beranda becomes an invoice the brand can read and download, and is then marked paid", async ({ page, context, recipient, isMobile }, testInfo) => {
    test.setTimeout(150_000);
    const startedOn = jakartaToday();
    const fee = rupiah(DEAL.feeIdr);
    const whatsAppRequests = await keepWhatsAppLocal(context);
    let dealId = "";
    let invoiceId = "";
    let invoiceNumber = "";
    let shareLink = "";

    await test.step("Beranda -> + Deal opens the add-deal dialog", async () => {
      await page.goto("/");
      await expect(incomeCard(page).locator(".ds-money")).toHaveText(rupiah(BASE_SEED_NET));
      // getByRole skips display:none, so this is the floating button on the
      // phone and the top bar's link on desktop.
      const plusDeal = isMobile
        ? page.getByRole("link", { name: "+ Deal", exact: true })
        : page.getByTestId("top-bar").getByRole("link", { name: "+ Deal", exact: true });
      await expect(plusDeal).toBeVisible();
      await expect(plusDeal).toBeInViewport();
      await press(plusDeal, isMobile);
      await expect(page.getByRole("dialog", { name: "Tambah deal" })).toBeVisible();
      await expect(page).toHaveURL(/\/deal$/);
    });

    await test.step("the deal is saved with the typed values and survives a reload", async () => {
      const dialog = page.getByRole("dialog", { name: "Tambah deal" });
      await typeInto(page, dialog.getByLabel("Nama brand"), DEAL.brand, isMobile);
      await typeInto(page, dialog.getByLabel("Kontak WhatsApp"), DEAL.contactWa, isMobile);
      await typeInto(page, dialog.getByLabel("Nama kontak (opsional)"), DEAL.contactName, isMobile);
      await typeInto(page, dialog.getByLabel("Scope pekerjaan"), DEAL.scope, isMobile);
      await typeInto(page, dialog.getByLabel("Fee (Rp)"), String(DEAL.feeIdr), isMobile);
      await expect(dialog.getByText(`≈ ${fee}`)).toBeVisible();
      await typeInto(page, dialog.getByLabel("Syarat pembayaran (opsional)"), DEAL.paymentTerms, isMobile);

      const created = await responseTo(page, "POST", "/api/deals", () => press(dialog.getByRole("button", { name: "Simpan deal" }), isMobile));
      expect(created.ok()).toBe(true);
      dealId = ((await created.json()) as { deal: { id: string } }).deal.id;
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveText("Deal disimpan");

      await page.reload();
      const card = page.locator("article", { hasText: DEAL.brand });
      await expect(card).toBeVisible();
      await expect(card.getByText(fee)).toBeVisible();
    });

    await test.step("the deal moves Masuk -> Nego -> Deal -> Konten -> Invoice, and the history keeps every move", async () => {
      // First move from the board card's menu, the rest on deal detail.
      const card = page.locator("article", { hasText: DEAL.brand });
      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${DEAL.brand}` }), isMobile);
      const moved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("menuitem", { name: "Lanjut ke Nego" }), isMobile));
      expect(moved.ok()).toBe(true);

      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${DEAL.brand}` }), isMobile);
      await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
      await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
      await expect(page.getByRole("heading", { level: 1, name: DEAL.brand })).toBeVisible();
      await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
      // What was typed in the dialog is what the deal holds.
      const shownFee = page.getByText(fee);
      await expect(shownFee).toBeVisible();
      expect(await shownFee.textContent()).toBe(fee);
      await expect(page.getByText(DEAL.scope)).toBeVisible();
      await expect(page.getByText(DEAL.paymentTerms)).toBeVisible();
      await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue(DEAL.contactName);
      await expect(page.getByText(DEAL.contactWaShown, { exact: true })).toBeVisible();

      for (const stage of ["Deal", "Konten", "Invoice"]) {
        const patch = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: `Lanjut ke ${stage}`, exact: true }), isMobile));
        expect(patch.ok()).toBe(true);
        await expect(page.getByText(`Tahap saat ini: ${stage}`)).toBeVisible();
      }
      // Not invoiced yet: the page offers to create one, and links to none.
      await expect(page.getByRole("button", { name: "Buat invoice" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Lihat invoice / })).toHaveCount(0);

      await page.reload();
      await expect(page.getByText("Tahap saat ini: Invoice")).toBeVisible();
      for (const entry of ["Deal dibuat langsung di tahap Masuk", "Masuk → Nego", "Nego → Deal", "Deal → Konten", "Konten → Invoice"]) {
        await expect(page.getByText(entry, { exact: true })).toBeVisible();
      }
    });

    await test.step("Buat invoice on deal detail creates a draft for the deal's fee", async () => {
      const created = await responseTo(page, "POST", "/api/invoices", () => press(page.getByRole("button", { name: "Buat invoice" }), isMobile));
      expect(created.ok()).toBe(true);
      await expect(page.getByText("Invoice dibuat.")).toBeVisible();
      const invoiceLink = page.getByRole("link", { name: /^Lihat invoice INV\/\d{4}\/\d{2}\/\d{3,} →$/ });
      await expect(invoiceLink).toBeVisible();
      invoiceNumber = (await invoiceLink.textContent())!.replace(/^Lihat invoice /, "").replace(/ →$/, "");

      await press(invoiceLink, isMobile);
      await expect(page).toHaveURL(/\/invoice\/[^/]+$/);
      invoiceId = new URL(page.url()).pathname.split("/").pop()!;
      await expect(page.getByRole("heading", { level: 1, name: fee })).toBeVisible();
      await expect(page.getByRole("main").locator("header").first().getByText(invoiceNumber, { exact: true })).toBeVisible();
      await expect(statusChip(page, "Draf")).toBeVisible();
      await expect(statusAction(page, "Tandai sudah dikirim")).toBeVisible();
      await expect(statusAction(page, "Tandai lunas")).toHaveCount(0);
      await expect(page.getByText("Jatuh tempo: Belum ditentukan")).toBeVisible();
      // The page's own contact and share fetches have settled.
      await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
      await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
    });

    if (!isMobile) {
      await test.step("desktop: a due date typed with the keyboard is saved", async () => {
        const input = page.getByLabel("Tanggal jatuh tempo");
        await focusFieldForTyping(page, visibleDisplay(page, "Belum ditentukan"));
        for (const digit of DUE_DATE.typed) await page.keyboard.press(digit);
        await expect(input).toHaveValue(DUE_DATE.value);
        const saved = await responseTo(page, "PATCH", `/api/invoices/${invoiceId}`, () => page.keyboard.press("Enter"));
        expect(saved.ok()).toBe(true);
        await expect(page.getByText(`Jatuh tempo: ${DUE_DATE.short}`)).toBeVisible();
      });
    }

    await test.step("Tandai sudah dikirim moves the invoice to Terkirim and survives a reload", async () => {
      const patch = await responseTo(page, "PATCH", `/api/invoices/${invoiceId}`, () => press(statusAction(page, "Tandai sudah dikirim"), isMobile));
      expect(patch.ok()).toBe(true);
      await expect(statusChip(page, "Terkirim")).toBeVisible();

      await page.reload();
      await expect(statusChip(page, "Terkirim")).toBeVisible();
      await expect(statusAction(page, "Tandai lunas")).toBeVisible();
      await expect(statusAction(page, "Tandai sudah dikirim")).toHaveCount(0);
      await expect(page.getByText(`Jatuh tempo: ${isMobile ? "Belum ditentukan" : DUE_DATE.short}`)).toBeVisible();
      await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    });

    await test.step("Buat tautan berbagi makes a link, and Kirim lewat WhatsApp sends that same link to the deal's contact", async () => {
      const mutations = trackShareMutations(page, invoiceId);
      const created = await responseTo(page, "POST", `/api/invoices/${invoiceId}/share`, () => press(page.getByRole("button", { name: "Buat tautan berbagi" }), isMobile));
      expect(created.ok()).toBe(true);
      shareLink = await shownShareLink(page);
      expect(/\/i\/[A-Za-z0-9_-]{40,}$/.test(shareLink), "the shown link is a public invoice link").toBe(true);

      const opened = trackOpenedPages(context);
      const send = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
      await expect(send).toBeEnabled();
      const [popup] = await Promise.all([page.waitForEvent("popup"), press(send, isMobile)]);
      await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
      const message = parseWhatsAppLink(popup.url());
      await popup.close();
      await expect(send).toBeEnabled();

      expect(message.number).toBe(DEAL.contactWa);
      expect(message.text).toContain(DEAL.brand);
      expect(message.text).toContain(invoiceNumber);
      expect(message.text).toContain(fee);
      const linksInMessage = message.text?.match(new RegExp(`${escapeRegExp(new URL(page.url()).origin)}/i/[A-Za-z0-9_-]{40,}`, "g")) ?? [];
      expect(linksInMessage.length, "the message carries exactly one public invoice link").toBe(1);
      expect(linksInMessage[0] === shareLink, "the message carries the link the page shows").toBe(true);
      // One chat, no blocked-popup fallback, and sending did not rotate the link.
      expect(opened).toHaveLength(1);
      expect(whatsAppRequests).toHaveLength(1);
      await expect(page.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);
      expect(mutations).toEqual(["POST /share", "POST /share/ensure"]);
      expect((await shownShareLink(page)) === shareLink, "the shown link is unchanged after sending").toBe(true);
    });

    let recipientPdfText = "";
    await test.step("the brand, with no session, reads the invoice and downloads its PDF", async () => {
      const response = await recipient.goto(shareLink);
      expect(response?.status()).toBe(200);
      await expect(recipient).toHaveURL(/\/i\/[^/]+$/);
      const invoiceDoc = recipient.getByRole("main");
      await expect(invoiceDoc.getByText(new RegExp(`Nomor invoice:\\s*${escapeRegExp(invoiceNumber)}`))).toBeVisible();
      // Who is billed, by whom, for what.
      await expect(invoiceDoc.getByText(DEAL.brand, { exact: true })).toBeVisible();
      await expect(invoiceDoc.getByText(DEAL.contactName, { exact: true })).toBeVisible();
      await expect(invoiceDoc.getByText("E2E Fixture Owner", { exact: true }).first()).toBeVisible();
      await expect(invoiceDoc.getByText(DEAL.scope, { exact: true })).toBeVisible();
      const total = recipient.locator('[data-ux-money="display"]');
      await expect(total).toHaveText(fee);
      expect(await total.textContent()).toBe(fee);
      await expect(invoiceDoc.getByText(DEAL.paymentTerms, { exact: true })).toBeVisible();
      if (isMobile) await expect(invoiceDoc.getByText("Jatuh tempo:")).toHaveCount(0);
      else await expect(invoiceDoc.getByText(`Jatuh tempo: ${DUE_DATE.long}`)).toBeVisible();
      // Where to pay: the owner's seeded bank details, complete.
      const payment = recipient.locator("div", { has: recipient.getByRole("heading", { name: "Pembayaran ke" }) }).last();
      await expect(payment).toContainText("Bank: Bank E2E Fixture");
      await expect(payment).toContainText("Nomor rekening: 1234509876");
      await expect(payment).toContainText("Atas nama: E2E Fixture Owner");
      // (p[role=alert]: Next.js adds its own empty route announcer with that role.)
      await expect(recipient.locator('p[role="alert"]')).toHaveCount(0);
      // Nothing of the owner's app, and no sideways scrolling.
      await expectNoOwnerControls(recipient);
      expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      const received = await downloadPdfByClick(recipient, recipient.getByRole("link", { name: "Unduh PDF" }), testInfo, "recipient.pdf");
      expect(received.download.suggestedFilename()).toBe(`${invoiceNumber.replaceAll("/", "-")}.pdf`);
      recipientPdfText = received.text;
      const lines = received.text.split("\n");
      for (const expected of [
        `Nomor invoice: ${invoiceNumber}`,
        `E2E Fixture Owner ${DEAL.brand}`,
        `${DEAL.scope} Rp 2.500.000`,
        "Total Rp 2.500.000",
        DEAL.paymentTerms,
        "Bank: Bank E2E Fixture",
        "Nomor rekening: 1234509876",
        "Atas nama: E2E Fixture Owner",
      ]) {
        expect(lines, `the PDF has the line "${expected}"`).toContain(expected);
      }
      expect(received.text).toContain(DEAL.contactName);
      if (isMobile) expect(received.text).not.toContain("Jatuh tempo");
      else expect(lines).toContain(`Jatuh tempo: ${DUE_DATE.long}`);
      await expect(recipient).toHaveURL(/\/i\/[^/]+$/);

      // The link is all the brand has: the owner's own pages ask them to sign in.
      await recipient.goto(`/invoice/${invoiceId}`);
      await expect(recipient).toHaveURL(/\/api\/auth\/signin/);
      await expect(recipient.getByText(invoiceNumber)).toHaveCount(0);
      await expect(recipient.getByText(DEAL.brand)).toHaveCount(0);
    });

    await test.step("the owner's PDF is the document the brand downloaded", async () => {
      const owner = await downloadPdfByClick(page, page.getByRole("link", { name: "Unduh PDF" }), testInfo, "owner.pdf");
      expect(owner.text === recipientPdfText, "owner and recipient PDFs have the same text").toBe(true);
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
    });

    await test.step("Tandai lunas marks the invoice paid and survives a reload", async () => {
      const patch = await responseTo(page, "PATCH", `/api/invoices/${invoiceId}`, () => press(statusAction(page, "Tandai lunas"), isMobile));
      expect(patch.ok()).toBe(true);
      await expect(page.getByText("Lunas — invoice ini sudah selesai.")).toBeVisible();
      await expect(statusChip(page, "Lunas ✓")).toBeVisible();

      await page.reload();
      await expect(statusChip(page, "Lunas ✓")).toBeVisible();
      await expect(page.getByText("Invoice ini sudah ditandai lunas.")).toBeVisible();
      await expect(page.getByText(`${fee} diterima`)).toBeVisible();
      await expect(statusAction(page, "Batalkan status lunas")).toBeVisible();
      await expect(statusAction(page, "Tandai lunas")).toHaveCount(0);
      // Paying did not touch the link the brand holds.
      await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
      expect((await shownShareLink(page)) === shareLink, "the shown link is unchanged after payment").toBe(true);
    });

    await test.step("the invoice list, the deal board and Beranda agree", async () => {
      await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/invoice$/);
      const row = page.getByRole("region", { name: "Lunas" }).getByRole("link", { name: new RegExp(escapeRegExp(DEAL.brand)) });
      await expect(row).toBeVisible();
      await expect(row).toContainText(invoiceNumber);
      await expect(row).toContainText(fee);

      // The deal itself is closed by its owner: Invoice -> Dibayar.
      await press(primaryNav(page).getByRole("link", { name: "Deal", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/deal$/);
      const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
      await press(stageFilter.getByRole("button", { name: "Invoice", exact: true }), isMobile);
      const card = page.locator("article", { hasText: DEAL.brand });
      await expect(card).toBeVisible();
      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${DEAL.brand}` }), isMobile);
      const closed = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("menuitem", { name: "Lanjut ke Dibayar" }), isMobile));
      expect(closed.ok()).toBe(true);
      await expect(card).toHaveCount(0);
      await page.reload();
      await press(stageFilter.getByRole("button", { name: "Dibayar", exact: true }), isMobile);
      await expect(card).toBeVisible();

      await press(primaryNav(page).getByRole("link", { name: "Beranda", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/$/);
      const amount = incomeCard(page).locator(".ds-money");
      await expect(amount).toHaveText(rupiah(BASE_SEED_NET + DEAL.feeIdr));
      expect(await amount.textContent()).toBe(rupiah(BASE_SEED_NET + DEAL.feeIdr));
      await expect(incomeCard(page).getByTestId("home-income-subtitle")).toContainText("2 invoice lunas");
    });

    await test.step("the brand's link still opens the invoice, with no owner controls", async () => {
      const response = await recipient.goto(shareLink);
      expect(response?.status()).toBe(200);
      await expect(recipient.getByText(new RegExp(`Nomor invoice:\\s*${escapeRegExp(invoiceNumber)}`))).toBeVisible();
      await expect(recipient.locator('[data-ux-money="display"]')).toHaveText(fee);
      await expectNoOwnerControls(recipient);
    });

    expectSameJakartaDay(startedOn);
  });
});
