// Completeness probe: what can a person reach on each main screen?
//
// Walks Beranda, the plain board (before any card menu is open), every
// fixture deal's card menu and detail page, the invoice list, each fixture
// invoice and Pengaturan through visible navigation, and writes the visible
// buttons, menu items, links and editable fields of each to
// test-results/completeness/controls-<project>.json (plus a full-page
// screenshot of the board, each deal and each invoice). A card menu record
// holds the open menu only. It also records two behaviours the 2026-10-17
// audit found undecided (CAP-INV-12, CAP-INV-13).
//
// It asserts what it needs to move on, and that the written inventory has
// the board and every card menu in it. Reading the output against
// docs/product/capabilities.json is the reviewer's (or the LLM explorer's)
// job: see docs/product/COMPLETENESS-AUDIT.md. Not part of any CI gate.
// Screenshots hold synthetic fixture data only; the share link is never
// written out.
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "../../e2e/support/test";
import { loadFixtureManifest } from "../../e2e/support/manifest";
import { reseedFixtures } from "../../e2e/support/reseed";
import { press } from "../../e2e/support/journey";

const OUT = "test-results/completeness";

type Screen = { screen: string; path: string; buttons: string[]; menuItems: string[]; links: string[]; editable: string[] };

// The board's stage filter chips (src/components/deals/stage-filter.tsx).
const STAGE_FILTERS = ["Semua", "Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"];

// Visible controls inside `root` (the whole page by default). A menu item is
// listed under menuItems only, and a disabled control keeps its name with
// " (disabled)" so it never reads as something a person can use.
async function controls(page: Page, screen: string, root = "body"): Promise<Screen> {
  await page.waitForLoadState("networkidle");
  const scope = page.locator(root);
  const visibleNames = (selector: string) =>
    scope.locator(selector).evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const name = (element.getAttribute("aria-label") || (element as HTMLElement).innerText || "").trim().replace(/\s+/g, " ");
          const disabled = (element as HTMLButtonElement).disabled || element.getAttribute("aria-disabled") === "true";
          return name && disabled ? `${name} (disabled)` : name;
        })
        .filter(Boolean),
    );
  const editable = await scope.locator("input:not([type=hidden]), textarea, select, [contenteditable=true]").evaluateAll((elements) =>
    elements
      .filter((element) => element.getClientRects().length > 0 && !(element as HTMLInputElement).readOnly && !(element as HTMLInputElement).disabled)
      .map((element) => {
        const label = (element.id && document.querySelector(`label[for="${element.id}"]`)?.textContent) || element.getAttribute("aria-label") || element.closest("label")?.textContent || element.getAttribute("name") || "(no label)";
        return `${element.tagName.toLowerCase()}[${(element as HTMLInputElement).type || ""}] ${label.trim().replace(/\s+/g, " ")}`;
      }),
  );
  return {
    screen,
    path: new URL(page.url()).pathname,
    buttons: await visibleNames("button:not([role=menuitem]), [role=button]"),
    menuItems: await visibleNames("[role=menuitem]"),
    links: await visibleNames("a[href]:not([role=menuitem])"),
    editable,
  };
}

