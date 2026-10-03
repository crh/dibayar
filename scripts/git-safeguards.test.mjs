// Tests for the protected-branch pre-push guard (.githooks/pre-push) and its
// installer (scripts/git-safeguards/install-hooks.sh). Every push here goes to
// a throwaway local bare repository; nothing touches GitHub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const hookPath = join(here, "..", ".githooks", "pre-push");
const installer = join(here, "git-safeguards", "install-hooks.sh");

const ZERO = "0".repeat(40);
const A = "a".repeat(40);
const B = "b".repeat(40);

// Isolated from the developer's global/system git config and identity.
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
  GIT_TERMINAL_PROMPT: "0",
};

function runHook(shell, stdin, args = ["origin", "git@example.invalid:x/y.git"]) {
  return spawnSync(shell, [hookPath, ...args], { input: stdin, encoding: "utf8", env: gitEnv });
}

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: gitEnv });
}

function gitOk(cwd, ...args) {
  const r = git(cwd, ...args);
  assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function install(repo, ...flags) {
  return spawnSync("bash", [installer, "--repo", repo, ...flags], { encoding: "utf8", env: gitEnv });
}

// Clone of a bare "origin" that already has main + staging (seeded before any hook exists).
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "dibayar-hooks-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  gitOk(root, "init", "--quiet", "--bare", "-b", "main", remote);
  gitOk(root, "init", "--quiet", "-b", "main", work);
  writeFileSync(join(work, "f.txt"), "one\n");
  gitOk(work, "add", "f.txt");
  gitOk(work, "commit", "--quiet", "-m", "one");
  gitOk(work, "remote", "add", "origin", remote);
  gitOk(work, "push", "--quiet", "origin", "main", "main:staging");
  return { root, remote, work };
}

const remoteSha = (remote, ref) => git(remote, "rev-parse", "--verify", "--quiet", ref).stdout.trim();

// ---- Synthetic pre-push input, under both POSIX sh (dash on Ubuntu) and bash.
const BLOCKED = [
  ["direct fast-forward push to main", `refs/heads/main ${A} refs/heads/main ${B}\n`],
  ["direct push to staging", `refs/heads/staging ${A} refs/heads/staging ${B}\n`],
  ["force-update of main from another local ref", `refs/heads/topic ${A} refs/heads/main ${B}\n`],
  ["(re)creation of staging", `refs/heads/topic ${A} refs/heads/staging ${ZERO}\n`],
  ["deletion of main", `(delete) ${ZERO} refs/heads/main ${B}\n`],
  ["deletion of staging", `(delete) ${ZERO} refs/heads/staging ${B}\n`],
  ["zero local sha without (delete) marker", `refs/heads/x ${ZERO} refs/heads/staging ${B}\n`],
  ["protected ref among allowed refs", `refs/heads/f ${A} refs/heads/feature/f ${ZERO}\nrefs/heads/f ${A} refs/heads/main ${B}\n`],
  ["sha256 repository push to main", `refs/heads/main ${"c".repeat(64)} refs/heads/main ${"d".repeat(64)}\n`],
];
const ALLOWED = [
  ["normal feature push", `refs/heads/feature/x ${A} refs/heads/feature/x ${ZERO}\n`],
  ["fix/chore update", `refs/heads/chore/y ${A} refs/heads/chore/y ${B}\n`],
  ["short-lived branch deletion", `(delete) ${ZERO} refs/heads/feature/x ${B}\n`],
  ["similarly named feature/main-cleanup", `refs/heads/feature/main-cleanup ${A} refs/heads/feature/main-cleanup ${ZERO}\n`],
  ["similarly named staging-test", `refs/heads/staging-test ${A} refs/heads/staging-test ${ZERO}\n`],
  ["similarly named main-backup and staging/old", `refs/heads/a ${A} refs/heads/main-backup ${ZERO}\nrefs/heads/b ${A} refs/heads/staging/old ${ZERO}\n`],
  ["tag named main", `refs/tags/main ${A} refs/tags/main ${ZERO}\n`],
  ["empty input (nothing to push)", ""],
];
const MALFORMED = [
  ["too few fields", `refs/heads/main ${A} refs/heads/main\n`],
  ["too many fields", `refs/heads/x ${A} refs/heads/x ${ZERO} extra\n`],
  ["non-hex sha", `refs/heads/x ${"z".repeat(40)} refs/heads/x ${ZERO}\n`],
  ["short sha", `refs/heads/x abc123 refs/heads/x ${ZERO}\n`],
  ["unqualified remote ref", `refs/heads/x ${A} main ${B}\n`],
  ["whitespace-only line", "   \n"],
];

