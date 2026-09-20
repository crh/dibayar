# Dibayar Dependabot Security Triage — Receipt

## 1. Baseline

- Baseline commit: `d2ea38d` (`Add receipt for visual-date determinism review and merge`)
- `origin/main` matched local `main` at session start; working tree was clean except the pre-existing untracked `DIBAYAR-VISUAL-DATE-PUSH-RECEIPT.md`.
- Branch created: `security/dependabot-triage`
- No merge or push performed. Branch is local-only pending explicit instruction.

## 2. Alert inventory (from `gh api repos/crh/dibayar/dependabot/alerts`)

GitHub reported 11 **open** alerts at session start: **10 high, 1 moderate** — matching the task's stated count exactly. (The remaining alerts returned by the API were already `state: "fixed"` from prior work, e.g. the Next.js 16.2.11 CVE batch, and are not re-triaged here.)

| # | Package | GHSA | CVE | Severity | Vulnerable range | Patched | Scope | Dependency path |
|---|---------|------|-----|----------|-------------------|---------|-------|------------------|
| 54 | browserslist | GHSA-c83g-rgw3-j3cx | CVE-2026-73089 | High | <=4.28.6 | 4.28.7 | dev | eslint-config-next → eslint-plugin-react-hooks → @babel/core → @babel/helper-compilation-targets → browserslist |
| 53 | browserslist | GHSA-73wf-gq98-2v4g | CVE-2026-73088 | High | <=4.28.6 | 4.28.7 | dev | same as above |
| 52 | fast-uri | GHSA-jqff-g426-hqxp | CVE-2026-76172 | High | >=3.0.0 <3.1.6 | 3.1.6 | dev | prisma → @prisma/dev → @prisma/streams-local → ajv@8.20.0 → fast-uri |
| 51 | fast-uri | GHSA-f65p-4m7j-42xc | CVE-2026-75975 | High | >=3.0.0 <3.1.6 | 3.1.6 | dev | same as above |
| 50 | mysql2 | GHSA-rgwj-5xj2-c3m3 | — | Moderate | <=3.23.0 | 3.23.1 | dev | prisma → mysql2 (direct, exact-pinned) |
| 48 | fast-uri | GHSA-fph4-wmhf-6fwf | CVE-2026-75899 | High | >=3.1.2 <3.1.6 | 3.1.6 | dev | same as #52 |
| 47 | fast-uri | GHSA-5jgf-p345-68v8 | CVE-2026-75931 | High | >=3.1.3 <3.1.6 | 3.1.6 | dev | same as #52 |
| 46 | mysql2 | GHSA-3f6p-5ww8-9rcr | — | High | <3.22.0 | 3.22.0 | dev | same as #50 |
| 43 | deepmerge-ts | GHSA-ggr8-5vv4-36mx | CVE-2026-40345 | High | <8.0.0 | 8.0.0 | dev | prisma → @prisma/config → deepmerge-ts (direct, exact-pinned) |
| 42 | nanoid | GHSA-2v37-7h3g-55p8 | CVE-2026-67213 | High | <3.3.18 | 3.3.18 | **runtime** | @tailwindcss/postcss → postcss@8.5.23 → nanoid, **and** next@16.3.0 (prod dep) → postcss@8.5.23 (deduped, same install) |
| 39 | js-yaml | GHSA-5p4m-2wfm-xmqj | — | High | >=4.0.0 <4.3.1 | 4.3.1 | dev | eslint → @eslint/eslintrc → js-yaml |

All 11 are **transitive** — none appear in `package.json` `dependencies`/`devDependencies` directly.

## 3. Risk classification

| Alert(s) | Class | Rationale |
|---|---|---|
| #42 nanoid | **P1** | Only alert GitHub scoped `runtime`. Verified: `next` (production dependency) resolves to the same deduped `postcss@8.5.23` install that pulls in `nanoid`, so the vulnerable module is present in a production-reachable install tree. The vulnerability itself (infinite loop in `customAlphabet`/`customRandom` when called with `size: 0`) requires a caller to invoke nanoid's custom-generator API with `size: 0`; postcss's own internal use (hashing) does not do this, so practical exploitability is low, but presence in the runtime tree plus a trivial patch justifies P1 over P2. |
| #54, #53 browserslist; #52, #51, #48, #47 fast-uri; #39 js-yaml | **P2** | High severity per advisory, but every path terminates in build-time/lint-time/CLI-time tooling (Babel target resolution, ESLint config parsing, Prisma's dev-CLI JSON-schema validation via ajv). Not present in the Next.js server bundle or any request-handling code path. |
| #50, #46 mysql2 | **P2** | High/moderate severity, but `mysql2` is Prisma's optional MySQL driver. Dibayar's `prisma/schema.prisma` datasource is `postgresql` only (`@prisma/adapter-pg`, per `CLAUDE.md`/`STATE.md`) — the mysql2 code path is never invoked; it ships only because Prisma bundles drivers for all supported databases. Verified — not inferred — by grepping the schema. |
| #43 deepmerge-ts | **P2** | High severity, but reached only via `@prisma/config`'s internal config-merging during `prisma` CLI invocations (`generate`, `migrate`, `validate`) — dev-tooling only, not part of the deployed app. |

