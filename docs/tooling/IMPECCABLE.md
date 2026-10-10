# Impeccable (Claude Code design skill)

[Impeccable](https://github.com/pbakaus/impeccable) is installed as a
project-scoped Claude Code skill. It supplements the Vitest suite, the
Playwright journeys (`e2e/`) and the UX audit harness (`tests/ux-audit/`); it
replaces none of them.

## Governance

`PRODUCT.md` and `DESIGN.md` are authoritative and hand-maintained. Impeccable
reads them as context. It must not write them.

- Do not run `/impeccable init` (writes `PRODUCT.md`) or `/impeccable document`
  (generates `DESIGN.md`), and do not let a "redesign" flow replace `DESIGN.md`.
- Do not use the `impeccable-documenter` subagent; its job is to rewrite
  `DESIGN.md`.
- Impeccable's aesthetic guidance ("bolder", new visual worlds, font choices)
  does not override `DESIGN.md`: fonts, colors, touch targets, mobile-first
  390px target, and Bahasa Indonesia / English copy rules stay as documented.
- Detector and critique output are suggestions for review, not required
  changes. Any resulting app change is a separate, approved work item.

## What is installed

| Item | Value |
|---|---|
| Skill version | 4.5.2 (`.claude/skills/impeccable/SKILL.md`) |
| Engine version | 0.1.14 (`.claude/skills/impeccable/scripts/VERSION`) |
| Source | npm `impeccable@4.5.2`, `github.com/pbakaus/impeccable`, Apache-2.0 |
| Install method | Upstream CLI installer, Claude provider, project scope, run by Chris from the repo root (documented form: `npx -y impeccable@4.5.2 install -y --providers=claude --scope=project --no-hooks`) |
| Installed on | 2026-10-10 |

Committed: `.claude/skills/impeccable/` (skill manifest, `reference/*.md`,
launcher scripts, live-mode browser scripts, font index) and four subagent
definitions in `.claude/agents/impeccable-*.md`.

Not committed:

- `.claude/skills/impeccable/scripts/bin/` — the ~20 MB platform engine binary.
  When it is absent, the launcher (`scripts/impeccable`) downloads engine
  0.1.14 for the current platform from the GitHub release into
  `~/.impeccable/bin/0.1.14/` and refuses it unless the `.sha256` sidecar
  matches. Expected SHA-256 for `linux-x64`:
  `3d31ec1a664ac35c815ea1d7c10abad1155ce364d0f461157eb837a34368efb6`.
- `.claude/settings.local.json` and the ephemeral `.impeccable/` files listed
  in `.gitignore`.

`.claude/**` is excluded from ESLint: the vendored scripts are not project code.

## Hooks: off

No hook manifest was written by the install (verified: no
`.claude/settings.local.json` hook entry and no `.impeccable/` config), so
nothing runs automatically. Upstream's Claude Code hook lives in the machine-local
`.claude/settings.local.json` and runs the engine after every UI file edit and
on Stop, for every session in that checkout, independent of tool approval.

To enable it later on one machine, after reviewing
`.claude/skills/impeccable/reference/hooks.md`: back up
`.claude/settings.local.json`, run `npx -y impeccable@4.5.2 install -y
--providers=claude --scope=project` from the repo root, then confirm the
existing `permissions` block is intact. `/impeccable hooks off` disables it.

## Use

Reload Claude Code after pulling this change, then `/impeccable` shows a menu.
Read-only commands suited to this repo: `/impeccable audit <target>` and
`/impeccable critique <target>`.

Deterministic detector (no LLM):

```bash
npx -y impeccable@4.5.2 detect --json src/
```

Exit `0` = no primary findings, `2` = findings (not a failure), `1` = a target
could not be scanned.

## Update

`npx impeccable update` rewrites the skill directory. Do it on a `chore/*`
branch, re-check the engine hash against the GitHub release, re-read this file's
governance section against the new `SKILL.md`, and update the versions above.