for (const shell of ["sh", "bash"]) {
  for (const [name, input] of BLOCKED) {
    test(`[${shell}] blocks ${name}`, () => {
      const r = runHook(shell, input);
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /BLOCKED/);
      assert.match(r.stderr, /open a PR|gh pr create/);
    });
  }
  for (const [name, input] of ALLOWED) {
    test(`[${shell}] allows ${name}`, () => {
      const r = runHook(shell, input);
      assert.equal(r.status, 0, r.stderr);
    });
  }
  for (const [name, input] of MALFORMED) {
    test(`[${shell}] fails safe on malformed input: ${name}`, () => {
      const r = runHook(shell, input);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /refusing push/);
    });
  }
}

test("deletion message names the action", () => {
  const r = runHook("sh", `(delete) ${ZERO} refs/heads/staging ${B}\n`, ["backup", "/x"]);
  assert.match(r.stderr, /BLOCKED DELETE of protected branch 'staging' on remote 'backup'/);
});

// ---- Real git pushes against a local bare remote, through the installer.
test("installed hook blocks real pushes to main/staging and allows feature work", () => {
  const { root, remote, work } = fixture();
  try {
    const inst = install(work);
    assert.equal(inst.status, 0, inst.stdout + inst.stderr);
    const mainBefore = remoteSha(remote, "refs/heads/main");
    const stagingBefore = remoteSha(remote, "refs/heads/staging");

    writeFileSync(join(work, "f.txt"), "two\n");
    gitOk(work, "commit", "--quiet", "-am", "two");

    const direct = git(work, "push", "origin", "HEAD:main");
    assert.notEqual(direct.status, 0);
    assert.match(direct.stderr, /BLOCKED UPDATE/);
    assert.notEqual(git(work, "push", "origin", "HEAD:refs/heads/staging").status, 0);
    assert.notEqual(git(work, "push", "--force", "origin", "HEAD:staging").status, 0);
    assert.notEqual(git(work, "push", "--force-with-lease", "origin", "HEAD:main").status, 0);
    const del = git(work, "push", "origin", "--delete", "staging");
    assert.notEqual(del.status, 0);
    assert.match(del.stderr, /BLOCKED DELETE/);
    assert.notEqual(git(work, "push", "origin", ":main").status, 0);
    assert.equal(remoteSha(remote, "refs/heads/main"), mainBefore);
    assert.equal(remoteSha(remote, "refs/heads/staging"), stagingBefore);

    gitOk(work, "push", "--quiet", "origin", "HEAD:refs/heads/feature/main-cleanup");
    gitOk(work, "push", "--quiet", "origin", "HEAD:refs/heads/staging-test");
    gitOk(work, "push", "--quiet", "--force", "origin", "HEAD~1:refs/heads/staging-test");
    gitOk(work, "push", "--quiet", "origin", "--delete", "feature/main-cleanup", "staging-test");
    assert.equal(remoteSha(remote, "refs/heads/feature/main-cleanup"), "");

    // A worktree on a branch that predates .githooks/ is still covered,
    // because the hook lives in the shared common hooks directory.
    const wt = join(root, "wt");
    gitOk(work, "worktree", "add", "--quiet", "-b", "old-branch", wt, "HEAD~1");
    assert.equal(existsSync(join(wt, ".githooks")), false);
    writeFileSync(join(wt, "f.txt"), "worktree\n");
    gitOk(wt, "commit", "--quiet", "-am", "worktree change");
    const fromWorktree = git(wt, "push", "origin", "HEAD:main");
    assert.notEqual(fromWorktree.status, 0);
    assert.match(fromWorktree.stderr, /BLOCKED/);
    assert.equal(remoteSha(remote, "refs/heads/main"), mainBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- Installer behaviour.
test("installer is idempotent and --check reports state", () => {
  const { root, work } = fixture();
  try {
    assert.equal(install(work, "--check").status, 1, "missing before install");
    const first = install(work);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /installed at/);
    assert.match(first.stdout, /self-test passed/);
    const second = install(work);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /already installed and current/);
    assert.equal(install(work, "--check").status, 0);

    const target = join(work, ".git", "hooks", "pre-push");
    writeFileSync(target, readFileSync(target, "utf8") + "\n# local drift\n");
    assert.equal(install(work, "--check").status, 1, "stale managed hook detected");
    const upd = install(work);
    assert.equal(upd.status, 0);
    assert.match(upd.stdout, /updated at/);
    assert.equal(readFileSync(target, "utf8"), readFileSync(hookPath, "utf8"));
    assert.equal(git(work, "config", "--get", "core.hooksPath").status, 1, "core.hooksPath untouched");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installer refuses when core.hooksPath is already configured", () => {
  const { root, work } = fixture();
  try {
    gitOk(work, "config", "--local", "core.hooksPath", "custom-hooks");
    const r = install(work);
    assert.equal(r.status, 3);
    assert.match(r.stderr, /CONFLICT — core.hooksPath/);
    assert.equal(gitOk(work, "config", "--get", "core.hooksPath"), "custom-hooks");
    assert.equal(existsSync(join(work, ".git", "hooks", "pre-push")), false);
    assert.equal(existsSync(join(work, "custom-hooks")), false);
    assert.equal(install(work, "--check").status, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installer never replaces a foreign pre-push hook without --chain-existing", () => {
  const { root, remote, work } = fixture();
  try {
    const hooks = join(work, ".git", "hooks");
    const marker = join(root, "custom-hook-ran");
    const custom = `#!/bin/sh\ncat >/dev/null\necho ran >> "${marker}"\nexit 0\n`;
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, "pre-push"), custom);
    chmodSync(join(hooks, "pre-push"), 0o755);

    const refused = install(work);
    assert.equal(refused.status, 3);
    assert.match(refused.stderr, /not installed by\s+this script/);
    assert.equal(readFileSync(join(hooks, "pre-push"), "utf8"), custom);

    const chained = install(work, "--chain-existing");
    assert.equal(chained.status, 0, chained.stderr);
    assert.equal(readFileSync(join(hooks, "pre-push.local"), "utf8"), custom);
    assert.equal(install(work, "--check").status, 0);

    // Protected push of a new commit: blocked before the chained hook runs.
    writeFileSync(join(work, "f.txt"), "chained\n");
    gitOk(work, "commit", "--quiet", "-am", "chained");
    assert.notEqual(git(work, "push", "origin", "HEAD:main").status, 0);
    assert.equal(existsSync(marker), false);
    // Ordinary push: guard passes, chained custom hook still runs.
    gitOk(work, "push", "--quiet", "origin", "HEAD:refs/heads/feature/chained");
    assert.equal(readFileSync(marker, "utf8"), "ran\n");
    assert.notEqual(remoteSha(remote, "refs/heads/feature/chained"), "");

    // A second foreign hook cannot clobber the preserved pre-push.local.
    writeFileSync(join(hooks, "pre-push"), custom);
    const again = install(work, "--chain-existing");
    assert.equal(again.status, 3);
    assert.match(again.stderr, /pre-push.local already exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failing chained hook still fails the push", () => {
  const { root, work } = fixture();
  try {
    const hooks = join(work, ".git", "hooks");
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, "pre-push"), "#!/bin/sh\nexit 7\n");
    chmodSync(join(hooks, "pre-push"), 0o755);
    assert.equal(install(work, "--chain-existing").status, 0);
    assert.notEqual(git(work, "push", "origin", "HEAD:refs/heads/feature/x").status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
