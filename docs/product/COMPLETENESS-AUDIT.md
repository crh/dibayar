# Product completeness audit

How Dibayar checks that what a creator **must be able to do** exists, not only that the buttons that exist work. Introduced by the 2026-10-17 audit (receipt: `docs/receipts/DIBAYAR-PRODUCT-COMPLETENESS-AUDIT-2026-10-17.md`).

## Why

`docs/testing/journey-coverage.json` lists the actions the UI offers and how each is tested. A requirement the UI never offered has no row there, so no coverage figure can miss it. Example: `ROADMAP.md` M1 asks for deal "create/read/update/delete"; M1 was accepted with update and delete exercised through the API only, and the inventory marks `DEAL-DELETE-01` *not applicable* because no control exists. Editing a saved deal (#55) was found by a tester on a phone, not by any check.

## The three layers

| Layer | What | Blocking? |
|---|---|---|
| 1. Capability model | `docs/product/capabilities.json`, written from the product documents, kept by hand. Generated view: `docs/product/capability-matrix.md`. | — |
| 2. Deterministic check | `npm run coverage:capabilities` (and its self-test `npm run test:capability-coverage`): each REQUIRED capability maps to an inventory action driven for real or verified by a person, or names a manual check in `docs/testing/MANUAL-UAT.md`, or carries an open gap with an issue or finding. Runs in the CI `lint-typecheck-test` job. | **Yes** |
| 3. Exploration | `npm run audit:completeness:probe` records what each main screen offers in three browser setups; a person or an LLM session compares that with the capability model and drafts findings. | **No** |

### What the check enforces

- A mapped inventory action that is deleted, or re-marked `not_applicable`, fails: a requirement cannot disappear through the inventory.
- A REQUIRED capability with no real/manual evidence and no gap fails.
- A gap on a capability that is now covered fails (stale gap): close it, or narrow the mapping.
- A pinned test (`verification.tests`) must stay listed as a real test of its action; `npm run coverage:journeys` in turn proves the test is registered and not skipped.
- A manual check must be a `### MAN-…` section in `MANUAL-UAT.md`.
- UNKNOWN capabilities name the open question and who decides.

It does **not** enforce a percentage, does not check that an issue is still open, and does not prove that every part of a covered capability works ("covered" = at least one real journey; partial evidence is listed in the matrix).

### Changing the model

- **Adding a feature:** add or update the capability, map the new inventory action(s), remove the gap, run `npm run coverage:capabilities:report`, commit the matrix.
- **A product decision** (e.g. Chris declines PPh selection): change the classification and add a rationale entry naming the decision, date and who made it. Never delete a REQUIRED capability or its gap to make CI green.
- **A new requirement** (issue, product doc, creator feedback): add it as REQUIRED only with a source; otherwise PROPOSED or UNKNOWN.

## Running an exploration (non-blocking)

When: before a `staging -> main` release candidate, after a feature lands, or on request. Never as a CI gate until its findings have been calibrated against human review over several runs.

1. Isolated environment only: the local test database (`127.0.0.1:55432/dibayar_test`) through the E2E harness, or `staging` with the synthetic test account. Never Production.
2. `npm run audit:completeness:probe` — builds, starts the E2E server, seeds fixtures, and writes `test-results/completeness/controls-<project>.json` plus screenshots for `chromium`, `chromium-mobile` (390 px) and `webkit-mobile` (390 px WebKit emulation). Native pickers and real phones stay manual (`MANUAL-UAT.md`).
3. Give an LLM session (Claude Code) this brief:

   > Read `docs/product/capabilities.json`, `docs/product/capability-matrix.md`, `docs/testing/journey-coverage.json` and every `test-results/completeness/controls-*.json`. For each REQUIRED and UNKNOWN capability, state whether a person can reach it with the recorded controls, quoting the screen and control. Then drive the app yourself through visible controls only (taps, clicks, keyboard; no API calls to claim a capability) for three personas: first-time creator, experienced creator correcting a deal, creator with an issued invoice. Bound each journey to ~25 actions; record `NOT_TESTED` on environment problems. For every suspected gap read the components and routes before calling it missing, and check open issues for duplicates. Return: findings (capability, kind: missing / discoverability / UI bug / backend defect / unknown, steps, expected, observed, evidence, confidence high/medium/low), and issue drafts. Do not open issues, edit code or change the model.

4. A person reviews the findings, opens issues for the confirmed ones, and updates `capabilities.json` (gaps, classifications) in a PR. Probe output and screenshots contain synthetic data only; still check them before attaching anything to the public repository, and never attach a share link.
