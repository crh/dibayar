# Dibayar Same-Origin Vercel Runtime Verification — Receipt

## 1. Starting state

- Starting branch: `main`
- Starting SHA: `282dcdeb5fd1f7d6ccce03b9710a3a83b157f3a8` (merge of PR #6)
- `origin/main` SHA: `282dcdeb5fd1f7d6ccce03b9710a3a83b157f3a8` (matched)
- Working-tree status at session start: clean except pre-existing untracked
  receipt/brief files from prior sessions (`docs/receipts/archive/DIBAYAR-MOBILE-POLISH-BATCH-RECEIPT.md`,
  `DIBAYAR-SAME-ORIGIN-VERIFICATION-RECEIPT.md`, `DIBAYAR-UX-AUDIT-STABILIZATION-MERGE-RECEIPT.md`,
  `docs/receipts/archive/DIBAYAR-UX-NEXT-BATCH-RECEIPT.md`, `docs/receipts/DIBAYAR-UX-NEXT-CLAUDE-DESIGN-BRIEF.md`) — none altered.
- Confirmed the prior diagnostic route (`src/app/api/diag-origin-probe-9f31/`) was absent, and no
  verification branch (`security/verify-same-origin-runtime`) remained.

## 2. Diagnostic implementation

- Temporary route: `src/app/api/diag-origin-runtime-51619aa2/route.ts` (random suffix, disposable path).
- GET-only handler. Fields returned:
  - `requestUrl` = `request.url`
  - `requestUrlOrigin` = `new URL(request.url).origin` (or `null` if unparseable)
  - `originHeader` = incoming `Origin`
  - `hostHeader` = incoming `Host`
  - `forwardedHostHeader` = incoming `X-Forwarded-Host`
  - `forwardedProtoHeader` = incoming `X-Forwarded-Proto`
  - `vercelUrl` = `process.env.VERCEL_URL` (non-secret Vercel-provided hostname metadata)
- Confirmed read-only: no database import, no `auth()` call, no session access, no writes.
- Confirmed no secrets/cookies/auth headers/user data returned — only the header/URL fields listed above,
  `Cache-Control: no-store` set on the response.
- Carries the required comment: `TEMPORARY READ-ONLY DIAGNOSTIC FOR SAME-ORIGIN RUNTIME VERIFICATION. REMOVE AFTER TEST.`

## 3. Local validation

Commands run (with the diagnostic route present, from a clean `.next`):

```bash
npm run typecheck   # PASS (after rm -rf .next — a stale generated
                     #   .next/types/validator.ts referenced the prior,
                     #   already-deleted diagnostic route from the earlier
                     #   session and failed until the cache was cleared)
npm run lint         # PASS, exit 0
npm run build        # PASS — production build succeeded; route listed as
                     #   ƒ /api/diag-origin-runtime-51619aa2 in the build output
```

The already-proven local `localhost` vs `127.0.0.1` mismatch (documented in
`DIBAYAR-SAME-ORIGIN-VERIFICATION-RECEIPT.md` §5) was not re-run — the task
explicitly said not to spend time re-investigating it, and nothing about
this session's evidence calls it into question.

No production `isSameOriginRequest` source was modified.

## 4. Vercel Preview deployment

- Used the repository's normal Preview workflow (git-linked auto-deploy), not `vercel deploy`/`vercel env add` —
  the previous session's receipt records those specific CLI actions being denied three separate ways
  (secret-store write, credential materialization, blind-apply/security-weaken). This session's action was a
  plain `git push` of a new branch, matching how every prior Preview deployment in `DEPLOYMENT.md`'s history
  was actually triggered.
- Branch: `diag/same-origin-runtime-verify`, commit `1f5463aeedb4a266f77461412ce33f40e56a16a3`, containing only
  the one new diagnostic file. Pushed to `origin`, **never merged**, deleted after this session (see §9).
- Preview deployment created: `dpl_4vSyeEjA8wqAQbr548Ft2MBdvBWQ` /
  `https://dibayar-pn0vmr4nw-kenji-iwakura.vercel.app` (alias
  `https://dibayar-git-diag-same-origin-runtime-verify-kenji-iwakura.vercel.app`), `target: preview`.
- Confirmed Preview only: `vercel ls` showed `target Preview`; no Production alias or Production target was
  touched. No Vercel project setting, environment variable, domain, or protection setting was changed.
- Preview protection status: not reached — see §5. (Every other live Preview URL checked in the earlier receipt
  was confirmed Vercel-SSO-protected; nothing in this session weakened that.)

## 5. Runtime evidence

**None obtained — the deployment never reached `READY`.**

`vercel inspect dpl_4vSyeEjA8wqAQbr548Ft2MBdvBWQ --json` shows the *build* itself completed successfully
(`builds[0].readyState: "READY"`), but the deployment's own top-level `readyState` is `"ERROR"`. `vercel logs`
and `vercel inspect --logs` (tried against both the URL and the deployment ID) both refuse to return anything,
since the CLI's log retrieval requires a deployment that reached `READY`:

```
Error: Logs are unavailable because deployment dpl_4vSyeEjA8wqAQbr548Ft2MBdvBWQ never reached READY and ended in ERROR.
```

**This is not caused by the diagnostic route.** For comparison, an unrelated, already-merged branch's own
Preview deployment from ~9 hours earlier (`ux-mobile-polish-fab-stage-filter`, the branch behind PR #6, which
is already merged into `main` at this session's starting SHA) shows the exact same shape —
`dpl_Bm1w3bcN3LC2vUuYmCKQevzBdvwU`, build `readyState: "READY"`, deployment `readyState: "ERROR"`. Two other
Preview deployments in the same `vercel ls` window (also ~9h old, unrelated branches) show the identical
pattern. This indicates a **pre-existing, branch-independent Vercel Preview pipeline issue** in this project —
builds are succeeding but deployments are failing to finalize — that predates and is unrelated to this
session's diagnostic code. Root-causing *that* issue is outside this task's scope (no CLI-level build/deploy
log detail was retrievable at all; only the Vercel dashboard would show it), and fixing Vercel project
configuration is exactly the kind of change this task's guardrails say not to make unilaterally.

Because the deployment never went `Ready`, it never served any traffic, so:

- no hostname could be tested through it;
- no browser/SSO round-trip was attempted (there was nothing live to visit);
- the "existing Preview alias" and "canonical Preview hostname" test matrix from Phase 4 could not be executed.

| External URL / Hostname | `request.url` origin | `Host` | `X-Forwarded-Host` | `Origin` | Result |
|---|---|---|---|---|---|
| `https://dibayar-pn0vmr4nw-kenji-iwakura.vercel.app` | — | — | — | — | Deployment never reached `Ready`; endpoint never served a response |
| `https://dibayar-git-diag-same-origin-runtime-verify-kenji-iwakura.vercel.app` (alias) | — | — | — | — | Same deployment, same result |

## 6. Final classification

**`STILL_INCONCLUSIVE`**

## 7. Security interpretation

No new security interpretation is possible from this session's evidence — no Vercel runtime response was ever
obtained. The only standing finding remains the local one from the prior receipt: a fail-closed
availability/reliability issue (legitimate same-origin requests could be wrongly rejected under certain
hostname-binding configurations), not a CSRF bypass, and that finding is scoped to `next start`-style
self-hosted binding, not confirmed for Vercel's actual serverless runtime either way.

## 8. Remediation decision

**`NEEDS_MANUAL_FOLLOW_UP`**

## 9. Cleanup

- Temporary route removed: `rm` via branch deletion — confirmed absent from `main` (`find src/app/api -iname
  "*diag*"` returns nothing on `main`).
- Temporary branch status: deleted both locally (`git branch -D diag/same-origin-runtime-verify`) and on
  `origin` (`git push origin --delete diag/same-origin-runtime-verify`). No trace remains except this receipt
  and the (now-orphaned, GC-eligible) commit `1f5463a`.
- Temporary deployment status: `dpl_4vSyeEjA8wqAQbr548Ft2MBdvBWQ` is inert — it never reached `Ready` and never
  served traffic, so there is nothing live to tear down. No `vercel remove`/deletion command was run against it
  (that class of mutating Vercel CLI action was exactly what the prior session had denied for other reasons);
  Chris can remove the dead deployment record from the Vercel dashboard at his convenience, but it poses no
  exposure as-is.
- No persistent diagnostic code remains on `main` (confirmed in §11).

## 10. Data-safety confirmation

- No Production user data mutated: confirmed — Production was never contacted this session (no curl, no
  deploy, no alias change).
- No real mutating request was required or made against any environment.
- No Production deployment occurred: only one Preview-target deployment was created (`target: preview` per
  `vercel ls`), and it never went live.
- No security control was disabled: no Vercel SSO/protection setting, no `isSameOriginRequest` change, no
  `next.config.ts`/CSP change. No secret, token, or environment variable was created or modified.

## 11. Git status at completion

```
$ git status --short
?? docs/receipts/archive/DIBAYAR-MOBILE-POLISH-BATCH-RECEIPT.md
?? DIBAYAR-SAME-ORIGIN-VERCEL-VERIFICATION-RECEIPT.md
?? DIBAYAR-SAME-ORIGIN-VERIFICATION-RECEIPT.md
?? DIBAYAR-UX-AUDIT-STABILIZATION-MERGE-RECEIPT.md
?? docs/receipts/archive/DIBAYAR-UX-NEXT-BATCH-RECEIPT.md
?? DIBAYAR-UX-NEXT-CLAUDE-DESIGN-BRIEF.md

$ git branch --show-current
main

$ git rev-parse HEAD
282dcdeb5fd1f7d6ccce03b9710a3a83b157f3a8
```

(Matches the starting SHA exactly — no commits were added to `main`; the diagnostic commit lived only on the
now-deleted `diag/same-origin-runtime-verify` branch.)

## 12. Recommended next action

Two independent things need Chris's attention, and they should be tracked separately:

1. **Blocking this specific verification:** the project's Vercel Preview pipeline is currently producing
   `READY` builds that then finalize as `ERROR` deployments, for at least four recent branches including the
   already-merged PR #6 — this needs to be looked at directly in the Vercel dashboard (build/deployment logs
   aren't retrievable via CLI once a deployment is in this state) before *any* future Preview-based
   verification, including this same-origin one, can produce runtime evidence.
2. **The original open question:** once Preview deployments are healthy again, re-create a diagnostic route
   from this receipt's §2 spec, push it as a throwaway branch, and — through an authenticated Vercel SSO
   browser session — hit it to capture the `request.url` vs. `Host`/`Origin` table from §5. Until then, the
   same-origin finding stays at `NEEDS_MANUAL_FOLLOW_UP`, unchanged from the prior receipt, and remains
   low-priority (fails closed; worst case is a reliability bug, not a security hole).
