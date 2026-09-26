# M4 creator-validation readiness — 2026-09-26

Purpose: give Chris one place to see what M4 needs, which parts are engineering
(done or not needed), and which parts only Chris can decide or perform. This
document decides nothing. It does not authorize any external contact,
deployment, or access change.

`ROADMAP.md` M4 = (1) product shown to ≥5 real Indonesian creators with
feedback logged in `DAILY_LOG.md`; (2) a proceed / iterate / pivot decision,
which requires Chris's approval. Current metrics (`STATE.md`): users_shown 0,
feedback_logged 0, wtp_signals 0.

## 1. Dependency map

| M4 requirement | Engineering status | Blocked on |
|---|---|---|
| Creators can actually reach and sign in to a running build | Code complete (Auth.js + Google OAuth; owner surfaces need sign-in) | **Chris**: which environment (Production vs. Preview) and whether OAuth stays in Testing (see §3) |
| Recipient share link works for a creator's client | Code complete, verified on protected Preview | **Chris**: public/non-SSO access decision (`DEPLOYMENT.md` "Public / non-SSO recipient access — decision brief") |
| Behaviour shown is ratified | Three provisional constants exist (§2) | **Chris**: confirm or change |
| Recruit ≥5 creators | None (non-code) | **Chris**: external contact is an approval gate (`BACKLOG.md`) |
| Feedback logged | Template in §4 | Real sessions |
| Proceed / iterate / pivot | None | **Chris** |

Executable engineering for M4 is exhausted: nothing else in the repo's roadmap
is specified and unblocked. Extra product features before feedback would be
invented scope.

## 2. The three provisional decisions — verified against code (not changed)

| Decision | Value in code | Where | What creators would see |
|---|---|---|---|
| Due-soon window | 7 days (`DUE_SOON_WINDOW_DAYS`) | `src/lib/invoice-date-status.ts` | Invoices due in 0–7 days (Jakarta calendar) appear in Beranda's follow-up queue as "due soon"; day 8 does not. Overdue always appears. |
| Share-link lifetime | 90 days from create **or regenerate** (`DEFAULT_SHARE_LIFETIME_DAYS`) | `src/lib/invoice-share.ts` | A link sent to a client stops working (uniform 404) 90 days after creation; regenerating resets the clock. |
| Income basis | `Invoice.createdAt` in Asia/Jakarta; all non-DRAFT statuses | `src/lib/income-summary.ts` | Beranda card headed **"Ditagihkan bulan ini"** / "Invoiced this month" (was "Net bulan ini" / "Net this month") = invoices created this month, paid or not; the figure is net of estimated PPh. Wording only was changed; the calculation is unchanged. |

**Discrepancy found (documentation vs. code), reported, not resolved:**
`ROADMAP.md` M3 and `STATE.md` call the income basis "issue-date". There is no
issue-date field in `prisma/schema.prisma`; the basis is the invoice record's
creation timestamp. In practice:

- An invoice created Aug 31 and sent or paid in September stays in **August**.
- Unpaid `SENT`/`DUE`/`OVERDUE` invoices count toward "income" the same as `PAID`.
- Before the relabel, the card was headed "Net bulan ini" and the docs called it
  "income", which a creator could read as *money received*. It is now headed
  "Ditagihkan bulan ini" (*invoiced this month*). The heading does not say the
  figure is net of estimated PPh; whether creators notice or care is a question
  for the sessions (§5, task 5).

Options for Chris: (a) keep as "invoiced this month" — the relabel is now in
place, the basis itself still awaits ratification; (b) count only `PAID` and add a paid-date basis (needs a
schema field — `updatedAt` is not a reliable paid date); (c) add an explicit
issue date. Each changes what M4 creators react to, which is why this should be
settled first. PPh values remain estimates; do not let feedback turn this into a
tax feature (`docs/PROJECT-PLAN-2026-09-22.md` P4).

