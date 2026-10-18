// Restricted-pilot creator access (src/lib/pilot-access.ts, src/auth.ts).
// The E2E server always runs with the gate enforced: only the two invited
// fixture owners are on PILOT_ALLOWED_EMAILS (playwright.e2e.config.ts).
// The uninvited fixture user has a real, unexpired database session and a
// deal of its own, so these tests prove an *already-established* session
// for an account outside the allowlist reaches no creator data, through
// pages or the API, while the recipient-facing share link and its PDF stay
// reachable without any creator session.
//
// Not covered here (no real Google in CI): the OAuth sign-in denial itself.
// That is unit-tested on the signIn callback (src/auth.test.ts) and checked
// by hand with a real uninvited Google account on staging.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { uninvitedSessionCookie } from "../support/auth";
import { E2E_UNINVITED_DEAL_BRAND } from "../support/fixture-ids";
import { reseedFixtures } from "../support/reseed";

test.describe("restricted pilot access", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("an existing session for an uninvited account is sent to the invite-only page and sees no data", async ({ browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const context = await browser.newContext({ storageState: { cookies: [uninvitedSessionCookie(baseURL!)], origins: [] } });
    const page = await context.newPage();
    try {
      for (const path of ["/", "/deal", "/invoice", "/pengaturan", `/deal/${manifest.deals.masuk}`]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/akses-terbatas$/);
        await expect(page.getByRole("heading", { level: 1, name: "Akses khusus kreator yang diundang" })).toBeVisible();
        await expect(page.getByText(E2E_UNINVITED_DEAL_BRAND)).toHaveCount(0);
        await expect(page.getByTestId("bottom-nav")).toHaveCount(0);
      }
      const body = (await page.content()).toLowerCase();
      expect(body).not.toContain("uninvited@example.invalid");
      expect(body).not.toContain("e2e fixture uninvited");

      // Offers sign-out so the creator can switch to an invited account.
      await expect(page.getByRole("link", { name: "Keluar dari akun ini" })).toHaveAttribute("href", "/api/auth/signout?callbackUrl=%2F");
    } finally {
      await context.close();
    }
  });

  test("the uninvited session is refused by owner APIs, reads and writes alike", async ({ browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const context = await browser.newContext({ storageState: { cookies: [uninvitedSessionCookie(baseURL!)], origins: [] } });
    const page = await context.newPage();
    const origin = new URL(baseURL!).origin;
    try {
      for (const path of ["/api/deals", "/api/invoices", "/api/me/settings", `/api/deals/${manifest.deals.masuk}`]) {
        const response = await page.request.get(path);
        expect(response.status(), path).toBe(401);
        expect(await response.text(), path).not.toContain(E2E_UNINVITED_DEAL_BRAND);
      }

      const create = await page.request.post("/api/deals", {
        headers: { Origin: origin },
        data: { brand: "E2E Brand Tidak Boleh Dibuat", feeIdr: 1_000_000 },
      });
      expect(create.status()).toBe(401);

      // Auth.js's own session endpoint carries no identity for a denied session.
      const sessionResponse = await page.request.get("/api/auth/session");
      expect(sessionResponse.status()).toBe(200);
      const session = await sessionResponse.json();
      expect(session).toMatchObject({ pilotAccessDenied: true });
      expect(session.user ?? null).toBeNull();
      expect(JSON.stringify(session)).not.toContain("uninvited");
    } finally {
      await context.close();
    }
  });

  test("an invited owner still reaches the app; recipients still open a share link and its PDF with no session", async ({ page, browser }) => {
    // The project-level storageState is the invited fixture owner.
    await page.goto("/");
    await expect(page).not.toHaveURL(/akses-terbatas/);
    await expect(page.getByTestId("top-bar")).toBeVisible();
    expect((await page.request.get("/api/deals")).status()).toBe(200);

    const manifest = loadFixtureManifest();
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const recipient = await anonymous.newPage();
    try {
      await recipient.goto(`/i/${manifest.shareTokens.active}`);
      await expect(recipient).not.toHaveURL(/akses-terbatas|signin/);
      await expect(recipient.getByText(/Nomor invoice:\s*E2E\/SENT\/001/)).toBeVisible();
      const pdf = await recipient.request.get(`/api/public/invoices/${manifest.shareTokens.active}/pdf`);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
    } finally {
      await anonymous.close();
    }
  });

  test("the invite-only page names no account and offers sign-in after an Auth.js AccessDenied", async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await anonymous.newPage();
    try {
      const response = await page.goto("/akses-terbatas?error=AccessDenied");
      expect(response?.status()).toBe(200);
      await expect(page.getByText(/belum terdaftar untuk pilot Dibayar/)).toBeVisible();
      await expect(page.getByRole("link", { name: "Masuk dengan akun lain" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Keluar dari akun ini" })).toHaveCount(0);
    } finally {
      await anonymous.close();
    }
  });
});