No alert was downgraded for remediation convenience — deepmerge-ts stays High/P2 on severity; it is *unfixed* purely because the only available fix is a major version bump (see §5).

## 4. Fixes implemented

Mechanism: `package.json` `overrides` field pinning each vulnerable transitive package to its minimum patched version (not "latest", to keep the change to the smallest safe delta), followed by `npm install` to regenerate the lockfile. No direct `dependencies`/`devDependencies` entries were touched.

```json
"overrides": {
  "browserslist": "4.28.7",
  "fast-uri": "3.1.6",
  "js-yaml": "4.3.1",
  "nanoid": "3.3.18",
  "mysql2": "3.23.1"
}
```

| Package | Before | After | Alerts closed | Why this is the smallest safe fix |
|---|---|---|---|---|
| browserslist | 4.28.6 | 4.28.7 | 54, 53 | Parent (`@babel/helper-compilation-targets`) declares `^4.24.0` — 4.28.7 is already in-range; only the lockfile's resolved version was stale. Pure dev/lint tooling, no code touches it. |
| fast-uri | 3.1.5 | 3.1.6 | 52, 51, 48, 47 | Parent (`ajv@8.20.0`, nested under Prisma's dev CLI) declares `^3.0.1` — in-range. |
| js-yaml | 4.3.0 | 4.3.1 | 39 | Parent (`@eslint/eslintrc`) declares `^4.3.0` — in-range. |
| nanoid | 3.3.16 | 3.3.18 | 42 | Parent (`postcss@8.5.23`) declares `^3.3.16` — in-range. Prioritized despite being a transitive override because of its production-reachable classification (P1, §3). |
| mysql2 | 3.15.3 | 3.23.1 | 50, 46 | Prisma pins mysql2 to an **exact** version (`3.15.3`, no caret), so an in-range update was not possible — required an `overrides` entry (safe transitive override). 3.23.1 is the lowest version that satisfies both GHSA-3f6p (patched 3.22.0) and GHSA-rgwj (patched 3.23.1) simultaneously, and stays within mysql2's same major line (3.x), so no mysql2-side breaking API change is expected per its own semver contract. The driver is never invoked by this Postgres-only app (§3), further bounding regression risk. |

Collateral lockfile changes (expected, not unrelated churn): `caniuse-lite`, `electron-to-chromium`, `baseline-browser-mapping` bumped as browserslist's own transitive dependencies; `sqlstring`→`sql-escaper` and removal of `seq-queue` are mysql2's own dependency changes between 3.15.3 and 3.23.1. **`prisma`, `@prisma/client`, `@prisma/adapter-pg`, and `next` versions were not changed** — confirmed by diffing `package-lock.json` for `"version"` fields belonging to those packages.

An initial attempt used `npm audit fix` directly; it was **rejected and reverted** because it silently bumped `prisma` 7.9.1 → 7.10.0 as a side effect of its full dependency re-resolution — exactly the "unrelated dependency churn" the task instructions prohibit. The `overrides`-based approach was used instead specifically to avoid that.

## 5. Alerts remaining

| # | Package | Why it remains | Next action |
|---|---|---|---|
| 43 | deepmerge-ts (<8.0.0) | The only fix is `deepmerge-ts@8.0.0`, a **major** version bump. Its consumer, `@prisma/config`, pins it to an exact version (`7.1.5`) — the same exact-pin pattern as mysql2, but here the fix itself crosses a major version boundary, which is explicitly out of scope for autonomous remediation per the task's implementation policy ("no breaking API/config change is expected" is not verifiable for a major bump without dedicated review). `npm audit fix --force` confirms npm's own resolver would need to **downgrade** `prisma` to 6.x to satisfy this without an override — not acceptable. | Follow-up branch: evaluate whether Prisma's own upstream release has since bumped `@prisma/config`'s `deepmerge-ts` pin past 8.0.0 (check `npm view @prisma/config versions` / Prisma changelog), or override `deepmerge-ts` to `8.0.0` in isolation and run the full Prisma CLI surface (`generate`, `migrate dev`, `migrate deploy`, `db pull`, `validate`) against the disposable test Postgres to confirm `@prisma/config`'s merge logic still behaves correctly against the new major version before merging. |

## 6. Package/lockfile files changed

- `package.json` — added `overrides` block (5 entries), no other changes.
- `package-lock.json` — resolved versions updated for the 5 overridden packages plus their own direct transitive dependencies (see collateral note in §4).

No other files changed by this session (the untracked `DIBAYAR-VISUAL-DATE-PUSH-RECEIPT.md` predates this session and is unrelated).

## 7. Validation — commands and exact results

| Command | Result |
|---|---|
| `npm run typecheck` | Pass — no output, exit 0 |
| `npm run lint` | Pass — 0 errors, 0 warnings across all files (parsed full ESLint JSON output) |
| `npx vitest run` | Pass — **78 test files, 752 tests passed**, 0 failed |
| `npm run build` | Pass — Next.js 16.3.0 production build compiled successfully, all 21 routes generated |
| `npx prisma validate` | Pass — `The schema at prisma/schema.prisma is valid` (confirms the mysql2 override didn't break Prisma CLI resolution) |
| `npm run test:e2e:critical` | Pass — **51 passed, 7 skipped, 0 failed** (2.1m; chromium + chromium-mobile projects, `@critical`-tagged journeys covering auth/session, deal CRUD, filter navigation, invoice journeys, settings, mobile nav) |

Not run: `test:e2e:visual`, `npm run ux:audit` (full audit harness), and the non-critical/all-browser E2E projects. Given this change touches only transitive dependency versions in build/lint/CLI tooling plus one runtime-adjacent package with no application code changes, and the above five gates (typecheck, lint, full unit suite, production build, and the full `@critical`-tagged Playwright suite across desktop+mobile) all passed cleanly, the remaining suites were judged non-essential for this diff's risk profile. Flagging this explicitly rather than claiming full validation coverage.

## 8. Before/after vulnerability counts

- **GitHub Dependabot (open alerts, this session's scope):** 11 before (10 high, 1 moderate) → 1 remains open after fix (#43, deepmerge-ts, high). *Note: GitHub's alert `state` only updates after this branch is pushed and Dependabot re-scans; the "1 remains" figure is based on verified installed versions against each alert's patched-version threshold, not a live re-fetch of alert state, since this branch has not been pushed.*
- **Local `npm audit` (deduplicated by package, includes dependency-chain restatement):** 8 high / 0 moderate before → 3 high after (all three remaining entries — `deepmerge-ts`, `@prisma/config`, `prisma` — stem from the single unresolved deepmerge-ts issue; npm audit lists each link in the dependency chain as a separate "vulnerability").

## 9. Regression risks

- **mysql2 3.15.3 → 3.23.1**: crosses several minor versions within the same major (3.x). Per mysql2's semver contract this should be non-breaking; confirmed no observable break via `prisma validate`, `npm run build`, full unit suite, and full `@critical` E2E suite. Residual risk is theoretical only, since the app never opens a MySQL connection (Postgres-only datasource, verified against `prisma/schema.prisma`).
- **nanoid 3.3.16 → 3.3.18**: patch-level bump, in-range for its declared consumer (postcss). Low risk.
- **browserslist / fast-uri / js-yaml**: patch-level, in-range, dev/lint/CLI-only. Effectively no production risk.
- **No production dependency (`next`, `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `react`, `react-dom`, `zod`, `next-auth`) changed version.**
- **Deferred major upgrade (deepmerge-ts → 8.0.0, blocked by `@prisma/config`'s exact pin)**: left untouched rather than risk a silent break in Prisma CLI tooling (migrations, `generate`) — that surface is exercised by every future task in this repo, so a bad override here would be a high-blast-radius mistake to make without dedicated review.

## 10. Recommended next branches

1. `security/dependabot-triage-deepmerge-major` — isolated review of the `deepmerge-ts` 7→8 major bump (override + full Prisma CLI surface test against the disposable local Postgres), or wait for upstream `@prisma/config` to move its pin.
2. Consider filing/tracking whether Prisma intends to bump its own `mysql2`/`deepmerge-ts` pins in a future release, which would let these overrides be removed later (overrides are a stopgap, not a permanent fix — they should be revisited whenever `prisma` itself is upgraded).

## Overall status

**PARTIALLY_REMEDIATED** — 10 of 11 open Dependabot alerts addressed with smallest-safe-fix version pins, validated with typecheck/lint/752 unit tests/production build/prisma validate/51 critical E2E journeys, all passing. 1 alert (deepmerge-ts, high) remains, blocked on a major-version upgrade that requires dedicated compatibility review per task policy — not silently forced. Not merged, not pushed.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZtnVoEbfsb9bTCtYrvz3r