What the readiness PR (#13) did: added "Provisional" comments at the share-lifetime and
income-basis constants (the due-soon constant already had one), and pinned the
current income behaviour in `src/lib/income-summary.test.ts`. That file's
existing test named "…excluding drafts" actually asserted a month-boundary
result and never tested draft exclusion; it is now split into an honestly named
boundary test plus real tests for draft exclusion, status-independence, and
creation-month stability. These tests describe present behaviour; they are not
a ratification.

## 3. Production / access decision packet (nothing changed)

**Decision required.** (1) Is Production's reachability without a Vercel SSO
gate intended? (2) Which environment do M4 creators use? (3) Is recipient
(non-SSO) access to `/i/[token]` wanted?

**Current verified behaviour.** Last verified 2026-09-06 by unauthenticated
`curl` (`DEPLOYMENT.md` "Current verified state"): Production
(`dibayar.vercel.app`) returns the app's own Auth.js redirect, not a Vercel SSO
wall. Not re-checked this session (no Production access was made).
`PRODUCTION_READY` is unmarked pending Chris.

**Option A — treat Production as the M4 environment (open edge).** Creators sign
in with Google directly; recipient links work without SSO.
Implications: `DEPLOYMENT.md`'s setup steps keep the Google OAuth consent screen in
**Testing**; if it still is, each creator's Google account must be added as a test user
(or the app published) in Google Cloud Console — Chris-only; the current
consent-screen state was not verified this session. The distributed rate limiter
becomes a prerequisite before public/non-SSO recipient access
(`SECURITY.md` trigger; in-memory limiters are per instance). P1-1/P1-2
(live cookie/header checks) should be run first.

**Option B — keep Vercel SSO on; run M4 as moderated sessions.** Chris (or a
Vercel-authenticated person) drives or screen-shares a protected Preview with
fixture/demo data. No public exposure, no limiter prerequisite; recipient-link
flow can only be demonstrated, not experienced by a real client.

**Code/config that would change:** Option B (moderated protected Preview) needs
no repo code/config change and no public-access change. Option A needs a
Vercel/Google console change **and** — before public/non-SSO recipient access —
a distributed rate limiter, which is a repo code change that does not exist yet
(the in-memory limiter is per instance and insufficient for that mode; see
`SECURITY.md`). Not implemented here, and this section is not a Production
authorization. Rollback per `DEPLOYMENT.md` brief §6.

**Recommendation:** none. Existing docs establish no default; the deciding
factor is how much of the recipient-link experience M4 needs to test.

## 4. Feedback log template (paste into `DAILY_LOG.md`, one per creator)

```
### M4 feedback — Creator N of ≥5 — YYYY-MM-DD
- Creator: <handle or anonymised ID> · approx. followers band · niche
- How shown: <moderated demo | self-serve> · environment · build commit
- Provisional values active during session: due-soon 7d · share 90d · monthly-summary basis createdAt (or as changed)
- Task 1 — capture a real/typical deal: <completed? confusion?>
- Task 2 — create and read an invoice (PPh choice): <…>
- Task 3 — chase a payment via WhatsApp link: <…>
- Task 4 — read the monthly summary ("Ditagihkan bulan ini"): <did they read it as invoiced or received? did they notice it is net of PPh?>
- Verbatim quotes (Bahasa Indonesia as spoken): <…>
- Would they use it for their next deal? <yes/no/why>
- Willingness to pay signal (M5 evidence, do not solicit payment): <stated / shown / none>
- Bugs or blockers observed: <…>
- Feature requests (unprioritised, not commitments): <…>
```

After each session update `STATE.md` `users_shown` / `feedback_logged` /
`wtp_signals` only from what actually happened.

## 5. Moderator checklist — moderated Preview sessions

First-round M4 mode: **moderated Preview sessions** (Option B). Nothing here
authorizes contacting anyone or changing Production/public access. One session
per creator; the outcome goes into the §4 template, which stays the only
feedback format. Track recruiting in `M4-SESSION-TRACKER.md`.

**Before the session (moderator)**
- [ ] Preview build contains commit `_______` and shows "Ditagihkan bulan ini" on Beranda.
- [ ] Preview is the protected, non-Production one on its own database (`DEPLOYMENT.md` "Preview policy": no real customer or financial data). Confirm with Chris that a moderated screen-share is within that policy.
- [ ] Demo/typical deal data only. Creators are not asked to enter real brands, contacts, or amounts.
- [ ] Moderator, not the creator, signs in (Vercel SSO stays on).
- [ ] Provisional values noted as active: due-soon 7d · share 90d · summary basis `createdAt`.

**During the session — tasks (same order as §4)**
1. Capture a real or typical deal (demo data).
2. Create/read an invoice, including the PPh choice.
3. Chase a payment via the WhatsApp link.
4. Read the monthly summary.
5. Ask: how do you read "Ditagihkan bulan ini" / "Invoiced this month"?
6. Ask: would you use Dibayar for your next deal?
7. Note any willingness-to-pay signal. Do not solicit payment.

**Record for each session**
- [ ] Session date · Preview build/commit
- [ ] Creator anonymized ID · niche · follower band · session mode
- [ ] Provisional values active during the session
- [ ] Task completion (1–4) · confusion/friction
- [ ] Bugs/blockers
- [ ] Willingness-to-pay signal (stated / shown / none)

**After the session**
- [ ] §4 feedback entry pasted into `DAILY_LOG.md`.
- [ ] Tracker row updated (Session status, Feedback logged?, WTP signal?).
- [ ] `STATE.md` `users_shown` / `feedback_logged` / `wtp_signals` updated only from what actually happened.
- [ ] Session complete.

## 6. Status vocabulary

- DONE — engineering readiness above (PR #13, merged; `86eff1d`).
- IN PR — "Ditagihkan bulan ini" relabel, §3 correction, §5 checklist and tracker.
- WAITING FOR SCHEDULE — P2-2, one more consecutive scheduled success.
- WAITING FOR PRODUCT DECISION — §2: 7-day due-soon window, 90-day share lifetime, and ratification of the `createdAt` summary basis (the wording is already changed).
- WAITING FOR PRODUCTION AUTHORIZATION — §3; also P1-1/P1-2 live verification.
- NON-CODE — recruiting and running creator sessions.
