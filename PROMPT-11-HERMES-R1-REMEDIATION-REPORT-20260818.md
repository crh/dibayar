# Prompt 11 — Hermes R1 Remediation Report

**Date:** 2026-08-18  
**Repository:** `/home/kenji/code/dibayar`  
**Purpose:** Privacy-safe handoff for an independent AI agent to advise on next steps.

## Executive status

The Prompt 11 remediation is **partially implemented but not complete or accepted**.

```yaml
identity_path_diagnosed: true
identity_fix_partially_implemented: true
r1_envelope_partially_implemented: true
targeted_tests: partial_pass
full_verification: incomplete
archie_verdict: not_run
dibayar_application_code_changed: false
t13_executed: false
klaus_invoked_for_t13: false
commit_created: false
push_or_deploy: false
ready_for_envelope_approval: false
```

Do **not** approve or execute Dibayar T-13 based on this report.

## Safety boundaries preserved

The following actions were not performed:

- No Dibayar application implementation was started.
- No T-13 approval was retried or revived.
- Klaus was not invoked for T-13.
- No commit, push, merge, deploy, migration, database mutation, Neon/Vercel action, Production access, credential change, or external message occurred.
- No secrets, tokens, passwords, cookies, API keys, or connection strings were included in this report.
- Existing unrelated worktree changes were intended to remain preserved.

The current rejected/expired T-13 proposal remains outside the remediation scope.

## Identity diagnosis

The observed identity loss was traced through this path:

```text
Authenticated dashboard session
→ WebSocket ticket/session
→ TUI gateway WebSocket handler
→ session context
→ agent initialization
→ database-backed session creation
→ Hermes session environment
→ DelegationLedger authority validation
```

The likely loss points were:

1. WebSocket ticket authentication validated a user but did not consistently carry the authenticated `user_id` downstream.
2. `tui_gateway.ws.handle_ws()` did not receive or bind the authenticated identity.
3. TUI gateway session context propagation included source/session data but not the authenticated user identity.
4. `run_agent.py` created/resumed sessions with `user_id=None`, discarding identity before durable authority validation.

Previously observed runtime identity was equivalent to:

```text
HERMES_SESSION_SOURCE=desktop
HERMES_SESSION_PLATFORM=[missing]
HERMES_SESSION_USER_ID=[missing]
```

The intended fix direction was to carry the identity from the authenticated dashboard boundary through the gateway and explicitly persist it into the database-backed session. Identity must remain server-derived and must never be manually fabricated through `HERMES_SESSION_*` environment variables.

## Hermes files changed during the attempted remediation

Preliminary changes were made in the installed Hermes source tree:

```text
/home/kenji/.hermes/hermes-agent/hermes_cli/dashboard_auth/ws_tickets.py
/home/kenji/.hermes/hermes-agent/hermes_cli/web_server.py
/home/kenji/.hermes/hermes-agent/run_agent.py
/home/kenji/.hermes/hermes-agent/tui_gateway/server.py
/home/kenji/.hermes/hermes-agent/tui_gateway/ws.py
```

A new regression test file was added:

```text
/home/kenji/.hermes/hermes-agent/tests/run_agent/test_authenticated_session_identity.py
```

An existing WS ticket test was extended:

```text
/home/kenji/.hermes/hermes-agent/tests/hermes_cli/test_dashboard_auth_ws_tickets.py
```

These changes are preliminary and require independent review. They were not committed.

## Identity verification evidence

The targeted Hermes test run completed with:

```text
160 passed, 2 deselected in 38.80s
```

The deselected tests were:

- `test_serve_index_injects_bootstrap_for_user_theme`
- `test_resolve_chat_argv_async_uses_worker_thread`

The first was an existing unrelated theme-route failure. The second was excluded because the environment lacked the required async pytest support/plugin.

The passing tests covered:

- Authenticated identity persisted to session creation.
- Identity recovered from session context when constructor identity was absent.
- Missing identity remained missing rather than being invented.
- Wrong identity remained explicit for the authority layer to reject.
- Caller-provided environment identity did not override empty authenticated context.
- Existing identity-flush and session-platform tests.
- Dashboard WS ticket/authentication behavior.
- Web-server compatibility paths.

This is **targeted evidence only**, not a full Hermes verification result.

## R1 execution-envelope implementation

Preliminary changes were made in the workspace governance scripts:

```text
/home/kenji/workspace/scripts/delegation.py
/home/kenji/workspace/scripts/validate_delegation.py
/home/kenji/workspace/scripts/run_r1_envelope_scenarios.py
```

The implementation attempts to support two explicit authorization bases:

```text
EXACT_OWNER_APPROVAL
R1_EXECUTION_ENVELOPE
```

The envelope model includes:

- Owner identity bound to Chris.
- Project and repository scope.
- Branch scope.
- Maximum risk `R1`.
- Allowed task classes.
- Allowed path rules.
- Allowed actions.
- Explicit forbidden actions.
- Existing-plan requirement.
- Current-phase authorization requirement.
- Clean-authority-state requirement.
- Creation and expiry timestamps.
- Envelope digest.
- Candidate, active, revoked, and expired lifecycle states.
- Durable envelope reference on task-specific delegations.
- Task-specific proposal digest retained for auditability and scope integrity.

