# M4 creator-validation readiness — updated 2026-09-30

Purpose: one place for what M4 needs, what engineering has prepared, and what
only Chris can do. This document does not authorize external contact,
Production changes, or public access.

`ROADMAP.md` M4 = (1) product shown to ≥5 real Indonesian creators with
feedback logged in `DAILY_LOG.md`; (2) a proceed / iterate / pivot decision,
which requires Chris's approval. Counters live in `STATE.md` (`users_shown`,
`feedback_logged`, `wtp_signals`).

## 1. Environment and mode

- **M4 environment:** staging, `https://dibayar-git-staging-kenji-iwakura.vercel.app`
  (Vercel Preview of the long-lived `staging` branch, Deployment Protection/SSO
  on, own Neon `staging` database, Google OAuth working). This replaces the
  PR #14 Preview used as a pre-staging stopgap.
- **Session mode (first round):** moderated. The moderator signs in and drives
  the browser; the creator watches by screen-share or in person. No creator gets
  a URL, login, or infrastructure credential. Synthetic demo data only. No
  recording without the participant's explicit consent. Allowed by
  `DEPLOYMENT.md` "Preview and staging policy".
- **Not in scope:** Production or public/non-SSO access (§5), self-serve creator
  sign-up, and real recipient (brand) access to share links. The share-link
  flow can be demonstrated but not experienced by a real client.

| M4 requirement | Status |
|---|---|
| Running build creators can see | READY — staging, moderated |
| Synthetic demo workspace | READY — `npm run m4:demo-data` (§3) |
| Hypotheses under test | Noted, unchanged (§2) |
| Creator can choose PPh 21/23 on an invoice | **GAP** — no UI control; API supports it. Demonstrated with seeded invoices. Build or not: **Chris** |
| Recruit ≥5 creators | **Chris** — external contact is an approval gate |
| Sessions + feedback logged | Not started — tracker `M4-SESSION-TRACKER.md` |
| Proceed / iterate / pivot | **Chris**, after sessions |

## 2. Hypotheses under test (current behaviour, not decisions)

Keep these fixed across Creator 01–05. If one changes between sessions, record
the boundary (date, build SHA, old → new) in `DAILY_LOG.md` and in the tracker
note of the first session that uses the new value.

| Hypothesis | Value in code | Where | What the creator sees |
|---|---|---|---|
| Due-soon window | 7 days (`DUE_SOON_WINDOW_DAYS`) | `src/lib/invoice-date-status.ts` | Invoices due in 0–7 Jakarta calendar days appear in Beranda's follow-up queue; overdue always appears. |
| Share-link lifetime | 90 days from create or regenerate (`DEFAULT_SHARE_LIFETIME_DAYS`) | `src/lib/invoice-share.ts` | Link stops working (uniform 404) after 90 days; regenerating resets it. |
| Monthly summary basis | `Invoice.createdAt`, Asia/Jakarta month, all non-DRAFT statuses (paid or unpaid), subtotal minus estimated PPh | `src/lib/income-summary.ts` | Beranda card **"Net ditagihkan bulan ini"** / "Net invoiced this month". |

Facts about the summary a moderator must not "explain away" during a session:
an invoice created Aug 31 and paid in September stays in August; unpaid
SENT/DUE/OVERDUE count the same as PAID; the figure is net of *estimated* PPh
(PPh 21 5%, PPh 23 2%). There is no issue-date field (older docs said
"issue-date"). The card has no helper text on purpose: whether creators read it
as invoiced or received, and whether they notice it is net of PPh, is what the
sessions ask. Alternatives if it fails (Chris decides after evidence): count
only PAID with a new paid-date field, or add an explicit issue date. Do not let
feedback turn PPh into a tax-filing feature.

## 3. Demo data (synthetic, staging only)

`scripts/m4-demo-data.ts` (dataset in `src/lib/m4-demo-dataset.ts`, unit-tested)
builds the moderator's staging workspace through the app's own
deal/invoice/settings functions. It refuses any database other than the Neon
`staging` endpoint (`ep-gentle-morning-aofsje23`) and requires
`M4_DEMO_CONFIRM=staging`. It never prints the connection string or email.

| Deal (fictional) | Stage | Invoice | Demonstrates |
|---|---|---|---|
| Kopi Lereng Merapi | Nego | — | active negotiation, notes |
| Serum Daun Kelor | Konten (deadline +5d) | DRAFT, no PPh | deliverables in progress; draft excluded from summary |
| Dompet Rapi | Invoice | SENT, PPh 23, due +3d | due-soon + WhatsApp reminder |
| Teh Tarik Nusantara | Invoice | SENT, PPh 21, due −4d (shown as Terlambat: overdue is derived from the due date) | overdue chase |
| Batik Sekar Ayu | Dibayar | PAID, no PPh | completed/paid |

