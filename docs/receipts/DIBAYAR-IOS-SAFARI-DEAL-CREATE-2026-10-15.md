# Dibayar — iPhone Safari deal creation (issue #50) — 2026-10-15

**Verdict:** `BLOCKED_NEEDS_NETWORK_EVIDENCE` · root cause **UNKNOWN** · release **NO-GO**

## State verified

| Item | Value | How |
| --- | --- | --- |
| `origin/staging` | `b9e9960e064fd6f0ebd36cad714d56071952746a` | `git fetch` + `git rev-parse` |
| `origin/main` | `308a339e7de817aa37378d263d51f25c78ea4f09` | same |
| Staging alias deployment | `dpl_8gp6DL4Ax69gowtcYruWsV27zqbb` (`dibayar-r809er7le-…`), READY, `githubCommitSha` = `b9e9960` | `vercel inspect`, `vercel api /v13/deployments/…` |
| CI on `b9e9960` | CI run 38348714217 success; Journey coverage (full) 38348711513 success | `gh run list --branch staging` |
| Open PRs before this work | #39 (dependabot → main) only | `gh pr list` |

## Server evidence (read-only Vercel request logs, deployment above)

| UTC (2026-10-15) | Request | Status |
| --- | --- | --- |
| 00:30:35, 00:30:41, 00:31:22 | `POST /api/deals` | 400 |
| 00:39:16, 00:46:15, 00:46:50 | `POST /api/deals` | 400 |

- No 2xx, 401, 403 or 500 for `POST /api/deals` in the retained window. Retention starts at 2026-10-15 00:30 UTC.
- In `src/app/api/deals/route.ts`, a 400 is reached only after `auth()` and `isSameOriginRequest()`. The requests were therefore signed in and same-origin. The rejection was a `ZodError` or a `SyntaxError` from `request.json()`.
- `createDeal` calls `dealInputSchema.parse` before `$transaction`, so **no deal row was written and there are no duplicates** from these attempts.
- The only error-level log lines are `pg` SSL-mode deprecation warnings (benign).
- **Limits:** the log records have no user agent and no body, so the link to the iPhone tester is by timing only (07:30–07:47 WIB, matching issue comments at 07:36 and 07:47 WIB).

## Reproduction

| Check | Result |
| --- | --- |
| Playwright WebKit, `devices["iPhone 13"]`, Turbopack `next build`: FAB, no deadline | 201 |
| same, FAB with deadline | 201 |
| same, `/deal?tambah=1`, no deadline | 201 |
| same, `/deal?tambah=1`, with deadline | 201 |
| Desktop browser on staging | NOT RUN: alias behind Vercel SSO and the automation profile is not signed in; credentials not requested |
| Physical iPhone | `NOT_REPRODUCED_ON_PHYSICAL_IPHONE` (no device or Web Inspector access) |

The probe spec was temporary and is not committed.

**Candidate, not confirmed:** `deal-form.tsx` puts only `required` on "Kontak WhatsApp", while `deal-validation.ts` requires ≥ 6 characters after trim. A short placeholder number passes the browser and returns exactly this 400 with the generic message (`e2e/deals/deal-crud.spec.ts` already exercises it). No fix was made on this basis.

## Change: PR #51 (diagnostic, against `staging`, not merged)

- Commit `ecc367a`: error responses gain `code` + `ref`. One `[deal-create-failed]` log line per failure: field paths, Zod codes, device family, Prisma code. No values, ids, cookies, body or user agent. The dialog shows a `Kode:` line. Marked TEMPORARY.
- Local gates on `ecc367a`: lint 0 errors · typecheck clean · unit 85 files / 1004 passed · `npm run build` OK · `e2e/deals` on chromium + chromium-mobile + webkit: 100 passed, 17 skipped (existing project conditions), 0 failed or flaky.
- RED/GREEN: not applicable, because no defect is confirmed. The tests pin the diagnostic contract instead: each code, the logged fields, and the absence of typed values.

## Operator checklist

Under test: `https://dibayar-git-staging-kenji-iwakura.vercel.app`, SHA `b9e9960` now. After PR #51 merges, use its new staging SHA, and confirm `githubCommitSha` before testing.

1. **Only after PR #51 is on staging:** on the physical iPhone in Safari, reload `/deal` and confirm no synthetic deal already exists.
2. Tap the **+ Deal** FAB. Enter synthetic data: brand `UAT iPhone <time>`, WhatsApp `628123456789`, scope `Uji`, fee `1500000`, no deadline. Tap **Simpan deal once**.
3. If it fails, record the full `Kode:` line (code · fields · ref) and the iOS version. Do not retry repeatedly.
4. If it saves: reload, confirm exactly one card, then repeat through `/deal?tambah=1`. Check that typed text is not lost, focus stays in the field, and only one POST is sent.
5. Only after creation passes: run **MAN-DUE-01** on the iPhone, including rapid native date-wheel changes.
6. Android MAN-DUE-01: still **NOT_RUN**.
7. FIND-10 Production read-only SQL: still **NOT_RUN**. **Do not run it against Production from this task.**

## Manual UAT gates

| Gate | Status |
| --- | --- |
| Desktop authentication | PASS (tester-reported) |
| iPhone Safari deal creation | BLOCKED (issue #50) |
| iPhone MAN-DUE-01 | BLOCKED, not FAIL |
| Android MAN-DUE-01 | NOT_RUN |
| Full real-device invoice journey | PASS reported, platform and evidence not supplied |
| FIND-10 Production impact | NOT_RUN, impact UNKNOWN |

**Release: NO-GO.** No Production, `main`, Vercel, Neon or OAuth change was made.
