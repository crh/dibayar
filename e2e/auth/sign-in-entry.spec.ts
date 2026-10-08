// Real-interaction coverage for the landing page's sign-in entry
// (docs/testing/journey-coverage.json: AUTH-02).
//
// A visitor with no session clicks the visible "Masuk dengan Google" on
// /masuk. That must reach Auth.js's sign-in page for the Google provider
// with /dashboard as the place to return to, and choosing Google there must
// send the browser to Google's authorization endpoint with this app's own
// callback URL.
//
// No request reaches Google. Choosing the provider posts to Auth.js, which
// answers with a redirect to accounts.google.com; the test takes that answer
// without following it (route.fetch with maxRedirects 0) and shows a local
// stub instead, so the redirect target can be checked and never loaded.
// Playwright does not intercept the later hops of a redirect, so a route on
// accounts.google.com alone would not have stopped it; that route stays as a
// tripwire and must see nothing. No account, password or consent is
// involved. The real round trip stays manual (AUTH-03, MAN-AUTH-01).
import { expect, test } from "../support/test";

test.describe("sign-in entry from the landing page", { tag: "@critical" }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Masuk dengan Google on the landing page starts the Auth.js Google sign-in that returns to the dashboard", async ({ page, context }) => {
    const reachedGoogle: string[] = [];
    await context.route(/^https:\/\/([a-z0-9-]+\.)*google\.com\//, (route) => {
      reachedGoogle.push(new URL(route.request().url()).pathname);
      return route.abort();
    });
    // Auth.js's answer to "sign in with Google", captured instead of followed.
    let handOff: { status: number; location: string; posted: URLSearchParams } | null = null;
    await context.route("**/api/auth/signin/google**", async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      handOff = {
        status: response.status(),
        location: response.headers()["location"] ?? "",
        posted: new URLSearchParams(route.request().postData() ?? ""),
      };
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Google stub</title><p>E2E stub: no sign-in happened.</p>" });
    });

    await page.goto("/masuk");
    const origin = new URL(page.url()).origin;
    const cta = page.getByRole("link", { name: "Masuk dengan Google" });
    await expect(cta).toBeVisible();
    await cta.click();

    // Auth.js's own sign-in page, carrying where to go afterwards.
    await expect(page).toHaveURL(/\/api\/auth\/signin\?/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/dashboard");
    const google = page.getByRole("button", { name: /google/i });
    await expect(google).toBeVisible();
    // Google is the only way in: no email or password field.
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    expect(handOff).toBeNull();

    // Choosing it hands off to Google's authorization endpoint for this app.
    await google.click();
    await expect(page.getByText("E2E stub: no sign-in happened.")).toBeVisible();
    expect(handOff).not.toBeNull();
    const { status, location, posted } = handOff!;
    expect(status).toBe(302);
    const authorize = new URL(location);
    expect(authorize.origin).toBe("https://accounts.google.com");
    expect(authorize.pathname).toBe("/o/oauth2/v2/auth");
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
    expect(authorize.searchParams.get("response_type")).toBe("code");
    expect((authorize.searchParams.get("scope") ?? "").split(" ")).toEqual(expect.arrayContaining(["openid", "email"]));
    expect((authorize.searchParams.get("client_id") ?? "").length > 0, "a client id is sent").toBe(true);
    // The return target chosen on the landing page went along with it.
    expect(posted.get("callbackUrl")).toBe("/dashboard");
    // Nothing was sent to Google.
    expect(reachedGoogle).toEqual([]);
    // Still signed out: a protected page sends the visitor to sign-in.
    await page.goto("/deal");
    await expect(page).toHaveURL(/\/api\/auth\/signin/);
  });
});
