# Dibayar — M4 staging validation kickoff (2026-09-30 → 2026-10-01)

PR: **#21** (`chore/m4-staging-kickoff-2026-09-30` → `staging`, open, not merged).

Outcome: **staging, demo data, docs, and moderator kit READY for Creator 01**,
with one product gap for Chris (no PPh picker). No creator was contacted. No
Production access. No secrets in this receipt.

## Gate
- PR #20 (`chore/staging-activation-docs-2026-09-30` → `staging`) verified **MERGED** live:
  2026-09-30T06:45:54Z by `crh`, merge commit `fb28c30`. No duplicate PR created.

## Staging
- URL: `https://dibayar-git-staging-kenji-iwakura.vercel.app` (Vercel SSO on).
- Deployment `dpl_AdRU5CvNzGzwrEPbDuihEsK8idQm`, preview, **Ready**, created 06:45:57Z,
  3 s after the PR #20 merge; `origin/staging` = `fb28c30` → build = `fb28c30`
  (by timing; Vercel creates no GitHub deployment record for this project).
- DB: Neon `staging` endpoint `ep-gentle-morning-aofsje23`; the seed script's endpoint
  guard passed on every run. Neon branches unchanged (2/10: `main`, `staging`).

## Docs reconciled (this PR)
- `docs/validation/M4-READINESS.md` rewritten: staging replaces the PR #14 Preview;
  hypotheses (7d / 90d / `createdAt` net-invoiced summary); demo data; moderator
  kit (before / during 1–10 / after); evidence discipline; feedback template.
- `docs/validation/M4-SESSION-TRACKER.md`: Creator 01–05, requested columns, no contact data.
- `DEPLOYMENT.md` "Preview and staging policy": explicit clause allowing **moderated**
  creator sessions on protected staging with synthetic data (no creator credentials/URL,
  no recording without consent; self-serve still needs Chris). Closes old §3.1 question.
  Also: Gate 5 now "live-verified 2026-09-30" (was "not yet").
- `docs/DEVELOPMENT-WORKFLOW.md`: ordinary-branch Neon suppression marked live-verified (was "target, not current").
- `ROADMAP.md` M3: summary basis corrected to `createdAt` (was "issue-date"). `STATE.md` updated.
- Historical receipts untouched.

## Demo data
- `npm run m4:demo-data -- seed|verify|reset` (`scripts/m4-demo-data.ts`; dataset +
  guard in `src/lib/m4-demo-dataset.ts`, 9 unit tests). Uses the app's own
  createDeal/updateDeal/createInvoice/updateInvoiceStatus/saveUserSettings.
  Refuses any endpoint but Neon `staging`; requires `M4_DEMO_CONFIRM=staging`;
  prints no URL/email/token. Owner = moderator's staging Google account (by email).
- A synthetic-owner variant (own login session for `demo@example.org`) was proposed
  and **blocked by the permission classifier as security-weakening**; not built.
- 5 fictional deals (Nego · Konten+DRAFT · Invoice SENT PPh23 due +3d · Invoice OVERDUE
  PPh21 due −4d · Dibayar PAID), persona "Nadia Putri (contoh)", "Bank Contoh". No share seeded.
- Current state (re-seeded 2026-10-01 ~08:10Z): Oktober 2026, INV/2026/10/001–004,
  net **Rp 8.045.000** (gross 8.250.000 − est. PPh 205.000), 1 overdue, 1 due in 3 days,
  0 shares, all checks true. **Re-seed before every session.**

## Internal dry run (2026-09-30/10-01, moderator account, Chrome)
| Step | Result |
|---|---|
| 1 capture deal | PASS — "Sambal Bu Rini" via + Deal dialog → "Deal disimpan", in Masuk |
| 2 deal workflow | PASS — ⋮ menu "Lanjut ke Deal": Kopi Lereng Merapi Nego → Deal |
| 3 invoice read | PASS — draft INV/…/001 shows number, amount, due date, "Pajak potong: Tidak ada", send/PDF actions |
| 4 PPh choice | **GAP** — seeded PPh 23/21 invoices display correctly; **no UI to choose PPh** (both create paths send `"NONE"`; never existed in git history). Not built (would be new scope). |
| 5 WhatsApp / share | PASS at API level — contact 200 (valid synthetic number), share create 200, read-back active, expiry exactly 90 d (2026-12-30), public page 200 with number/amount/PPh 23/bank. UI click-through **not browser-verified** (see below). Nothing sent. |
| 6 "Net ditagihkan bulan ini" | PASS — Rp 8.045.000 · "September 2026 · 1 invoice lunas" (server-rendered) |
| 7 due-soon | PASS — "Jatuh tempo 3 hari lagi" → "2 hari lagi" next day; overdue "Telat 4 hari" → "5 hari" |

Browser limitation (environment, not app): the automation Chrome window was occluded
(`visibilityState=hidden`, `hasFocus=false`, `requestAnimationFrame` never fired), so
React 19 never revealed streamed content or hydrated on later pages ("Memuat status
berbagi…", disabled "Kirim pengingat"). All 17 JS chunks loaded 200; API calls worked.
Recorded in the kit as a pre-session check.

Wording / friction (not fixed, evidence for sessions):
- On 1 Oct the summary showed **Rp 0 · Oktober 2026** while an unpaid overdue invoice existed — the `createdAt` hypothesis in action.
- Summary sub-line "· N invoice lunas" sits under a figure that also counts unpaid invoices; may steer the invoiced-vs-received question.
- Deal board shows "Tanpa tenggat" for invoiced deals even when their invoice is overdue (deal deadline vs invoice due date).
- Deal card body is not a link; detail/stage actions are under ⋮.
- Desktop layout only checked (window resize did not apply); screen-share sessions are desktop.

## Validation (branch `chore/m4-staging-kickoff-2026-09-30`)
lint 0 · typecheck 0 · test 81 files / 780 tests · `test:vercel-ignore-build` 48/48 ·
build 0 · `git diff --check` clean.

## Blockers
None for running Creator 01. Product gap (PPh picker) is a Chris decision, not a session blocker.

## Chris-only next actions
1. Review and **authorize merge** of PR #21 into `staging` (includes the moderated-session policy clause).
2. Decide on the PPh-picker gap: leave for M4 evidence, or schedule a fix PR before Creator 01.
3. **Recruit/schedule Creator 01–05** (external contact is yours).
4. Before each session: re-seed (`M4-READINESS.md` §3), run the §4 checklist.
5. **Run the first real moderated session**; log it in `DAILY_LOG.md` + tracker; update `STATE.md` counters from evidence only.