Expected summary right after seeding: 3 invoices, gross Rp 8.250.000, estimated
PPh Rp 205.000, **net Rp 8.045.000**. Issuer persona "Nadia Putri (contoh)",
"Bank Contoh". Contact numbers are invented `0812000001xx` values: **show the
prefilled WhatsApp message, never press Send.** No share link is seeded (links
are encrypted with the deployment's key); the moderator creates one live.

**Re-seed before every session.** Dates are relative to the run time, and the
summary is month-based: in the dry run, a 30 Sep seed showed "Rp 0 · Oktober
2026" on 1 Oct while the overdue invoice was still unpaid.

```bash
# the moderator must have signed in to staging once with this Google account
DATABASE_URL="$(neon connection-string br-late-grass-aoea90yk --pooled)" \
M4_DEMO_CONFIRM=staging M4_DEMO_OWNER_EMAIL='<moderator staging email>' \
npm run m4:demo-data -- seed     # reset + create + verify
# also: verify (read-only checks) | reset (delete owner's deals/invoices)
```

`reset`/`seed` delete **all** of the demo owner's staging deals and invoices,
including deals created live during a session, and overwrite their staging
settings with the persona. The user, Google link, and sessions are kept. Never
point it at Production; the endpoint guard refuses anyway.

## 4. Moderator kit

### Before the session
- [ ] Staging deployment READY (`vercel ls` / dashboard) and serving the expected commit: `staging` HEAD `_______`.
- [ ] Demo data re-seeded today; `verify` reports all checks true and net Rp 8.045.000.
- [ ] Moderator signed in to staging (not the creator). Vercel SSO stays on.
- [ ] Browser window in front and visible: a minimized/fully covered Chrome window never finishes loading pages (streamed content waits for `requestAnimationFrame`), which looks like a stuck "Memuat…".
- [ ] No Production data or real brand/contact/bank/tax data on screen. Close other tabs.
- [ ] Consent: session purpose explained; recording only with explicit consent (note yes/no).
- [ ] Hypotheses active: due-soon 7d · share 90d · summary basis `createdAt` · "Net ditagihkan bulan ini" net-of-PPh wording.
- [ ] Tracker row set to `scheduled`; a blank §5 feedback entry ready.

### During the session (in order)
1. **Typical brand deal:** ask the creator about the workflow of a typical deal without requesting or recording real brand, client, contact, campaign, scope, financial, tax, or banking details. Together invent a wholly fictional example, including its brand/name, contact, scope, deliverables, dates, amounts, and terms; enter **only invented values** in staging. Do not copy identifying details from the creator's actual work.
2. **Deal status / next action:** on the Deal board, use a card's **⋮** menu (move stage / *Lihat detail*; the card itself is not a link) on *Kopi Lereng Merapi*; ask what they would do next.
3. **Invoice:** open *Serum Daun Kelor*'s draft from *Invoice*; ask what they would change before sending.
4. **PPh choice:** the app has **no PPh picker**: invoices created in the UI are always "Tidak ada" PPh (see receipt `DIBAYAR-M4-STAGING-KICKOFF-2026-09-30.md`). Show *Dompet Rapi* (PPh 23) and *Teh Tarik Nusantara* (PPh 21) and ask which option their brands use and how they would expect to set it. Do not promise the feature.
5. **WhatsApp / payment follow-up:** from Beranda's queue open *Teh Tarik Nusantara* (overdue), create the share link, open the WhatsApp reminder, and show the prefilled message. **Do not send.**
6. **Monthly summary:** ask them to read "Net ditagihkan bulan ini" aloud and say what it means.
7. Ask: is that money you have *invoiced* or money you have *received*?
8. Ask: is PPh already taken out of that number?
9. Ask: would you use Dibayar for your next deal? Why / why not?
10. Willingness to pay: note only what they say or do unprompted, or answer to "what would this be worth to you?". **Never solicit payment.**

### After the session
Record in `DAILY_LOG.md` (template §5) and the tracker:
- task completion (1–6) · friction/confusion · verbatim quotes (Bahasa as spoken)
- bugs/blockers · feature requests (unprioritised) · would-use signal · WTP signal
- build SHA · session mode · recording consent yes/no
- Then update `STATE.md` counters only from what actually happened, and `reset`
  or re-`seed` the demo data.

### Evidence discipline
- Do not prioritise feature requests after one session; only patterns across sessions count.
- Politeness ("bagus kok", "menarik") is not validation. A would-use signal needs a reason or a concrete next deal.
- Do not infer WTP. Record `stated` / `shown` / `none` only from what they said or did.
- Do not change a hypothesis between sessions without recording the boundary (§2).
- Feedback is evidence, not a roadmap commitment. Chris decides after ≥5 sessions.

## 5. Feedback log template (paste into `DAILY_LOG.md`, one per creator)

```
### M4 feedback — Creator NN of 05 — YYYY-MM-DD
- Creator: Creator NN (anonymised) · follower band · niche
- Mode: moderated screen-share | in person · staging · build <sha> · recording consent yes/no
- Hypotheses active: due-soon 7d · share 90d · summary basis createdAt · "Net ditagihkan bulan ini"
- Task 1 deal capture: <completed? friction?>
- Task 2 deal status / next action: <…>
- Task 3–4 invoice + PPh choice: <…>
- Task 5 WhatsApp follow-up: <…>
- Task 6–8 summary: read as invoiced or received? noticed net of PPh? <…>
- Verbatim quotes: <…>
- Would use for next deal: <yes/no + reason>
- WTP (do not solicit): <stated / shown / none + what exactly>
- Bugs/blockers: <…>
- Feature requests (unprioritised, not commitments): <…>
```

## 6. Production / public access (unchanged, Chris)

Still open and **not needed for moderated M4**: whether Production's
reachability without a Vercel SSO gate is intended; whether recipients get
non-SSO access to `/i/[token]` (requires a distributed rate limiter first,
`SECURITY.md`); whether the Google OAuth consent screen is published. See
`DEPLOYMENT.md` "Public / non-SSO recipient access — decision brief".
