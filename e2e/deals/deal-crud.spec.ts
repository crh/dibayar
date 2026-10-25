import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

test.describe("deal create/update journeys", { tag: "@critical" }, () => {
  // Reseed before each test: "moving a deal" depends on a deal being at a
  // specific starting stage, which a prior run (in another project sharing
  // this database within the same invocation) may have already moved. See
  // e2e/support/reseed.ts.
  test.beforeEach(reseedFixtures);


  test("create a deal via the dialog, happy path", async ({ page }) => {
    // Direct URL, not a TopBar click: see e2e/deals/add-deal-dialog.spec.ts's
    // header comment -- there is currently no in-app link that navigates to
    // ?tambah=1 (TopBar's "+ Deal" goes to plain /deal).
    await page.goto("/deal?tambah=1");

    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();

    const brand = `E2E New Brand ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000000");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu video promosi produk");
    await dialog.getByLabel("Fee (Rp)").fill("2500000");
    await dialog.getByRole("button", { name: "Simpan deal" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    await expect(page.getByText(brand, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(brand, { exact: true })).toBeVisible();
  });

  test("opening the dialog and closing it without saving creates nothing", async ({ page }) => {
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Nama brand").fill("Should Not Be Saved");
    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.getByText("Should Not Be Saved", { exact: true })).toHaveCount(0);
  });

  test.describe("server-validation journey", () => {
    // Chromium/WebKit both log the browser's own generic "Failed to load
    // resource" console error for this deliberately-triggered 400, which
    // browserDiagnostics (e2e/support/test.ts) would otherwise treat as an
    // unexplained failure. Narrowly opts this one test's one deliberate
    // request into being recognized as expected -- see
    // expectedErrorResponses's type comment in that file for why this is a
    // per-test opt-in rather than baked into the shared fixture.
    test.use({ expectedErrorResponses: [{ method: "POST", pathname: "/api/deals" }] });

    // #50: on an iPhone a tester typed a one-digit WhatsApp number. The
    // browser's `required` let it through, the server refused it (400), and
    // all the dialog said was "Deal belum bisa disimpan." -- nothing about
    // which field or why. The form now checks the number the way WhatsApp
    // needs it (normalizeWhatsAppNumber) before sending, and says so on the
    // field.
    test("a WhatsApp number WhatsApp can't open is stopped on the field with a message, nothing is sent, and once corrected the deal saves", async ({ page }) => {
      await page.goto("/deal?tambah=1");
      const dialog = page.getByRole("dialog", { name: "Tambah deal" });
      const creates: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/deals") creates.push(request.url());
      });
      const brand = `E2E Nomor Satu Digit ${Date.now()}`;
      await dialog.getByLabel("Nama brand").fill(brand);
      const wa = dialog.getByLabel("Kontak WhatsApp");
      await wa.fill("1");
      await dialog.getByLabel("Scope pekerjaan").fill("E2E server-validation check");
      await dialog.getByLabel("Fee (Rp)").fill("1000000");
      await dialog.getByRole("button", { name: "Simpan deal" }).click();

      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("alert")).toHaveText("Periksa kembali isian yang ditandai.");
      await expect(wa).toHaveAttribute("aria-invalid", "true");
      await expect(wa).toHaveAccessibleDescription("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.");
      await expect(wa).toBeFocused();
      await expect(dialog.getByText("Deal belum bisa disimpan.")).toHaveCount(0);
      expect(creates).toEqual([]);

      // Correcting the number clears its message, and the same form saves.
      await wa.fill("0812 3456 7890");
      await expect(wa).not.toHaveAttribute("aria-invalid", "true");
      const createResponse = page.waitForResponse(
        (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
      );
      await dialog.getByRole("button", { name: "Simpan deal" }).click();
      expect((await createResponse).status()).toBe(201);
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await expect(page.locator("article", { hasText: brand })).toHaveCount(1);
    });

    // The server keeps the same rule for anything that does not come through
    // the form, and names the field when it refuses.
    test("the API refuses a WhatsApp number WhatsApp can't open, naming contactWa, and saves nothing", async ({ page, baseURL }) => {
      const brand = `E2E API Nomor Pendek ${Date.now()}`;
      for (const contactWa of ["1", "123456"]) {
        const response = await page.request.post("/api/deals", {
          headers: { origin: new URL(baseURL!).origin },
          data: { brand, contactWa, scope: "E2E server-validation check", feeIdr: 1_000_000 },
        });
        expect(response.status()).toBe(400);
        expect(Object.keys(((await response.json()) as { fields: Record<string, unknown> }).fields)).toEqual(["contactWa"]);
      }
      await page.goto("/deal");
      await expect(page.getByText(brand, { exact: true })).toHaveCount(0);
    });
  });

  test("moving a deal to the next stage via its card menu updates the board", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const masukBrand = manifest.brands[manifest.deals.masuk];
    const negoBrand = manifest.brands[manifest.deals.nego];

    await page.goto("/deal");
    const masukCard = page.locator("article", { hasText: masukBrand });
    await masukCard.getByRole("button", { name: `Aksi lain untuk deal ${masukBrand}` }).click();
    await page.getByRole("menuitem", { name: "Lanjut ke Nego" }).click();

    // Filter to Nego to unambiguously confirm the move landed there.
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Nego", exact: true }).click();
    await expect(page.getByText(masukBrand, { exact: true })).toBeVisible();
    await expect(page.getByText(negoBrand, { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Nego", exact: true }).click();
    await expect(page.getByText(masukBrand, { exact: true })).toBeVisible();
  });

  // E2E-IMPROVEMENT-PLAN.md C3: the board-level test above only proves the
  // board UI reflects a stage move. It doesn't touch the stage-history
  // timeline (deal-detail-client.tsx's "Riwayat tahap" section, backed by
  // DealStageTransition -- see src/lib/deals.ts), which is populated only
  // by the server component on load (deal/[id]/page.tsx's
  // listDealStageTransitions), not re-fetched client-side after a move
  // (handleStageChange only calls setDeal, never touches history). So the
  // real persistence contract for the history entry can only be proven
  // with a reload, same pattern as the due-date field.
  test("moving a deal's stage records a stage-history entry that persists after reload", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const masukBrand = manifest.brands[manifest.deals.masuk];

    await page.goto(`/deal/${manifest.deals.masuk}`);
    await expect(page.getByRole("heading", { name: masukBrand })).toBeVisible();
    await expect(page.getByText("Tahap saat ini: Masuk")).toBeVisible();

    // Every fixture deal is seeded with its own initial transition (see
    // scripts/e2e-fixtures.ts), mirroring what a real createDeal() call
    // records -- so the history list is never actually empty here.
    await expect(page.getByText("Deal dibuat langsung di tahap Masuk")).toBeVisible();

    const stagePatch = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/deals/${manifest.deals.masuk}`,
    );
    await page.getByRole("button", { name: "Lanjut ke Nego" }).click();
    expect((await stagePatch).ok()).toBe(true);
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();

    // Not yet in the history list -- it's a static server-rendered prop,
    // unaffected by the client-side PATCH above.
    await expect(page.getByText("Masuk → Nego")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText("Masuk → Nego")).toBeVisible();
    // The original creation entry must still be there too -- a reload
    // proves the new entry was recorded, not substituted for the old one.
    await expect(page.getByText("Deal dibuat langsung di tahap Masuk")).toBeVisible();
  });

  // E2E-IMPROVEMENT-PLAN.md C1: a long brand name is a real product input
  // (brand is user-entered, up to 120 chars per deal-validation.ts), not a
  // hypothetical. A genuine bug was found and fixed while writing this
  // test: deal-card.tsx's header row is `flex items-start justify-between`
  // with the brand heading as a flex item that had no `min-w-0`. A flex
  // item's automatic minimum size defaults to its content's min-content
  // width -- for an unbreakable brand name (no spaces) that's the full
  // string -- so the heading refused to shrink and pushed the card's own
  // "..." actions menu button completely off-screen, making it
  // unreachable. Confirmed visually (screenshot) before fixing with
  // `min-w-0 truncate` on the heading.
  //
  // A page-level `document.documentElement.scrollWidth` check does *not*
  // catch this: deal-board.tsx's mobile column is already its own
  // horizontal-scroll carousel (`overflow-x-auto`), so the overflow stays
  // contained within it and never grows the page's own scrollWidth even
  // with the bug present -- confirmed empirically (that assertion passed
  // both before and after the fix). The real, catchable symptom is that
  // the menu button becomes unreachable, so assert that directly instead.
  test("a long unbreakable brand name does not push the deal card's actions menu off-screen at 390px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "this test is specifically about the 390px mobile board layout");

    const longBrand = "E2ELongBrandNameWithNoSpacesWhatsoeverToStressTestHorizontalOverflowHandlingOnTheDealBoardAtNarrowWidths";
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await dialog.getByLabel("Nama brand").fill(longBrand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000001");
    await dialog.getByLabel("Scope pekerjaan").fill("E2E long-brand overflow check");
    await dialog.getByLabel("Fee (Rp)").fill("1000000");
    await dialog.getByRole("button", { name: "Simpan deal" }).click();
    await expect(dialog).toHaveCount(0);

    const card = page.locator("article", { hasText: longBrand });
    const menuButton = card.getByRole("button", { name: `Aksi lain untuk deal ${longBrand}` });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toBeInViewport();
    await menuButton.click();
    await expect(page.getByRole("menuitem", { name: "Lihat detail" })).toBeVisible();
  });

  // Companion to the card test above: deal-detail-client.tsx's own <h1>
  // brand heading sits in a plain block container, not a flex row, so it
  // was never subject to the min-width:auto trap -- but a long unbreakable
  // word still overflows a plain block by default (no `overflow-wrap`/
  // `break-words` applied). Unlike the board, this page has no ancestor
  // horizontal-scroll container to absorb it, so it's a genuine page-level
  // scroll bug -- confirmed via screenshot before fixing with
  // `break-words` on the heading. Here scrollWidth is the right check.
  test("a long unbreakable brand name does not cause horizontal page overflow on the deal detail page at 390px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "this test is specifically about the 390px mobile detail-page layout");

    const longBrand = "E2ELongBrandNameWithNoSpacesWhatsoeverToStressTestHorizontalOverflowHandlingOnTheDealDetailPageAtNarrowWidths";
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await dialog.getByLabel("Nama brand").fill(longBrand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000002");
    await dialog.getByLabel("Scope pekerjaan").fill("E2E long-brand detail overflow check");
    await dialog.getByLabel("Fee (Rp)").fill("1000000");
    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
    );
    await dialog.getByRole("button", { name: "Simpan deal" }).click();
    const { deal } = await (await createResponse).json();

    await page.goto(`/deal/${deal.id}`);
    await expect(page.getByRole("heading", { name: longBrand })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
});