test.describe("completeness probe", () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("records the controls of every main screen and two undecided behaviours", async ({ page, browser, baseURL, isMobile }, testInfo) => {
    test.setTimeout(180_000);
    const manifest = loadFixtureManifest();
    const project = testInfo.project.name;
    const screens: Screen[] = [];
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${project}/${name}.png`, fullPage: true });
    mkdirSync(`${OUT}/${project}`, { recursive: true });

    await page.goto("/");
    await page.getByRole("heading", { name: "Net ditagihkan bulan ini" }).waitFor();
    screens.push(await controls(page, "beranda"));

    const plusDeal = isMobile ? page.getByRole("link", { name: "+ Deal", exact: true }) : page.getByTestId("top-bar").getByRole("link", { name: "+ Deal", exact: true });
    await press(plusDeal, isMobile);
    await page.getByRole("dialog").waitFor();
    screens.push(await controls(page, "add-deal dialog"));
    await page.keyboard.press("Escape");

    // The board as a person first sees it, before any card menu is open:
    // stage filters, navigation, every card's action button.
    await page.goto("/deal");
    await page.getByRole("group", { name: /filter tahap deal/i }).waitFor();
    const board = await controls(page, "deal board");
    screens.push(board);
    await shot("deal-board");
    for (const filter of STAGE_FILTERS) expect(board.buttons, `deal board stage filter ${filter}`).toContain(filter);
    for (const dealId of Object.values(manifest.deals)) expect(board.buttons).toContain(`Aksi lain untuk deal ${manifest.brands[dealId]}`);

    // Then each card's menu, recorded from the open menu alone so the board
    // behind it is not counted again.
    for (const [stage, dealId] of Object.entries(manifest.deals)) {
      const brand = manifest.brands[dealId];
      await page.goto("/deal");
      const card = page.locator("article", { hasText: brand });
      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
      await page.getByRole("menu").getByRole("menuitem").first().waitFor();
      screens.push(await controls(page, `card menu: ${stage}`, "[role=menu]"));
      await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
      await page.getByText(/Tahap saat ini/).first().waitFor();
      screens.push(await controls(page, `deal detail: ${stage}`));
      await shot(`deal-${stage}`);
    }

    for (const [kind, invoiceId] of Object.entries(manifest.invoices)) {
      await page.goto("/invoice");
      await page.waitForLoadState("networkidle");
      if (kind === "sent") screens.push(await controls(page, "invoice list"));
      await page.goto(`/invoice/${invoiceId}`);
      await page.locator("#rincian-invoice").waitFor();
      screens.push(await controls(page, `invoice detail: ${kind}`));
      await shot(`invoice-${kind}`);
    }

    await press(page.getByRole("link", { name: "Pengaturan" }).first(), isMobile);
    await page.waitForURL(/\/pengaturan$/);
    screens.push(await controls(page, "pengaturan"));

    // CAP-INV-12 (undecided): does a contact name saved after issue reach the
    // brand's page? The share link stays in memory only.
    const recipientContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const recipient = await recipientContext.newPage();
    const link = `/i/${manifest.shareTokens.active}`;
    const marker = "Kontak Probe Setelah Terbit";
    await recipient.goto(link);
    const before = (await recipient.locator("body").innerText()).includes(marker);
    await page.goto(`/deal/${manifest.deals.invoiceSent}`);
    await page.getByLabel("Nama kontak", { exact: true }).fill(marker);
    await press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile);
    await page.getByRole("status").filter({ hasText: "Nama kontak disimpan" }).waitFor();
    await recipient.reload();
    const after = (await recipient.locator("body").innerText()).includes(marker);
    await recipientContext.close();

    // CAP-INV-13 (undecided): does Tandai lunas move the deal to Dibayar?
    await page.goto(`/invoice/${manifest.invoices.sent}`);
    await page.locator("#rincian-invoice").waitFor();
    await press(page.getByRole("button", { name: "Tandai lunas" }), isMobile);
    await page.getByRole("button", { name: "Batalkan status lunas" }).waitFor();
    await page.goto(`/deal/${manifest.deals.invoiceSent}`);
    const stageAfterPaid = (await page.getByText(/Tahap saat ini/).first().innerText()).trim();

    const output = {
      project,
      recordedAt: new Date().toISOString(),
      screens,
      observations: {
        "CAP-INV-12 contact name saved after issue appears on the brand's page": { before, after },
        "CAP-INV-13 deal stage after its invoice is marked paid": stageAfterPaid,
      },
    };
    // The written inventory must hold the plain board and one menu per
    // fixture deal, or a reader would compare an incomplete file with
    // capabilities.json.
    const boardRecords = output.screens.filter((screen) => screen.screen === "deal board");
    expect(boardRecords, "one plain deal board record").toHaveLength(1);
    expect(boardRecords[0].menuItems, "the board is recorded with no menu open").toEqual([]);
    for (const stage of Object.keys(manifest.deals)) {
      const menu = output.screens.find((screen) => screen.screen === `card menu: ${stage}`);
      expect(menu?.menuItems, `card menu: ${stage}`).toContain("Lihat detail");
      expect([...(menu?.buttons ?? []), ...(menu?.links ?? [])], `card menu: ${stage} holds the menu only`).toEqual([]);
    }
    writeFileSync(`${OUT}/controls-${project}.json`, `${JSON.stringify(output, null, 2)}\n`);
    await testInfo.attach("controls", { body: JSON.stringify(output, null, 2), contentType: "application/json" });
  });
});
