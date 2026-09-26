// Auth/session smoke: the deterministic session fixture (see
// e2e/support/auth.ts) covers "already authenticated" for every other
// journey, so this file is the one place that also exercises the
// unauthenticated redirect and the real Auth.js sign-out flow.
import { expect, test } from "../support/test";
import { E2E_OWNER_SIGNOUT_SESSION_TOKEN } from "../support/fixture-ids";
import { reseedFixtures } from "../support/reseed";

test.describe("auth/session", { tag: "@critical" }, () => {
  test("unauthenticated visitor hitting a protected route is redirected to sign-in", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/deal");
    await expect(page).toHaveURL(/\/api\/auth\/signin/);

    await context.close();
  });

  test("authenticated Beranda loads with real seeded data", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Perlu dikejar" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "3 deal terdekat" })).toBeVisible();
  });

  test("sign out via the account menu ends the session and returns to sign-in on the next protected visit", async ({ browser, baseURL }) => {
    // A dedicated session, not the shared E2E_OWNER_SESSION_TOKEN every other
    // test's storageState uses: signing out deletes the Session row
    // server-side, which would invalidate every other test's cookie if they
    // shared one and happened to run after this in the same worker.
    //
    // Reseed first: this Session row was already consumed if another
    // project ran this same test earlier in this invocation (see
    // e2e/support/reseed.ts).
    reseedFixtures();
    const context = await browser.newContext({
      storageState: {
        cookies: [
          {
            name: "authjs.session-token",
            value: E2E_OWNER_SIGNOUT_SESSION_TOKEN,
            domain: new URL(baseURL!).hostname,
            path: "/",
            expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
    });
    const page = await context.newPage();

    await page.goto("/");
    await page.getByRole("button", { name: "Menu akun" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();

    // Auth.js's own signout confirmation page -- not custom app UI.
    await expect(page).toHaveURL(/\/api\/auth\/signout/);
    await page.getByRole("button", { name: /sign out/i }).click();

    await page.goto("/deal");
    await expect(page).toHaveURL(/\/api\/auth\/signin/);

    await context.close();
  });
});
