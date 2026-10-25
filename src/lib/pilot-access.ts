// Restricted-pilot creator access (#65 release, 2026-10-18). Only creators
// whose Google email is on a server-only allowlist may sign in or use an
// existing session. Recipient-facing invoice links (/i/[token],
// /api/public/invoices/[token]/pdf) never read a creator session, so they
// are untouched by this gate.
//
// Configuration (server-only, never NEXT_PUBLIC_*):
//   PILOT_ALLOWED_EMAILS  comma- or whitespace-separated Google emails
//   PILOT_ACCESS_MODE     "allowlist" (default) | "open"
//
// Fails closed: an unset, empty or malformed allowlist denies everyone.
// "open" is ignored on a Vercel Production deployment, so Production can
// only ever run with an allowlist.

export type PilotAccessEnv = { PILOT_ALLOWED_EMAILS?: string; PILOT_ACCESS_MODE?: string; VERCEL_ENV?: string; [key: string]: string | undefined };

export type PilotAccessConfig =
  | { mode: "open" }
  | { mode: "allowlist"; emails: ReadonlySet<string> }
  | { mode: "closed"; reason: "missing" | "malformed" | "invalid-mode" | "open-in-production" };

// ASCII only, lowercased. No Unicode normalization: a lookalike or
// compatibility-mapped address must never match an allowlisted one.
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function normalizePilotEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function readPilotAccessConfig(env: PilotAccessEnv = process.env): PilotAccessConfig {
  const mode = (env.PILOT_ACCESS_MODE ?? "").trim().toLowerCase() || "allowlist";

  if (mode === "open") {
    return env.VERCEL_ENV === "production" ? { mode: "closed", reason: "open-in-production" } : { mode: "open" };
  }
  if (mode !== "allowlist") return { mode: "closed", reason: "invalid-mode" };

  const entries = (env.PILOT_ALLOWED_EMAILS ?? "").split(/[\s,]+/).filter(Boolean);
  if (entries.length === 0) return { mode: "closed", reason: "missing" };

  const emails = new Set<string>();
  for (const entry of entries) {
    const email = normalizePilotEmail(entry);
    // One bad entry voids the whole list rather than silently dropping it.
    if (!email) return { mode: "closed", reason: "malformed" };
    emails.add(email);
  }
  return { mode: "allowlist", emails };
}

export function isPilotEmailAllowed(config: PilotAccessConfig, rawEmail: unknown): boolean {
  if (config.mode === "open") return true;
  if (config.mode === "closed") return false;
  const email = normalizePilotEmail(rawEmail);
  return email !== null && config.emails.has(email);
}

type SignInCheck = {
  config: PilotAccessConfig;
  provider: string | undefined;
  // The stored user's email when the Google account is already linked,
  // otherwise the provider's user object.
  userEmail: unknown;
  profileEmail: unknown;
  profileEmailVerified: unknown;
};

// Sign-in needs a Google-verified email, and both the provider email and
// the stored user's email must be allowlisted (they can differ if the
// Google address changed after the account was created).
export function isPilotSignInAllowed({ config, provider, userEmail, profileEmail, profileEmailVerified }: SignInCheck): boolean {
  if (config.mode === "open") return true;
  if (provider !== "google") return false;
  if (profileEmailVerified !== true) return false;
  return isPilotEmailAllowed(config, profileEmail) && isPilotEmailAllowed(config, userEmail);
}

let lastLoggedClosedReason: string | null = null;

// Logs the misconfiguration reason (never the list) once per reason per process.
export function logPilotConfigProblem(config: PilotAccessConfig) {
  if (config.mode !== "closed" || lastLoggedClosedReason === config.reason) return;
  lastLoggedClosedReason = config.reason;
  console.error(`[pilot-access] creator access is closed: ${config.reason} configuration`);
}