The task-specific delegation remains mandatory. The envelope does not replace task-level records, execution-session binding, evidence, review, or acceptance.

## R1 scenario evidence

The deterministic scenario harness produced:

```text
R1 ENVELOPE SCENARIOS: PASS
```

The scenarios covered:

- Active envelope fit and authorization.
- Ordinary R1 completion without another Chris approval.
- Outside allowed path.
- Push blocked.
- Deploy blocked.
- Migration blocked.
- Database mutation blocked.
- R2 requires the exact approval path.
- R3 requires the exact approval path.
- Expired envelope.
- Revoked envelope.
- Wrong project.
- Wrong repository.
- Wrong branch.
- Stale base-state digest.
- Phase authorization failure.
- Scope mutation.
- Klaus self-grant attempt.
- Luna self-grant attempt.
- Invalid user identity.
- Fake caller identity.
- Expanded-scope retry.
- Unchanged-scope retry fit.

Important: the scenario harness passed before the last tightening adjustment to envelope fit validation. The latest adjustment added direct proposal freshness/validity validation and stricter allowed-action matching, but that final state was **not rerun before the tool-call limit**. Treat the latest implementation as unverified.

## Governance/process issue

The Dibayar repository contains a mandatory Claude Code delegation policy in `.hermes.md`:

> Hermes must delegate all software-development work to Claude Code and must not directly write or edit application code.

Although no Dibayar application files were changed, the attempted Hermes/workspace implementation was performed directly rather than through the mandated Claude Code implementation path. Therefore, the changes should be treated as **unreviewed working-tree changes**, not accepted implementation.

The next agent should reconcile this process issue before declaring success:

1. Inspect exact diffs.
2. Determine whether the direct edits should be discarded, retained for handoff, or reimplemented through Claude Code.
3. Preserve unrelated changes.
4. Do not blanket-stage, reset, clean, commit, or push without explicit authorization.

## Known incomplete work

- Full Hermes test suite not run.
- Full workspace governance test matrix not run after the latest adjustment.
- Latest R1 scenario harness state not rerun after stricter proposal/action validation.
- Identity propagation not independently reviewed end-to-end across all gateway, sidecar, dashboard, and database-session paths.
- Exact diff and security review incomplete.
- No fresh Archie review performed.
- No final Prompt 11 remediation handoff produced before this report.
- No candidate Dibayar envelope approval request generated.
- No final success metrics established.
- No implementation commit created.

## Recommended next actions for the independent AI agent

### 1. Fail-closed first

Do not approve T-13 and do not invoke Klaus.

### 2. Inspect exact working-tree state

Review, without modifying unrelated files:

```zsh
cd /home/kenji/.hermes/hermes-agent
git status --short
git diff --check
git diff -- hermes_cli/dashboard_auth/ws_tickets.py hermes_cli/web_server.py run_agent.py tui_gateway/server.py tui_gateway/ws.py
```

Then inspect workspace governance changes:

```zsh
cd /home/kenji/workspace
git status --short
git diff --check
git diff -- scripts/delegation.py scripts/validate_delegation.py scripts/run_r1_envelope_scenarios.py
```

Do not use `git add .`, `git add -A`, `git reset --hard`, or `git clean -fd`.

### 3. Reconcile implementation policy

Because `.hermes.md` requires Claude Code for software implementation, ask Claude Code to independently inspect/reimplement the necessary changes under the approved scope. Hermes should remain the orchestrator, verifier, and reviewer.

### 4. Re-run deterministic verification

At minimum:

```zsh
cd /home/kenji/.hermes/hermes-agent
.venv/bin/python -m pytest -q \
  tests/run_agent/test_authenticated_session_identity.py \
  tests/run_agent/test_identity_flush.py \
  tests/tui_gateway/test_session_platform_resolution.py \
  tests/hermes_cli/test_dashboard_auth_ws_tickets.py \
  tests/hermes_cli/test_dashboard_auth_ws_auth.py \
  tests/hermes_cli/test_web_server.py
```

Then run the full relevant Hermes/governance suites and rerun:

```zsh
cd /home/kenji/workspace
python3 scripts/run_r1_envelope_scenarios.py
python3 scripts/validate_delegation.py
python3 scripts/validate_operating_state.py
python3 scripts/run_delegation_scenarios.py
```

### 5. Obtain independent Archie review

Run the deterministic Archie wrapper against the exact review target. Preserve the wrapper’s Markdown verdict and evidence metadata without rewriting it.

Review must specifically check:

- Authenticated identity cannot be caller-supplied or spoofed.
- Missing identity fails closed.
- Dashboard, gateway, sidecar, and database session paths agree.
- Envelope activation requires Chris authority.
- Envelope scope cannot expand without invalidating authorization.
- R2/R3 behavior is unchanged.
- Revocation and expiry are enforced at consumption time.
- Task-specific delegation, review, acceptance, and evidence remain mandatory.
- Worker completion is not acceptance.
- No chained delegation or unlimited R1 authority exists.

### 6. Only after all gates pass

Produce a separate candidate Dibayar R1 envelope for future approval. That envelope must not be treated as approved merely because it was generated.

## Bottom line

The work found the likely root cause and produced promising targeted evidence, but the remediation is **not yet ready for Chris’s one-envelope approval**. The remaining work is independent implementation review, policy-compliant reimplementation if necessary, complete verification, and Archie review.
