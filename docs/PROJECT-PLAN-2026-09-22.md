# Dibayar — next-steps plan

**Prepared:** 2026-09-22
**Basis:** `codex/e2e-improvement-plan` @ `2e9ab13`, `main` @ `66fb523`
**Status:** proposed; planning only. Authorizes no deployment, no production data
access, no dependency upgrade, and no public-access change.

Every claim in §1 was verified in-session on 2026-09-21/22 by running the command
or reading the artifact named next to it. Anything not verified is labelled as
such. Where this document and `STATE.md` disagree, `STATE.md` is the stale one
(see P0-2).

---

## 1. Where the project actually stands

### Verified today

| Fact | How it was verified |
| --- | --- |
| PR #8 CI fully green | run `35609851823`, all 5 jobs (`lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` success; `e2e-cross-browser` skipped by design) |
| PR #8 `MERGEABLE` / `CLEAN` @ `2e9ab13` | `gh pr view 8` |
| 9/9 `@visual` tests pass on the runner | `ux-audit` job log, incl. `[chromium-mobile-visual] › Beranda true mobile` |
| Visual baselines match the runner byte-for-byte | `update-visual-baselines.yml` run `35608933054`; 8/9 files byte-identical to committed, 9th replaced |
| Unit suite: 79 files / 767 tests pass | `npm test` |
| Lint 262 files, 0 errors; typecheck exit 0 | `npm run lint`, `npm run typecheck` |
| Canonical Turbopack build passes | `npm run build` exit 0, and again under `env -i` (no env vars) |
| **`npm audit --omit=dev` → 0 vulnerabilities** | run 2026-09-22; registry DNS is reachable again |
| No scheduled CI run has ever fired | `gh run list --event=schedule` returns empty |
| `main`'s workflow has no `schedule:`/`workflow_dispatch:` trigger | `git show origin/main:.github/workflows/e2e.yml` |

### Not verified, do not assume

- Live Preview/Production behaviour. Nothing in this session touched a
  deployment. `DEPLOYMENT.md` "Current verified state" (2026-09-06) remains the
  authority, and it is over two weeks old.
- Whether Production's no-SSO edge reachability is still true today.
- Dependabot alert closure on GitHub (local `npm audit` clean ≠ alerts closed).

---

## 2. The sequencing fact that drives this plan

**GitHub Actions runs `schedule:` triggers only from the default branch.**

PR #8 is what adds `schedule:`, `workflow_dispatch:`, and the `e2e-cross-browser`
job to the workflow. `main` has none of them. So:

- the nightly/weekday cross-browser tier stays permanently dormant until #8 merges;
- `E2E-IMPROVEMENT-PLAN.md` §B3's acceptance ("Firefox and WebKit complete on two
  consecutive scheduled runs") **cannot be met before the merge**;
- but `workflow_dispatch` works on the branch *now*, so a first manual Firefox/WebKit
  datapoint can be gathered before merging — worth doing, because it is the
  cheapest way to find out whether those browsers pass at all before committing
  to a recurring signal.

Merging #8 is therefore the highest-leverage single action available.

---

## 3. Workstreams, prioritised

### P0 — Unblock (do first, small, high leverage)

**P0-1. Merge PR #8.**
Green, clean, reviewed in-session. Blocked only by the harness's
"Merge Without Review" gate, which needs Chris's permission or a manual merge.
Repo convention is a merge commit (`gh pr merge 8 --merge`), matching PRs #3–#7.
*Acceptance:* `main` contains `2e9ab13`; the post-merge `push` CI run on `main`
is green.

**P0-2. Reconcile `STATE.md`.**
It currently says `active_branch: main (HEAD 3473194)` and carries a
2026-09-20 build status. It does not mention the E2E hardening work, PR #8, or
the visual-baseline correction. `STATE.md` is declared the single source of truth
and is read first every run, so a stale one actively misleads the next session.
Respect its rules: 120-line hard cap, last-3-days decisions only, overflow to
`DAILY_LOG.md`.
*Acceptance:* `STATE.md` names the merged commit, the current gate results, and
the real open blockers; still ≤120 lines.

