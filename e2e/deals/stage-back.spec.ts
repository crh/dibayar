// Real-interaction coverage for moving a deal back one stage
// (docs/testing/journey-coverage.json: DEAL-STAGE-02, JOURNEY-GRAPHS.md §1).
//
// Both places a person can do it are covered: the "Kembali ke …" button on
// deal detail, and the same item in a board card's menu. Each test asserts
// the visible stage, the stage-history entry (server-rendered, so only a
// reload shows it -- see the history test in deal-crud.spec.ts), and that
// the move survives a reload. They use the Konten and Deal fixture deals,
// which no other spec moves, and reseed first so the other project's run
// in the same invocation can't leave them at a different stage.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

// Money uses a non-breaking space after "Rp" (CLAUDE.md IDR rule).
const NBSP = "\u00a0";

function isDealPatch(dealId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/deals/${dealId}`;
}

test.describe("moving a deal back one stage", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("Kembali ke Nego on deal detail moves the deal back, records history, and survives reload", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.deal;
    const brand = manifest.brands[dealId];

    // Reach the detail page the way a person does: board card -> menu.
    await page.goto("/deal");
    await page.locator("article", { hasText: brand }).getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Lihat detail" }).click();
    await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    await expect(page.getByText("Tahap saat ini: Deal")).toBeVisible();
    // The seeded fee and scope (scripts/e2e-fixtures.ts), so the detail page
    // shows this deal's data, not just its name (DEAL-DETAIL-01).
    await expect(page.getByText(`Rp${NBSP}3.000.000`)).toBeVisible();
    await expect(page.getByText("E2E fixture: deal agreed")).toBeVisible();

    const patch = page.waitForResponse(isDealPatch(dealId));
    await page.getByRole("button", { name: "Kembali ke Nego" }).click();
    expect((await patch).ok()).toBe(true);
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
    // The buttons follow the new stage: one further back, and forward again.
    await expect(page.getByRole("button", { name: "Kembali ke Masuk" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lanjut ke Deal" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
    await expect(page.getByText("Deal → Nego", { exact: true })).toBeVisible();
    await expect(page.getByText("Deal dibuat langsung di tahap Deal")).toBeVisible();

    // And the board agrees after a fresh load.
    await page.goto("/deal");
    const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
    await stageFilter.getByRole("button", { name: "Nego", exact: true }).click();
    await expect(page.locator("article", { hasText: brand })).toBeVisible();
    await stageFilter.getByRole("button", { name: "Deal", exact: true }).click();
    await expect(page.locator("article", { hasText: brand })).toHaveCount(0);
  });

  test("Kembali ke Deal from a board card's menu moves the card back, records history, and survives reload", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.konten;
    const brand = manifest.brands[dealId];

    await page.goto("/deal");
    const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
    await stageFilter.getByRole("button", { name: "Konten", exact: true }).click();
    const card = page.locator("article", { hasText: brand });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    const patch = page.waitForResponse(isDealPatch(dealId));
    await page.getByRole("menuitem", { name: "Kembali ke Deal" }).click();
    expect((await patch).ok()).toBe(true);
    // Under the Konten filter the card leaves the column.
    await expect(card).toHaveCount(0);

    await stageFilter.getByRole("button", { name: "Deal", exact: true }).click();
    await expect(card).toBeVisible();

    await page.reload();
    await expect(card).toBeVisible();
    await stageFilter.getByRole("button", { name: "Konten", exact: true }).click();
    await expect(card).toHaveCount(0);

    // The move is in the deal's history, reached through the same card menu.
    await stageFilter.getByRole("button", { name: "Deal", exact: true }).click();
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Lihat detail" }).click();
    await expect(page.getByText("Tahap saat ini: Deal")).toBeVisible();
    await expect(page.getByText("Konten → Deal", { exact: true })).toBeVisible();
  });
});
