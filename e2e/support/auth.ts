// Deterministic E2E authentication.
//
// Security boundary (see docs/testing/E2E.md "How authentication works" for
// the full writeup): this does NOT add any bypass endpoint or special-case
// branch to production auth code. It authenticates through the exact real
// mechanism production uses -- an Auth.js database session, looked up by the
// `authjs.session-token` cookie (src/auth.ts: `session: { strategy:
// "database" }`) -- by writing a real Session row straight into the
// approved disposable local test database via scripts/e2e-fixtures.ts, then
// handing Playwright that cookie. There is no code path in src/ that trusts
// a token an E2E run invents; the only thing skipped is clicking through
// Google's interactive OAuth consent screen. A production database has no
// row with this sessionToken, and nothing in application code accepts one
// that isn't a genuine, adapter-issued Session row, so this mechanism cannot
// become a production auth bypass -- it only works because the test DB
// guardrails in scripts/e2e-fixtures.ts refuse to run against anything but
// 127.0.0.1:55432/dibayar_test.
import type { Cookie } from "@playwright/test";
import { E2E_OWNER_SESSION_TOKEN } from "./fixture-ids";

const SESSION_COOKIE_NAME = "authjs.session-token";

export function ownerSessionCookie(baseURL: string): Cookie {
  const origin = new URL(baseURL);
  const future = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
  return {
    name: SESSION_COOKIE_NAME,
    value: E2E_OWNER_SESSION_TOKEN,
    domain: origin.hostname,
    path: "/",
    expires: future,
    httpOnly: true,
    secure: origin.protocol === "https:",
    sameSite: "Lax",
  };
}

export function unauthenticatedStorageState() {
  return { cookies: [], origins: [] };
}