**P0-3. Record the dependency-audit result.**
`npm audit --omit=dev` now returns **0 vulnerabilities** — the check `STATE.md`
lists as unverifiable due to DNS. This closes `SECURITY.md`'s
`[ ] npm audit / dependency check run weekly` for this cycle, and is one of
`STATE.md`'s own `next_3_tasks`.
*Acceptance:* `SECURITY.md` line flipped with the date and the exact command;
Dependabot alert closure tracked separately as still-unconfirmed.

### P1 — Close the security baseline (this is what gates "MVP done")

`ROADMAP.md` defines MVP DoD as **M0–M4 complete + every `SECURITY.md` control
`[x]`**. Four controls are `[~]` and two are `[ ]`. Three of them are cheap and
are the real remaining engineering work; the rest are decisions.

**P1-1. Secure session cookies — `[~]` → `[x]`.**
Auth.js database-session defaults are configured but live cookie inspection was
never done. Needs one authenticated request against a deployed environment,
asserting `httpOnly`, `secure`, `sameSite` on `authjs.session-token`.
*Blocked on:* a live environment + Chris (see §4).

**P1-2. Security headers — `[~]` → `[x]`.**
CSP/X-Frame-Options/HSTS verified locally; Vercel edge behaviour never checked.
An unauthenticated `curl -I` against the deployed origin settles it.
*Blocked on:* same as P1-1. Note these two share one verification trip — do them
together.

**P1-3. MFA design doc — `[ ]`.**
Explicitly post-MVP implementation, but the *design* is a checklist item and is
writeable now with no code and no deployment. Cheapest remaining `[ ]` to close.
*Acceptance:* a short TOTP-vs-passkeys design note with a recommendation and an
explicit "not implemented in MVP" statement.

**P1-4. Personal-data minimisation — `[~]`.**
The 2026-07-19 census flagged two fields and deleted neither: `Deal.contactWa`
(now actually used by M3 WhatsApp follow-up — the flag is stale) and `User.image`
(still unused by any invoicing UI). Re-run the disposition on those two only.
*Acceptance:* each flagged field either removed or documented as deliberately
retained with a reason.

### P2 — Finish the E2E programme's unmet acceptance criteria

PR #8 delivered most of `E2E-IMPROVEMENT-PLAN.md` workstreams A–E. These specific
acceptance criteria are still unmet:

**P2-1. Workstream D has no negative control.**
D's acceptance is *"a deliberate unhandled page error and a deliberate API 500
each fail a harness verification test with actionable output."* The
`browserDiagnostics` fixture (`e2e/support/test.ts`) is wired in everywhere but
nothing proves it actually fails a test. This is the same gap the UX-audit
harness already solved for itself —
`tests/ux-audit/synthetic/detectors.negative-control.spec.ts` and
`detectors.selftest.spec.ts` are the precedent to copy, using `page.setContent`
so no application code is involved.
*Why it matters:* an error-detection fixture that silently stops working is worse
than none — it converts "no errors detected" into false assurance.
*Acceptance:* a synthetic spec proving a `pageerror` and a 5xx each fail.

**P2-2. Cross-browser tier has never executed (B3).**
See §2. Do a manual `workflow_dispatch` run on the branch first to learn whether
Firefox/WebKit pass at all, then let the schedule take over post-merge.
*Acceptance:* two consecutive scheduled runs complete with artifacts retained,
plus a written escalation rule (product defect blocks; runner/browser install
failure is an infrastructure finding).

**P2-3. Two empirical timeouts remain (A2).**
`e2e/deals/add-deal-dialog.spec.ts:120` (`waitForTimeout(750)`) and
`e2e/deals/filter-navigation.spec.ts:136` (`waitForTimeout(300)`). A2 asks for a
semantic condition instead. These are latent flake sources on a slower runner.
*Acceptance:* both replaced with a semantic wait, or each documented with why no
semantic condition exists.

