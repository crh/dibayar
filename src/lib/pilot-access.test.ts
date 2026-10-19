import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPilotEmailAllowed,
  isPilotSignInAllowed,
  logPilotConfigProblem,
  normalizePilotEmail,
  readPilotAccessConfig,
} from "./pilot-access";

const allowlist = (emails: string, extra: Record<string, string> = {}) =>
  readPilotAccessConfig({ PILOT_ALLOWED_EMAILS: emails, ...extra });

describe("readPilotAccessConfig", () => {
  it("fails closed when nothing is configured", () => {
    expect(readPilotAccessConfig({})).toEqual({ mode: "closed", reason: "missing" });
  });

  it("fails closed for an empty or separator-only list", () => {
    expect(allowlist("")).toEqual({ mode: "closed", reason: "missing" });
    expect(allowlist(" , \n ,")).toEqual({ mode: "closed", reason: "missing" });
  });

  it("fails closed for the whole list when any entry is malformed", () => {
    expect(allowlist("a@example.invalid,not-an-email")).toEqual({ mode: "closed", reason: "malformed" });
    expect(allowlist("a@example.invalid,@example.invalid")).toEqual({ mode: "closed", reason: "malformed" });
    expect(allowlist("a@localhost")).toEqual({ mode: "closed", reason: "malformed" });
  });

  it("rejects a non-ASCII entry rather than normalizing it", () => {
    expect(allowlist("ｃreator@example.invalid")).toEqual({ mode: "closed", reason: "malformed" });
  });

  it("accepts comma-, space- and newline-separated entries, lowercased", () => {
    const config = allowlist(" A@Example.invalid,b@example.invalid\nc@example.invalid  d@example.invalid ");
    expect(config.mode).toBe("allowlist");
    if (config.mode !== "allowlist") return;
    expect([...config.emails].sort()).toEqual(["a@example.invalid", "b@example.invalid", "c@example.invalid", "d@example.invalid"]);
  });

  it("treats an unknown mode as closed", () => {
    expect(allowlist("a@example.invalid", { PILOT_ACCESS_MODE: "public" })).toEqual({ mode: "closed", reason: "invalid-mode" });
  });

  it("honours open mode outside Production only", () => {
    expect(readPilotAccessConfig({ PILOT_ACCESS_MODE: "open" })).toEqual({ mode: "open" });
    expect(readPilotAccessConfig({ PILOT_ACCESS_MODE: " OPEN ", VERCEL_ENV: "preview" })).toEqual({ mode: "open" });
    expect(readPilotAccessConfig({ PILOT_ACCESS_MODE: "open", VERCEL_ENV: "production" })).toEqual({
      mode: "closed",
      reason: "open-in-production",
    });
  });

  it("does not let open mode in Production fall back to the allowlist", () => {
    const config = readPilotAccessConfig({
      PILOT_ACCESS_MODE: "open",
      VERCEL_ENV: "production",
      PILOT_ALLOWED_EMAILS: "a@example.invalid",
    });
    expect(isPilotEmailAllowed(config, "a@example.invalid")).toBe(false);
  });

  it("enforces the allowlist on Production when it is configured", () => {
    const config = allowlist("a@example.invalid", { VERCEL_ENV: "production" });
    expect(isPilotEmailAllowed(config, "a@example.invalid")).toBe(true);
    expect(isPilotEmailAllowed(config, "b@example.invalid")).toBe(false);
  });
});

describe("normalizePilotEmail", () => {
  it("trims and lowercases ASCII addresses", () => {
    expect(normalizePilotEmail("  Creator@Example.INVALID ")).toBe("creator@example.invalid");
  });

  it("returns null for missing, non-string, non-ASCII or oversized input", () => {
    expect(normalizePilotEmail(undefined)).toBeNull();
    expect(normalizePilotEmail(null)).toBeNull();
    expect(normalizePilotEmail(42)).toBeNull();
    expect(normalizePilotEmail("")).toBeNull();
    expect(normalizePilotEmail("crеator@example.invalid")).toBeNull(); // Cyrillic е
    expect(normalizePilotEmail(`${"a".repeat(250)}@example.invalid`)).toBeNull();
  });
});

describe("isPilotEmailAllowed", () => {
  const config = allowlist("creator@example.invalid");

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isPilotEmailAllowed(config, "CREATOR@example.invalid")).toBe(true);
    expect(isPilotEmailAllowed(config, " creator@example.invalid ")).toBe(true);
  });

  it("does not match lookalikes, sub-addresses, other domains or a missing email", () => {
    expect(isPilotEmailAllowed(config, "ｃreator@example.invalid")).toBe(false);
    expect(isPilotEmailAllowed(config, "creator+x@example.invalid")).toBe(false);
    expect(isPilotEmailAllowed(config, "creator@example.invalid.attacker.test")).toBe(false);
    expect(isPilotEmailAllowed(config, "other@example.invalid")).toBe(false);
    expect(isPilotEmailAllowed(config, null)).toBe(false);
    expect(isPilotEmailAllowed(config, undefined)).toBe(false);
  });

  it("denies everyone when closed", () => {
    expect(isPilotEmailAllowed(readPilotAccessConfig({}), "creator@example.invalid")).toBe(false);
  });
});

describe("isPilotSignInAllowed", () => {
  const config = allowlist("creator@example.invalid");
  const base = {
    config,
    provider: "google",
    userEmail: "creator@example.invalid",
    profileEmail: "creator@example.invalid",
    profileEmailVerified: true,
  };

  it("allows an allowlisted, Google-verified account", () => {
    expect(isPilotSignInAllowed(base)).toBe(true);
  });

  it("denies an unverified Google email, including a truthy non-boolean", () => {
    expect(isPilotSignInAllowed({ ...base, profileEmailVerified: false })).toBe(false);
    expect(isPilotSignInAllowed({ ...base, profileEmailVerified: undefined })).toBe(false);
    expect(isPilotSignInAllowed({ ...base, profileEmailVerified: "true" })).toBe(false);
  });

  it("denies another provider", () => {
    expect(isPilotSignInAllowed({ ...base, provider: "github" })).toBe(false);
    expect(isPilotSignInAllowed({ ...base, provider: undefined })).toBe(false);
  });

  it("denies when either the profile email or the stored user email is not allowlisted", () => {
    expect(isPilotSignInAllowed({ ...base, profileEmail: "other@example.invalid" })).toBe(false);
    expect(isPilotSignInAllowed({ ...base, userEmail: "other@example.invalid" })).toBe(false);
    expect(isPilotSignInAllowed({ ...base, profileEmail: undefined })).toBe(false);
  });

  it("denies everyone when the configuration is closed", () => {
    expect(isPilotSignInAllowed({ ...base, config: readPilotAccessConfig({}) })).toBe(false);
  });
});

describe("logPilotConfigProblem", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the reason once and never the configured value", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = allowlist("secret-creator@example.invalid,broken");
    logPilotConfigProblem(config);
    logPilotConfigProblem(config);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain("malformed");
    expect(String(error.mock.calls[0][0])).not.toContain("secret-creator");
  });

  it("stays quiet for a valid configuration", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logPilotConfigProblem(allowlist("a@example.invalid"));
    expect(error).not.toHaveBeenCalled();
  });
});
