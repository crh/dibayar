# Dibayar PR #67: release readiness (2026-10-25)

- **Release candidate:** PR #67, `staging` → `main`, head **`41085231cf386acb8e0309b83d61086b5a49ef92`** (merge of PR #69). Draft, mergeable CLEAN, no review decision, 0 unresolved threads.
- **Production:** `main` = `308a339e7de817aa37378d263d51f25c78ea4f09`, served as `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5`, aliased to `dibayar.vercel.app`.
- **Checked:** 2026-10-25 08:30–09:00Z by Claude Code; read-only on GitHub, Vercel and Production.

## Verdict: **NO-GO** (BLOCKED_WITH_REASONS)

Nothing here authorizes a merge. The gates below that are not PASS belong to Chris (`docs/receipts/DIBAYAR-PR67-OWNER-ACTIONS.md`).

Status words: **PASS** (cited evidence), **FAIL**, **BLOCKED**, **UNVERIFIED**, **OWNER ACTION REQUIRED**.

## Gates

| # | Gate | Status | Evidence | Remaining action |
|---|---|---|---|---|
| G1 | Head and drift | **PASS** | `git fetch`; `git rev-parse origin/main origin/staging` = `308a339…` / `4108523…`; `gh pr view 67` head `41085231…`, Draft, CLEAN (2026-10-25 08:30Z) | Re-check on merge day. A move (including a docs-only merge, or option 1(A) in the owner actions) is a new head |
| G2 | CI on the exact head | **PASS** | On `41085231…`: push CI 39181004556 and PR CI 39181008249 passed all four required jobs; Journey coverage (full) 39181008236 passed (gh run view, 2026-10-25). Counts in §A | None while the head is unchanged |
| G3 | Review state | **OWNER ACTION REQUIRED** | Draft; ruleset 24837655 needs a PR, 0 approvals and resolved threads (0 unresolved) | Chris lifts Draft at merge time |
| G4 | Secure application recovery | **OWNER ACTION REQUIRED** (code and local tests PASS) | Candidate `hotfix/secure-recovery-baseline-2026-10-25` @ `59388146acc8935c898bdd3de5cfb69562ada6d7`. Local: E2E 103 passed / 11 skipped by design / 0 failed against the 14-migration schema; unit 825/825; probe 9/9. CI dispatch 40177453189 on that SHA: all five jobs success (e2e-critical 91/11 skipped, e2e-cross-browser 209/19 skipped). Hardening receipt §2–§5 | Chris builds the staged deployment (owner actions §6) or accepts the insecure Instant Rollback in writing |
| G5 | Production DB identity | **UNVERIFIED** (owner-reported, corroborated) | 2026-10-25 wake-up check (OWNER-REPORTED); endpoint `ep-nameless-salad-aoa0saz5` matches the repository's record of `main`; Production build saw 12 migrations. Not directly observed: the `neon` CLI is unauthenticated, and the secret was not read | Chris runs the tighter anonymous wake-up check (owner actions §3) |
| G6 | DB recovery procedure | **BLOCKED** | Restore from the child branch `backup-preprod-20261019` is not a documented Neon operation (needs a root source branch). Snapshot one-step restore and PITR on `main` are documented (VENDOR-DOC) but never exercised here. Local logical rehearsal only (hardening receipt §5) | Unblocked by G7 (snapshot) plus Chris's acceptance (G13); a hosted rehearsal on a synthetic branch is optional and separately authorized |
| G7 | Pre-release backup | **FAIL** → OWNER ACTION REQUIRED | Only `backup-preprod-20261019` exists (about 5 days old on 2026-10-25, child branch). Free-plan PITR covers 6 h | Snapshot + data/schema branch of `main` within about 1 h before the merge, with integrity aggregates (owner actions §7) |
| G8 | Production baseline smoke | **PASS** (for 2026-10-25) | `scripts/smoke-deployment.mjs --env production`: 4/4 PASS at 08:37:55Z; anonymous unknown-token `/i/` and PDF → 404 (DB reached, no 500); HSTS, CSP, `X-Frame-Options` present | Repeat on merge day (owner actions §9) |
| G9 | Manual UAT (F2) | **OWNER ACTION REQUIRED** | Owner-reported only: 2026-10-19 PR comments ("allowlisted can sign in, excluded denied"; "1 is done"). No SHA, device, OS, browser, language or time recorded. `docs/testing/MANUAL-UAT.md` has no `4108523` rows. Timeline and template in §F2 | Fill in the rows or accept the gaps in writing |
| G10 | Pilot configuration | **FAIL** (type) / PASS (presence, scope, mode) | `vercel env ls production` (2026-10-25): `PILOT_ALLOWED_EMAILS` present, Production + Preview, type **Config**; `PILOT_ACCESS_MODE` absent | Re-add as Sensitive (owner actions §2) |
| G11 | Dependency audit | **FAIL** (preconditions unmet) | `npm audit --omit=dev` on the `4108523` lockfile: `next` 16.3.8 (GHSA-2464, GHSA-673q critical; GHSA-p3m5 high; published 2026-10-22), `zod` 4.4.3 (GHSA-mrhx high), `fast-uri` 3.1.8 (moderate). No Server Actions, `use cache`, `next/image` or `z.array` in `src/`; `sharp` 0.35.5 is the vendor workaround for GHSA-2464 (hardening receipt §3.4) | Chris chooses: patch first (PR #70 @ `f9bcee0`: 0 vulnerabilities; CI 40179308245 all required jobs green with the same counts as the release head) or release and patch next |
| G12 | Product decisions #56, #57; issue hygiene | **OWNER ACTION REQUIRED** | #56, #57, #65, #66 OPEN (`gh issue view`, 2026-10-25); #68, #69 merged into `staging` | §C |
| G13 | RTO/RPO risk acceptance | **OWNER ACTION REQUIRED** | RTO UNKNOWN (no restore ever run); RPO = time since the G7 snapshot | Wording in owner actions §8 |
| G14 | Release authorization | **OWNER ACTION REQUIRED** | none given | Release phrase, runbook §1.2 |

## A. CI on `41085231…` (OBSERVED from run logs, 2026-10-25)

| Run | Job | Result |
|---|---|---|
| 39181004556 (push) | lint-typecheck-test | success. Vitest 94 files, **1245/1245** |
| | e2e-critical | success. **334 passed, 28 skipped** |
| | e2e-a11y | success. **29 passed, 1 skipped** |
| | ux-audit | success. 69 passed + 9 passed |
| | e2e-cross-browser | **skipped** (job runs on schedule or dispatch only) |
| 39181008249 (pull_request) | same four jobs | success; e2e-cross-browser skipped |
| 39181008236 | Journey coverage (full) | success. **379 passed, 29 skipped**; 69 + 9 passed |

The skipped counts are tests scoped to one viewport or project by design. The local recovery run's 11 skips (hardening receipt §5.2) are of the same kind. The runs date from 2026-10-19; the head has not changed since, so they still apply. A later re-run of the date-sensitive unit tests could differ (see hardening receipt §6).

## F2. Manual UAT evidence for `4108523`

**What exists (OWNER-REPORTED, PR #67 comments):**

- 2026-10-19 02:16Z (09:16 WIB): "your allowlisted Google account can sign in and … an excluded Google account is denied".
- 2026-10-19 06:27Z (13:27 WIB): "1 is done", which covers:
  - sign-out and existing-session restriction;
  - real-phone due date and Edit Deal;
  - anonymous sharing, recipient PDF and revocation.

**Deployment timeline that bounds which code was tested (OBSERVED, Vercel API):**

| UTC | WIB | Staging deployment | SHA |
|---|---|---|---|
| 2026-10-18 03:16 | 10:16 | `dpl_89RfZx…` | `63b9e3c` |
| 2026-10-18 04:16 | 11:16 | `dpl_BSktgp…` | `3e410da` |
| 2026-10-18 05:06 | 12:06 | `dpl_5RN8fD…` | `7aeaa7b` |
| 2026-10-18 23:28 | 06:28 (10-19) | `dpl_C889mR…` | `796e558` (PR #68) |
| 2026-10-19 00:29 | 07:29 | `dpl_HHDjeX…` | **`4108523`** (PR #69) |
| 2026-10-19 01:50 | 08:50 | `dpl_CxvG7f…` | **`4108523`** (rebuild; the alias still serves it on 2026-10-25) |

**What the timeline does and does not prove:**

- **INFERRED, strong:** the allow/deny result and the existing-session restriction can only have been observed on `4108523`, the only staging build with the pilot gate.
- **NOT established:** the due-date, Edit Deal and recipient/revoke checks may have run on 2026-10-18 builds (`63b9e3c`, `3e410da`, `7aeaa7b`) or on `796e558`.
  - `796e558` and `7aeaa7b` differ from `4108523` only by #68 (dependencies) and #69 (the gate).
  - `63b9e3c` lacks deal edit.

**Rows to fill in (not results; copy into `docs/testing/MANUAL-UAT.md` only when every field is known, or write "not recorded, gap accepted"):**

| Date (WIB) | Check | Tester | Device / OS / Browser | Lang | Staging SHA | Result | Evidence / notes |
|---|---|---|---|---|---|---|---|
| | MAN-AUTH-01 steps 1–3 (sign-in **and** sign-out) — P0 | Chris | | | `4108523` | | |
| | MAN-AUTH-02 steps 1–4 (uninvited denied, no `User` row, invited in, `/i/` works) — P0 | Chris | | | `4108523` (INFERRED for steps 1 and 3) | | step 2 needs a read-only aggregate |
| | MAN-DUE-01 steps 1–9 — P0 | Chris | Android / Chrome | id + en | | | |
| | MAN-DUE-01 steps 1–10 — P0 | Chris | iPhone / Safari | id + en | | | |
| | MAN-DEAL-02 (edit a saved deal) — P1 | Chris | Android, iPhone | | | | |
| | MAN-REL-01 steps 1–3 (Cabut tautan → Ya, cabut tautan; reload private window) — blocks release | Chris | phone (FAB) + desktop | id | | | |
| | MAN-PDF-01, MAN-SHARE-01, MAN-WA-01, MAN-DEAL-01 — P1 | | | | | run / not run | release PR lists each |

**Acceptance wording, if the metadata cannot be recovered:**

> F2 (PR #67 @ `<SHA>`): I ran the checks reported on 2026-10-19 on the staging alias. Which deployment served each check is not recorded except where the pilot gate proves `4108523`. Devices / OS / browser / language: [values or "not recorded"]. I accept these gaps for a moderated pilot release.

If option 1(A) moves the head, the P0 rows must be rerun on the new staging deployment, or their carry-over justified in writing.

## C. Issues and PR hygiene

| Item | State (2026-10-25) | Recommended disposition (not executed) |
|---|---|---|
| #56 invoice correction/void | OPEN, P1 | Keep open. Chris states in PR #67: release for a **moderated pilot only**, limitation communicated to pilot creators; public onboarding blocked until built |
| #57 PPh choice | OPEN, P1 | Keep open. Same moderated-pilot statement; every invoice PPh = Tidak ada; waits for accountant review |
| #65 release review @ `7aeaa7b` | OPEN | Superseded by the `4108523` review. Close with a link to this report after Chris's F2 statement, or retitle as the F2 tracker |
| #66 `next` 16.3.3 advisories | OPEN | The listed advisories are fixed by #68 (merged into `staging`). Close referencing #68 once released. Track the 2026-10-22 advisories in PR #70 |
| #68, #69 | MERGED into `staging` | included in `4108523` |
| #39 dependabot PR into `main` | OPEN | Not part of this release; do not merge into `main` (governance: ordinary PRs target `staging`) |
| PR #67 body | refreshed 2026-10-25 (current-state section on top; 2026-10-18 `7aeaa7b` review kept below as history) | none |

## D. Attestation

Read-only on Production and hosted services:

- `git fetch`;
- `gh` reads;
- `vercel ls`, `inspect`, `env ls` (names, types and scopes only), `rollback status`;
- Vercel project and deployment API GETs;
- anonymous HTTPS GETs to `dibayar.vercel.app`: smoke script, two unknown-token 404 probes, one header read.

Writes, all outside Production:

- the push of `hotfix/secure-recovery-baseline-2026-10-25` (no Vercel deployment created; verified with `vercel ls`) and a CI `workflow_dispatch` on it;
- the docs/probe PR #71 and the dependency PR #70 into `staging` (both Draft, not merged);
- PR #67 description.

The only database writes went to the approved local disposable DB, with synthetic data.

Not done: merge, deploy, promote, rollback, restore, branch or snapshot creation, Production SQL, env change, or reading any secret value.
