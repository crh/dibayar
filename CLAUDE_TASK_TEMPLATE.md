# CLAUDE_TASK_TEMPLATE.md — Delegation Contract

<!-- Hermes: copy this template, fill EVERY section, then send to Claude (latest Sonnet).
     One task = one reviewable unit. Target ≤400 changed lines. If bigger, split.
     An unfilled section means the task is not ready to delegate. -->

## 1. Context snapshot
- Product: Dibayar — brand-deal CRM for Indonesian creators (see PRODUCT.md)
- Milestone: <Mx from ROADMAP.md>
- Current build status: <green/red> | Last deploy: <url/none>
- Relevant prior decisions: <1–3 bullets from STATE.md>

## 2. Files to inspect FIRST (read before writing)
- <path> — <why>
- <path> — <why>

## 3. Task (exact)
<One paragraph. What to build/fix. Concrete, not aspirational.>

## 4. Acceptance criteria (testable, numbered)
1. <User can X on a 390px viewport>
2. <API rejects Y with 4xx and zod error>
3. <Bahasa Indonesia copy for all user-facing strings; no English leakage>

## 5. Security requirements (task-specific)
- All queries scoped to authenticated user id
- Input validated with zod; no secrets touched; no new env vars without listing them
- <any task-specific item, e.g. unguessable invoice id>

## 6. Testing requirements
- Add/extend tests: <which behaviors>
- All existing tests must still pass

## 7. Build requirements
- `lint`, `typecheck`, `test`, `build` all green locally before returning

## 8. Do NOT change
- <files/behaviors that must stay untouched, e.g. auth config, schema of X>
- No new dependencies unless listed here: <allowed list or "none">

## 9. Expected output
- Diff or full changed files, list of files touched, how to run/verify,
  any assumption made (flagged), any acceptance criterion NOT met (flagged, not hidden)
