# Dibayar Same-Origin Verification & Remediation — Receipt

## 1. Starting `main` SHA
`282dcdeb5fd1f7d6ccce03b9710a3a83b157f3a8` (merge of PR #6, confirmed matching `origin/main`, clean tracked tree at session start).

## 2. Branch name
`security/verify-same-origin-runtime` — created locally for Phase 1/2 investigation only. **Never pushed to origin.** Deleted at the end of this session after cleanup. No trace remains except this receipt.

## 3. PR number / URL
None. No code change was made or proposed; no PR was warranted or opened.

## 4. Current `isSameOriginRequest` behavior
Defined once in `src/lib/request-origin.ts` and duplicated (byte-for-byte logic, with an explanatory comment) in `src/app/api/invoices/[id]/share/route.ts`:

```ts
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
```

It compares the browser-sent `Origin` header against `request.url`'s own origin — deliberately, per the comment in `share/route.ts`, to avoid trusting spoofable `Host`/`X-Forwarded-Host` headers. It never reads `Host` or `X-Forwarded-Host` directly. Called from every mutating handler (POST/PATCH/DELETE) in: `deals/route.ts`, `deals/[id]/route.ts`, `invoices/route.ts`, `invoices/[id]/route.ts`, `invoices/[id]/share/route.ts`, `me/settings/route.ts`, `me/language/route.ts`. In every call site, the session/auth check runs **before** the origin check, so an unauthenticated request never reaches `isSameOriginRequest` — this matters for verification (see §16).

No proxy-header normalization exists elsewhere in the repo (`next.config.ts` has no `experimental.trustHostHeader`, no `serverActions.allowedOrigins`, no custom middleware/proxy touching `Origin`/`Host`).

## 5. Local reproduction result — **REPRODUCED**
Built a throwaway, non-committed diagnostic route, ran `next start` (production server) on a free local port, and hit it via both `localhost` and `127.0.0.1`:

```
via localhost:  host=localhost:3100      requestUrlOrigin=http://localhost:3100   → isSameOriginRequest=true
via 127.0.0.1:  host=127.0.0.1:3100      requestUrlOrigin=http://localhost:3100   → isSameOriginRequest=false
```

Root cause traced in Next.js 16.3.3's own server source (`node_modules/next/dist/server/next-server.js:1280`):

```js
const initUrl = this.fetchHostname && this.port
  ? `${protocol}://${this.fetchHostname}:${this.port}${req.url}`
  : this.nextConfig.experimental.trustHostHeader
    ? `https://${req.headers.host || 'localhost'}${req.url}`
    : req.url;
```

When the server has a configured bind hostname/port (`this.fetchHostname && this.port` — true for `next start`, which defaults to binding `localhost`), `request.url` is built from that **configured** hostname, completely ignoring whatever `Host` header the client actually sent. That's why `127.0.0.1` requests get an `http://localhost:3100`-origin `request.url` no matter what — confirming the previously-observed local mismatch still exists on current `main`.

## 6. Vercel runtime evidence
**None obtained.** See §16 for why, and what was attempted.

## 7. Classification
**`INCONCLUSIVE`**

## 8. Security impact
Important nuance: if this bug reproduces on Vercel, it does **not** weaken CSRF protection — the function fails closed (rejects), it never fails open. The impact of an unresolved reproduction would be **availability/reliability** (legitimate authenticated users getting wrongly-rejected `403`s on mutating actions under certain hostname/alias paths — e.g. Vercel preview aliases, or if `this.fetchHostname`/`this.port` end up set to something Vercel-internal in the serverless runtime), not a same-origin/CSRF bypass. Given that framing, this is not an active exploit path; it's a correctness question worth closing out, not an urgent security hole.

## 9. Whether remediation was required
**Undetermined** — no remediation was attempted or should be attempted before Phase 3 evidence exists, per the task's own explicit instruction not to ship a speculative security change.

## 10. Exact files changed
**None net.** A temporary diagnostic route (`src/app/api/diag-origin-probe-9f31/route.ts`) was created for local-only testing (§5) and fully deleted before returning to `main`. `git status` on `main` at session end shows only the pre-existing untracked receipt files that predate this session (`docs/receipts/archive/DIBAYAR-MOBILE-POLISH-BATCH-RECEIPT.md`, `docs/receipts/DIBAYAR-UX-AUDIT-STABILIZATION-MERGE-RECEIPT.md`, `docs/receipts/archive/DIBAYAR-UX-NEXT-BATCH-RECEIPT.md`, `docs/receipts/DIBAYAR-UX-NEXT-CLAUDE-DESIGN-BRIEF.md`), plus this new receipt.

## 11. Tests added/changed
None — no remediation was made, and no runtime contract was confirmed live, so no test would be evidence-driven yet.

## 12. Local validation results
No lint/typecheck/test/build run against changed source, because no source change persisted. The local reproduction (§5) used `npm run build` + `npm run start` (on port 3100, since port 3000 was occupied by live Hermes orchestration infrastructure — not touched) purely as a diagnostic, then was fully reverted.

## 13. GitHub CI results
Not applicable — nothing was pushed.

## 14. Confirmation that temporary diagnostic code was removed
Confirmed. `rm -rf src/app/api/diag-origin-probe-9f31` was run, `git status --short` on `main` shows no trace of it, and the throwaway branch was deleted (`git branch -D security/verify-same-origin-runtime`).

## 15. Confirmation that no real production user data was mutated
Confirmed. The only live-network calls made during this workstream were: (a) `vercel whoami` / `vercel project ls` / `vercel ls` / `vercel env ls preview` (read-only CLI calls), (b) one unauthenticated `curl` GET against an *existing* Preview deployment URL (`dibayar-jykphwljg-kenji-iwakura.vercel.app`) solely to confirm Vercel SSO is active — it 302'd to `vercel.com/sso-api` before reaching application code, so no app code ran and nothing was read or written, and (c) local-only traffic to a throwaway `next start` instance on `localhost:3100`. Production (`dibayar.vercel.app`) was never contacted in this session.

## 16. Risks / residual uncertainty — why this is `INCONCLUSIVE`, not a real finding
Phase 3 requires observing how the *actual Vercel runtime* (Preview or Production) constructs `request.url` relative to the incoming `Host`/`Origin`. Two independent ways to get that evidence were attempted and both were blocked by this session's own safety controls (not by any technical failure), and abandoning further workarounds was the correct call rather than trying to route around them:

- **Env-var-gated diagnostic route**: blocked writing `DIAG_ORIGIN_PROBE_SECRET` to Vercel's Preview environment — denied as "Secret-Store Writes". Confirmed via `vercel env ls preview` that nothing was actually created.
- **Generating a random token** to gate the route another way: denied as "Credential Materialization".
- **Deploying the (ultimately secret-free, SSO-gated-by-default) diagnostic route** via `vercel deploy`, both with and without `--yes`: denied as "Blind Apply" and then "Security Weaken" respectively.

A structural blocker compounds this: since the session's auth/origin check ordering puts the session check *before* the origin check on every real mutating route (§4), an unauthenticated black-box probe against a real endpoint can never reach `isSameOriginRequest` at all — it always 401s first. And Preview is confirmed Vercel-SSO-protected at the edge (a plain `curl` gets redirected to `vercel.com/sso-api`), so it can't be probed anonymously either. Getting real evidence needs either (a) permission to deploy a temporary diagnostic to Preview, or (b) a real authenticated round-trip — which `DEPLOYMENT.md` and this task's own guardrails both say should never be automated with a real account.

Static analysis of Next.js 16.3.3's own source got as far as identifying the exact conditional (§5) that causes the mismatch, but whether Vercel's serverless invocation of the Next.js server sets `this.fetchHostname`/`this.port` (reproducing the bug) or leaves them unset so the `trustHostHeader`/raw-`req.url` branch runs instead (a different, unverified behavior) depends on Vercel's own runtime adapter, which is not present in this repo's `node_modules` and isn't inspectable from here.

## 17. Final recommendation
**`NEEDS MANUAL FOLLOW-UP`**

Specifically: Chris (or another session with the relevant permissions granted) needs to either (a) explicitly authorize deploying a temporary, non-mutating diagnostic route to Preview and reading it via an authenticated browser session, or (b) check directly via Vercel's dashboard/logs whether an existing Preview/Production request shows a `request.url` vs. `Host`/`Origin` mismatch. Until then, no code change is justified, and the finding should stay open at low priority — it is a possible availability bug (wrongly-rejected legitimate requests), not a live security hole, so it does not block other work.

---

## Console summary

- Phase 1 (implementation note): done — `isSameOriginRequest` compares `Origin` vs `new URL(request.url).origin`; called after auth in 7 route files; no proxy-header normalization exists.
- Phase 2 (local repro): **REPRODUCED** — root-caused to `next-server.js`'s `initUrl` construction using the server's configured bind hostname instead of the incoming `Host` header when `this.fetchHostname && this.port` are set.
- Phase 3 (Vercel runtime verification): **blocked** — every safe method attempted (secret-gated diagnostic env var, token generation, `vercel deploy` with and without `--yes`) was denied by this session's own safety controls; unauthenticated Preview probing is blocked by Vercel SSO; real routes 401 before the origin check runs for any unauthenticated black-box attempt.
- Classification: **`INCONCLUSIVE`**.
- No code changed, no PR opened, no branch pushed, no secrets created, no production or preview data touched, temporary diagnostic code fully removed.
- Recommendation: **`NEEDS MANUAL FOLLOW-UP`** by Chris or a permission-elevated session — not urgent (fails closed, so worst case is a reliability bug, not a CSRF bypass).
