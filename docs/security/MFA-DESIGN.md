# MFA design note (TOTP vs. passkeys/WebAuthn)

Status: design only. **MFA is not implemented in the MVP.** This closes
`SECURITY.md`'s `[ ] MFA design documented` checklist item as a design
artifact, not as a shipped feature. Post-MVP, `TBD` per `CLAUDE.md`.

## Why this is additive, not a replacement

Dibayar has no password. The only current login is Google OAuth via Auth.js
(`src/auth.ts`, `session: { strategy: "database" }`). Any MFA here is a
**second factor layered on top of that session**, guarding the Dibayar
dashboard on a device where a Google session is already live (e.g. a shared
or stolen phone with the browser's Google session cookie still valid) — it
does not, and cannot, substitute for the account security Google already
applies to the creator's own Google account.

## Option A — TOTP (authenticator app codes)

- Well-understood, narrow implementation surface: one new `Account`-adjacent
  table for the shared secret + recovery codes, a QR-enrollment screen, a
  6-digit challenge on sign-in, `otplib` or equivalent (mature, no
  novel-crypto risk).
- Works on every device regardless of hardware: any authenticator app
  (Google Authenticator, Authy, etc.), or a manually-copied code if needed.
  No dependency on the phone's own biometric/security-key hardware.
- Cost: an extra app to install, and a recovery-code flow that must be
  designed carefully (lost-phone support burden falls on Chris, not a
  platform vendor).

## Option B — Passkeys / WebAuthn

- Better native mobile UX in principle (Face ID/fingerprint, no app to
  install), consistent with `DESIGN.md`'s mobile-first direction.
- Real prerequisites this project does not have yet: a `WebAuthnCredential`
  schema (public key, credential ID, sign counter, per-user), a
  challenge/response ceremony wired in *after* the Auth.js OAuth callback but
  *before* the app session is considered fully authenticated (WebAuthn as a
  second factor after a federated login is a less common integration shape
  than WebAuthn-as-primary-login, and needs its own tested flow, not a
  library default).
- Cost: inconsistent platform-passkey support across the lower/mid-range
  Android devices common among Indonesian solo creators (`PRODUCT.md`'s
  target: 5k–500k-follower creators, "zero tooling," mobile-first budgets),
  versus TOTP's device-agnostic 6-digit code. Support-burden risk if a
  creator's platform authenticator (tied to one device/OS account) is
  unavailable after a phone change or factory reset, with no recovery-code
  equivalent as standardized as TOTP's.

## Recommendation

**TOTP first, if/when MFA is built.** For this user base — non-technical
solo creators on varied, often budget Android hardware, already completing
one federated-login step — TOTP's device-independence and mature tooling
outweigh passkeys' smoother UX on higher-end hardware. Revisit passkeys as a
second, optional method once real device-capability data exists (e.g. from
M4 creator validation) to justify the added implementation cost.

## Prerequisites before implementation (not started)

1. Decide enrollment is opt-in or Chris-mandated for all accounts.
2. New schema: shared secret (encrypted at rest, not just hashed — TOTP
   requires the raw secret to verify), recovery codes (hashed, one-time use),
   and an audit trail consistent with the existing `AuthEvent` model.
3. A recovery flow for a lost authenticator that does not become a
   support-ticket-only path (e.g. one-time recovery codes shown once at
   enrollment).
4. Session-strategy interaction: Auth.js's `session: { strategy: "database" }`
   currently treats OAuth completion as fully authenticated; a TOTP step
   needs an explicit "pending second factor" session state so a
   partially-authenticated session cannot reach owner-scoped routes.
5. Rate limiting the TOTP challenge endpoint itself (same pattern as
   `src/lib/rate-limit.ts`'s existing auth limiter), since a 6-digit code is
   brute-forceable without one.

None of the above is implemented. This document is the design record only.
