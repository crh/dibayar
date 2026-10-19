import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Captures the configuration src/auth.ts hands to NextAuth so its pilot
// callbacks can be exercised directly, without a database or Google.
const { nextAuth, innerAuth } = vi.hoisted(() => {
  const innerAuth = vi.fn();
  return {
    innerAuth,
    nextAuth: vi.fn((_config: unknown) => ({ handlers: {}, auth: innerAuth, signIn: vi.fn(), signOut: vi.fn() })),
  };
});
vi.mock("next-auth", () => ({ default: nextAuth }));
vi.mock("next-auth/providers/google", () => ({ default: { id: "google" } }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { auth } from "./auth";

type Callbacks = {
  signIn(params: { user?: { email?: string | null }; account?: { provider: string } | null; profile?: Record<string, unknown> }): boolean;
  session(params: { session: Record<string, unknown>; user?: Record<string, unknown> }): Record<string, unknown>;
};
type Config = { callbacks: Callbacks; pages: { error: string } };

const config = nextAuth.mock.calls[0][0] as Config;
const { signIn, session } = config.callbacks;
const expires = "2099-01-01T00:00:00.000Z";

const dbUser = (email: string | null) => ({
  id: "user-1",
  name: "Creator",
  email,
  image: null,
  language: "id",
  emailVerified: null,
});

beforeEach(() => {
  vi.stubEnv("PILOT_ACCESS_MODE", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("PILOT_ALLOWED_EMAILS", "creator@example.invalid");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("auth config", () => {
  it("routes Auth.js errors, including AccessDenied, to the generic access page", () => {
    expect(config.pages.error).toBe("/akses-terbatas");
  });
});

describe("signIn callback (pilot gate)", () => {
  const google = { provider: "google" };
  const verified = (email: string) => ({ email, email_verified: true });

  it("allows an allowlisted, verified Google account", () => {
    expect(signIn({ user: { email: "creator@example.invalid" }, account: google, profile: verified("creator@example.invalid") })).toBe(true);
  });

  it("denies a new, uninvited Google account and does not log its email", () => {
    const warn = vi.mocked(console.warn);
    expect(signIn({ user: { email: "stranger@example.invalid" }, account: google, profile: verified("stranger@example.invalid") })).toBe(false);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("stranger");
  });

  it("denies an unverified Google email", () => {
    expect(
      signIn({ user: { email: "creator@example.invalid" }, account: google, profile: { email: "creator@example.invalid", email_verified: false } }),
    ).toBe(false);
  });

  it("denies everyone when the allowlist is unset (fail closed)", () => {
    vi.stubEnv("PILOT_ALLOWED_EMAILS", "");
    expect(signIn({ user: { email: "creator@example.invalid" }, account: google, profile: verified("creator@example.invalid") })).toBe(false);
  });

  it("denies everyone on Production when open mode is requested", () => {
    vi.stubEnv("PILOT_ACCESS_MODE", "open");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(signIn({ user: { email: "creator@example.invalid" }, account: google, profile: verified("creator@example.invalid") })).toBe(false);
  });

  it("reads the allowlist at request time, so a removal takes effect without a redeploy of code", () => {
    expect(signIn({ user: { email: "creator@example.invalid" }, account: google, profile: verified("creator@example.invalid") })).toBe(true);
    vi.stubEnv("PILOT_ALLOWED_EMAILS", "someone-else@example.invalid");
    expect(signIn({ user: { email: "creator@example.invalid" }, account: google, profile: verified("creator@example.invalid") })).toBe(false);
  });
});

describe("session callback (existing sessions)", () => {
  const rawSession = { expires, sessionToken: "raw-db-token", userId: "user-1" };

  it("returns only id, name, email and image for an allowlisted account", () => {
    const result = session({ session: { ...rawSession, user: dbUser("creator@example.invalid") }, user: dbUser("creator@example.invalid") });
    expect(result).toEqual({
      expires,
      user: { id: "user-1", name: "Creator", email: "creator@example.invalid", image: null },
    });
    expect(JSON.stringify(result)).not.toContain("raw-db-token");
  });

  it("denies an existing session whose account is not allowlisted, with no user or identity in the payload", () => {
    const result = session({ session: { ...rawSession, user: dbUser("stranger@example.invalid") }, user: dbUser("stranger@example.invalid") });
    expect(result).toEqual({ expires, user: null, pilotAccessDenied: true });
    expect(JSON.stringify(result)).not.toContain("stranger");
    expect(JSON.stringify(result)).not.toContain("user-1");
  });

  it("keeps user as an explicit null, so next-auth's server-side { user, ...session } merge cannot restore the database user", () => {
    const result = session({ session: { ...rawSession }, user: dbUser("stranger@example.invalid") });
    expect(Object.prototype.hasOwnProperty.call(result, "user")).toBe(true);
    // The merge next-auth applies in getSession (lib/index.js):
    const merged = { user: dbUser("stranger@example.invalid"), ...result };
    expect(merged.user).toBeNull();
  });

  it("denies a session whose account has no email", () => {
    expect(session({ session: { ...rawSession }, user: dbUser(null) })).toEqual({ expires, user: null, pilotAccessDenied: true });
  });

  it("denies a session with no resolved user id", () => {
    expect(session({ session: { ...rawSession }, user: { email: "creator@example.invalid" } })).toEqual({ expires, user: null, pilotAccessDenied: true });
  });

  it("denies a previously allowed session once its email leaves the allowlist", () => {
    const params = { session: { ...rawSession }, user: dbUser("creator@example.invalid") };
    expect(session(params)).toHaveProperty("user");
    vi.stubEnv("PILOT_ALLOWED_EMAILS", "someone-else@example.invalid");
    expect(session(params)).toEqual({ expires, user: null, pilotAccessDenied: true });
  });

  it("denies every session when the allowlist is malformed", () => {
    vi.stubEnv("PILOT_ALLOWED_EMAILS", "creator@example.invalid,broken");
    expect(session({ session: { ...rawSession }, user: dbUser("creator@example.invalid") })).toEqual({ expires, user: null, pilotAccessDenied: true });
  });
});

describe("auth() wrapper", () => {
  it("strips the user from a denied session even if next-auth merged one back in", async () => {
    innerAuth.mockResolvedValue({ expires, pilotAccessDenied: true, user: dbUser("stranger@example.invalid") });
    const result = await auth();
    expect(result).toEqual({ expires, pilotAccessDenied: true });
    expect(result?.user?.id).toBeUndefined();
  });

  it("returns null when there is no session", async () => {
    innerAuth.mockResolvedValue(null);
    expect(await auth()).toBeNull();
  });

  it("returns null for a session without a user id", async () => {
    innerAuth.mockResolvedValue({ expires, user: { email: "creator@example.invalid" } });
    expect(await auth()).toBeNull();
  });

  it("passes an allowed session through unchanged", async () => {
    const allowed = { expires, user: { id: "user-1", name: "Creator", email: "creator@example.invalid", image: null } };
    innerAuth.mockResolvedValue(allowed);
    expect(await auth()).toBe(allowed);
  });
});