**P2-4. Residual journey gaps from C1–C3.**
Deliberately deferred by #8, listed here so they are not silently lost:
recipient-side view of a *revoked* token after reload; long issuer/brand text at
390px; blocked-popup/manual-link WhatsApp fallback; stage-history entry
assertions; server-validation and ownership-denial journeys.
*Acceptance:* each either implemented or explicitly retired in
`E2E-IMPROVEMENT-PLAN.md` with a reason.

### P3 — Product decisions that need a human (see §4)

These are not engineering tasks. They are listed because they block M4 and the
MVP gate, and because three of them are currently shipping as *provisional
constants in production code*, which is the part worth surfacing:

- 7-day due-soon window
- 90-day share-link lifetime
- invoice-issue-date income basis

Each is a real product judgement encoded as a magic number. They should either be
confirmed or changed before creators are shown the product in M4 — otherwise M4
feedback is gathered against behaviour nobody has ratified.

### P4 — Deferred, with explicit trigger conditions (do not do now)

- **Distributed rate limiter.** `SECURITY.md` already defines the exact trigger:
  required before (1) public/non-SSO recipient access is enabled, **or**
  (2) traffic spans multiple instances. Neither holds. If P3's Production access
  decision goes "public", this becomes a prerequisite, not a follow-up.
- **Deal deletion when invoices exist.** Deferred per `STATE.md`.
- **Recipient-locale invoices/PDF/WhatsApp.** `BACKLOG.md`, explicitly unscheduled.
- **PPh as real tax calculation.** Out of scope; values are estimates and are
  labelled as such. Do not let M4 feedback quietly turn this into a tax feature.

---

## 4. What needs Chris (hand this list over)

1. **Merge permission for PR #8** (or merge it directly). Everything in P0/P2-2
   sequences behind it.
2. **Production edge/public-access intent.** Production is reachable without an
   SSO gate and this was never a deliberate launch decision. Until it is settled,
   `PRODUCTION_READY` stays unmarked and the distributed rate limiter stays
   deferred — the two are coupled.
3. **A live-environment verification window** for P1-1 and P1-2 (one trip covers
   both). Requires either granted permission or Chris running the checks.
4. **The three provisional constants** in P3.
5. **M4 creator validation** — ≥5 Indonesian creators, feedback in `DAILY_LOG.md`.
   External contact is a Chris-approval gate per `BACKLOG.md`. This is the single
   largest remaining item on the roadmap and the only one that cannot be
   accelerated by engineering.

---

## 5. Suggested order

```
P0-1 merge #8
  ├─> P0-2 reconcile STATE.md          (immediately after; cheap)
  ├─> P0-3 record npm audit result     (independent; do anytime)
  └─> P2-2 cross-browser schedule activates
          └─> two scheduled runs -> B3 acceptance

parallel, no dependency on the merge:
  P1-3 MFA design note       (pure docs)
  P1-4 two-field data review (pure docs)
  P2-1 diagnostics negative control  <- highest engineering value here
  P2-3 empirical timeouts

gated on Chris:
  P1-1 + P1-2 (one live verification trip)
  P3 constants -> then M4
```

**If only one engineering item gets done: P2-1.** A silently-broken error
detector is the failure mode that makes every other green check less meaningful.

**If only one project item gets done: P0-1**, because it is the gate on the
recurring signal and costs a single command.

---

## 6. Guardrails carried forward

Unchanged from `E2E-IMPROVEMENT-PLAN.md` §3 and `CLAUDE.md`:

- Disposable `127.0.0.1:55432/dibayar_test` only; keep `E2E_FIXTURE_CONFIRM=non-production`.
- No production auth bypass; Google sign-in stays a manual check.
- Never regenerate a visual baseline to make CI green — inspect expected/actual/diff
  on the runner first. A changed image *height* is never rendering drift.
- No product-behaviour changes inside a test-infrastructure task.
- Tests accompany behavioural changes; run the gates before claiming done.
- No deployment, production migration, or public-access change without explicit scope.
