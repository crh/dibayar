// Real-interaction coverage for signing out from Pengaturan
// (docs/testing/journey-coverage.json: AUTH-06). The account-menu path is
// AUTH-05 (session.spec.ts).
//
// Pengaturan asks first, in the page ("Yakin ingin keluar?"), and only then
// hands over to Auth.js's own sign-out page. Both ways out of that question
// are driven: Batal keeps the session (proven by a reload), Ya, keluar ends
// it.
//
// Signing out also clears the browser's cookie, so "the next visit redirects"
// would pass even if the Session row were still in the database. The last
// step therefore presents the same token again from a fresh browser context:
// only a deleted row makes that redirect too.
//
// Runs on the owner's disposable session, never the shared one (see
// e2e/support/fixture-ids.ts), and reseeds first because signing out
// consumes that row.
import { expect, test } from "../support/test";
import { disposableOwnerSessionCookie } from "../support/auth";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";

test.describe("sign out from Pengaturan", { tag: "@critical" }, () => {
  test.use({
    storageState: async ({ baseURL }, provide) => {
      await provide({ cookies: [disposableOwnerSessionCookie(baseURL!)], origins: [] });
    },
  });
  test.beforeEach(reseedFixtures);
  // The row is gone after a sign-out; put it back for whatever runs next.
  test.afterEach(reseedFixtures);

  test("Keluar asks first: Batal keeps the session, Ya, keluar ends it for that token", async ({ page, browser, baseURL }) => {
    const { owner } = loadFixtureManifest();

    // Arrive the way a person does: from Beranda, through the nav.
    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Pengaturan" }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();

    const signOutSection = page.getByRole("region", { name: "Keluar" });
    await expect(signOutSection.getByText(owner.email)).toBeVisible();
    const signOut = signOutSection.getByRole("button", { name: "Keluar", exact: true });
    const question = signOutSection.getByText("Yakin ingin keluar?");
    const confirm = signOutSection.getByRole("link", { name: "Ya, keluar" });
    await expect(question).toHaveCount(0);
    await expect(confirm).toHaveCount(0);

    // Keluar only asks. Nothing has been sent to Auth.js yet.
    await signOut.click();
    await expect(question).toBeVisible();
    await expect(confirm).toBeVisible();
    await expect(signOut).toHaveCount(0);
    await expect(page).toHaveURL(/\/pengaturan$/);

    // Batal: the question goes away and the session is still good.
    await signOutSection.getByRole("button", { name: "Batal" }).click();
    await expect(question).toHaveCount(0);
    await expect(confirm).toHaveCount(0);
    await expect(signOut).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();
    await expect(page.getByLabel("Nama / nama usaha")).toHaveValue("E2E Fixture Owner");

    // Ya, keluar: on to Auth.js's own confirmation page, then out.
    await signOutSection.getByRole("button", { name: "Keluar", exact: true }).click();
    await signOutSection.getByRole("link", { name: "Ya, keluar" }).click();
    await expect(page).toHaveURL(/\/api\/auth\/signout/);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).not.toHaveURL(/\/api\/auth\/signout/);

    // This browser is signed out: Pengaturan sends it to sign-in and shows
    // none of the owner's details.
    await page.goto("/pengaturan");
    await expect(page).toHaveURL(/\/api\/auth\/signin/);
    await expect(page.getByText(owner.email)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toHaveCount(0);

    // And so is the token itself: a fresh browser presenting the same cookie
    // is turned away, which only happens once the Session row is deleted.
    const replay = await browser.newContext({
      baseURL,
      storageState: { cookies: [disposableOwnerSessionCookie(baseURL!)], origins: [] },
    });
    try {
      const replayPage = await replay.newPage();
      await replayPage.goto("/pengaturan");
      await expect(replayPage).toHaveURL(/\/api\/auth\/signin/);
      await expect(replayPage.getByText(owner.email)).toHaveCount(0);
    } finally {
      await replay.close();
    }
  });
});
