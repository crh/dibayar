// Single source of truth for the deterministic IDs shared between
// scripts/e2e-fixtures.ts (writes them to the DB) and the Playwright config
// (needs the session token to build storageState before global setup's
// manifest file exists). Keep this file free of any Node/Prisma imports so
// playwright.config.ts can import it directly.
export const E2E_FIXTURE_PREFIX = "e2e-t0";
export const E2E_OWNER_SESSION_TOKEN = `${E2E_FIXTURE_PREFIX}-session-owner-do-not-share`;
// A second, disposable session for the SAME owner, used only by the sign-out
// journey (e2e/auth/session.spec.ts). Signing out deletes the Session row
// server-side -- if that test used E2E_OWNER_SESSION_TOKEN, it would
// invalidate the cookie every other test's storageState relies on, breaking
// any test that happens to run afterward in the same worker.
export const E2E_OWNER_SIGNOUT_SESSION_TOKEN = `${E2E_FIXTURE_PREFIX}-session-owner-signout-do-not-share`;

// A second, genuinely different *user* -- not another session for the same
// owner (E2E_OWNER_SIGNOUT_SESSION_TOKEN above still authenticates as
// `${E2E_FIXTURE_PREFIX}-owner`). Only a distinct owned-by-someone-else
// identity can prove server-side ownership *denial*: a second session for
// the same user would authenticate fine and legitimately see every fixture
// deal/invoice, proving nothing about cross-user isolation. Used by the
// ownership-denial journey (e2e/security/ownership-denial.spec.ts) to
// authenticate as a user who owns none of the primary owner's fixture data.
export const E2E_OTHER_OWNER_ID = `${E2E_FIXTURE_PREFIX}-other-owner`;
export const E2E_OTHER_OWNER_SESSION_TOKEN = `${E2E_FIXTURE_PREFIX}-session-other-owner-do-not-share`;
