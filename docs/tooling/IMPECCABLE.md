# Impeccable (Claude Code design skill)

[Impeccable](https://github.com/pbakaus/impeccable) is installed as a
project-scoped Claude Code skill. It supplements the Vitest suite, the
Playwright journeys (`e2e/`) and the UX audit harness (`tests/ux-audit/`); it
replaces none of them.

## Governance

`PRODUCT.md` and `DESIGN.md` are authoritative and hand-maintained. Impeccable
may only **read** them.

- Never run `/impeccable init` or `/impeccable teach` (write `PRODUCT.md`),
  `/impeccable document` (generates `DESIGN.md`), or a redesign /
  replacement-visual-world flow (replaces `DESIGN.md`).
- Impeccable's aesthetic guidance does not override `DESIGN.md`: fonts, colors,
  tokens, 44px touch targets, the 390px mobile-first target, and the Bahasa
  Indonesia / English copy rules stay as documented.
- Detector, audit and critique output are suggestions for review. Any resulting
  app change is a separate, approved work item.
- Hooks stay off (see below).

Where this is enforced, in the order a Claude session meets it:

1. `CLAUDE.md`, "Impeccable design skill" — loaded into every session.
2. The "Dibayar project rules" block at the top of
   `.claude/skills/impeccable/SKILL.md` — loaded whenever the skill is invoked,
   ahead of upstream's own description of `init`, `document` and redesign.
3. The `impeccable-documenter` subagent is **not installed**. Upstream ships it
   to rewrite `DESIGN.md` after a build; this repository has no use for it, so
   its definition was removed rather than left available. Its inline fallback
   (`reference/degraded/documenter.md`) is prohibited by the `SKILL.md` block.

These are instructions to a model, not technical controls: nothing stops a
session from editing the two files. Review any diff that touches them.
`scripts/impeccable-launcher.test.mjs` fails if the `SKILL.md` block or the
`CLAUDE.md` pointer disappears or the documenter agent comes back.

## What is installed

| Item | Value |
|---|---|
| Skill version | 4.5.2 (`.claude/skills/impeccable/SKILL.md`) |
| Engine version | 0.1.14 (`.claude/skills/impeccable/scripts/VERSION`) |
| Source | npm `impeccable@4.5.2`; `github.com/pbakaus/impeccable`, tags `skill-v4.5.2`, `cli-v4.5.2`, `engine-v0.1.14` |
| Install method | Upstream CLI installer, Claude provider, project scope, run by Chris from the repo root |
| Installed on | 2026-10-10 |

Committed: `.claude/skills/impeccable/` (skill manifest, `reference/*.md`,
launchers, live-mode browser scripts, font index, trust manifest, license) and
three subagent definitions: `impeccable-asset-producer`,
`impeccable-finish-reviewer`, `impeccable-manual-edit-applier`.

Not committed: the ~20 MB engine binary
(`.claude/skills/impeccable/scripts/bin/`), `.claude/settings.local.json`, and
the ephemeral `.impeccable/` files listed in `.gitignore`.

`.claude/**` is excluded from ESLint: the vendored scripts are not project code.

### Local modifications to upstream files

| File | Change |
|---|---|
| `scripts/impeccable` | Rewritten: digest and version enforcement (below) |
| `scripts/impeccable.cmd` | Replaced by a stub that always exits 127 |
| `SKILL.md` | "Dibayar project rules" block inserted after the frontmatter; nothing else changed |
| `.claude/agents/impeccable-documenter.md` | Removed |
| `scripts/engine-digests.txt`, `LICENSE`, `NOTICE.md` | Added |

Every other vendored file is byte-identical to the installer's output,
including upstream's trailing whitespace in some `reference/*.md` files.

## License

Impeccable is Apache-2.0, Copyright 2025 Paul Bakaus.

- `.claude/skills/impeccable/LICENSE` is the `LICENSE` file from the npm
  tarball `impeccable@4.5.2`; it is the same Git blob
  (`bb3f6d23b1f8025514a62a12b51b47d73e3c9aa9`) as `LICENSE` at upstream tags
  `skill-v4.5.2` and `cli-v4.5.2`.
- `.claude/skills/impeccable/NOTICE.md` is `NOTICE.md` at those tags (blob
  `0468271c904ae334cfaf27da6f8df3d5f419a1f0`). It attributes
  `reference/ios.md` and `reference/android.md` to ehmo's
  `platform-design-skills` (MIT).
- The modified files above carry a notice of the change, as Apache-2.0 §4(b)
  asks.

Not resolved: `scripts/modern-screenshot.umd.js` is a minified third-party
library that upstream ships with no license header and does not list in
`NOTICE.md`. Its license was not established here. This is not legal advice;
if this repository is ever redistributed outside the team, have that checked.

## Engine trust

The skill's commands run a compiled engine binary through the launcher
`.claude/skills/impeccable/scripts/impeccable`. The launcher runs a binary only
when both hold:

1. its SHA-256 equals the entry in `scripts/engine-digests.txt` for the engine
   version in `scripts/VERSION` and the current platform;
2. it then answers `engine-probe` with exactly `impeccable-engine <that version>`.

This applies to every place a binary can come from: `IMPECCABLE_BIN`, the
bundled `scripts/bin/<platform>/impeccable`, the cache
`~/.impeccable/bin/<version>/impeccable`, the unversioned
`~/.impeccable/bin/impeccable`, `impeccable` on `PATH`, and a fresh download.
Nothing is executed, not even for the probe, before its digest has matched. A
download is checked against the committed digest only; the release's `.sha256`
file is not consulted, and `IMPECCABLE_DOWNLOAD_BASE` cannot substitute a
different binary. A missing manifest, a platform with no entry, a missing
`sha256sum`/`shasum`, or a mismatching `IMPECCABLE_BIN` stops the launcher with
exit 127.

### Digest coverage

| Platform | In manifest | How established | Run here |
|---|---|---|---|
| linux-x64 | yes | npm package binary = GitHub release asset digest | yes |
| linux-arm64 | yes | same comparison | no |
| darwin-arm64 | yes | same comparison | no (launcher logic simulated in tests) |
| darwin-x64 | yes | same comparison | no |
| windows-x64 | **no** | same comparison agreed on `38e09451694973ba664a24e67e1502a6913e6d0e533a0a5ae1e04c5963a804b1`, but not enabled | no |
| anything else | no | — | — |

"Same comparison" means: on 2026-10-10 the binary inside
`@impeccable/cli-<platform>@0.1.14` (fetched with `npm pack --ignore-scripts`
and hashed locally) matched the SHA-256 GitHub reports for the corresponding
asset of release `engine-v0.1.14`, published by `github-actions[bot]`.

What this does and does not give you:

- It pins the exact bytes that were compared. A later replacement of the
  release asset, the npm package, the cache or a `PATH` binary is refused.
- It is **not** an audit. The engine is a stripped binary; what it does, and
  whether it sends anything anywhere, has not been analysed. Both channels
  belong to the same publisher, so a publisher who shipped something unwanted
  in 0.1.14 from the start would pass this check.
- Verification and execution are two steps; a process that can rewrite the
  binary between them (same user, same machine) is out of scope.

### Windows

`scripts/impeccable.cmd` is a stub that prints why and exits 127. The checks
above have not been ported to `cmd.exe` because they could not be run or tested
on Windows. On Windows, use WSL.

### Trusting an engine binary (new platform or new version)

1. Fetch the binary from two channels without running it:
   `npm pack @impeccable/cli-<platform>@<version> --ignore-scripts` and the
   asset digest from
   `gh api repos/pbakaus/impeccable/releases/tags/engine-v<version>`.
2. Hash the npm binary (`sha256sum`) and confirm it equals the release digest.
3. Add `<version> <platform> <sha256>` to `scripts/engine-digests.txt` in a
   reviewed PR. For a new version, replace all entries and update
   `scripts/VERSION`.
4. For Windows, additionally write and test a `cmd.exe` launcher with the same
   two checks on a real Windows machine before adding a `windows-*` entry.

## Hooks: off

No hook manifest was written by the install (verified: no
`.claude/settings.local.json` hook entry and no `.impeccable/` config), so
nothing runs automatically. Upstream's Claude Code hook lives in the
machine-local `.claude/settings.local.json` and runs the engine after every UI
file edit and on Stop, for every session in that checkout, independent of tool
approval. Enabling it is a decision for Chris, per machine; review
`.claude/skills/impeccable/reference/hooks.md` and back up
`.claude/settings.local.json` first.

## Use

Reload Claude Code after pulling this change, then `/impeccable` shows a menu.
Read-only commands suited to this repo: `/impeccable audit <target>` and
`/impeccable critique <target>`.

Deterministic detector (no LLM), through the checked launcher:

```bash
.claude/skills/impeccable/scripts/impeccable detect --json src/
```

Exit `0` = no primary findings, `2` = findings (not a failure), `1` = a target
could not be scanned, `127` = the launcher refused to run an engine.

`npx impeccable ...` bypasses the launcher and its checks: npm resolves and runs
whatever the registry serves. Prefer the launcher.

## Tests

`npm run test:impeccable-launcher` (also a CI step) exercises the launcher with
mock engines in a throwaway HOME and PATH: no network, no real engine, no real
cache. It covers accept / tampered / wrong-version for each of the five
candidate locations, download substitution, manifest and VERSION failures,
missing hash tool, unsupported platforms, a simulated macOS run, the Windows
stub, and the governance guards.

## Update

`npx impeccable update` rewrites the skill directory: it restores the unchecked
upstream launchers, removes the `SKILL.md` rules block and reinstalls the
documenter agent. `npm run test:impeccable-launcher` fails until that is put
right. Do an update on a `chore/*` branch and, before committing:

1. Re-apply the local modifications listed above.
2. Re-establish digests for the new engine version ("Trusting an engine
   binary").
3. Refresh `LICENSE` and `NOTICE.md` from the new upstream tag.
4. Re-read the new `SKILL.md` and `reference/` for new ways to write
   `PRODUCT.md` / `DESIGN.md`, and extend the rules block if needed.
5. Update the versions in this file.
