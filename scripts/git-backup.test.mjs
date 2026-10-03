// Tests for scripts/git-backup/dibayar-git-backup.sh against a disposable local
// "remote" repository. Linux-only (the backup runs on the ALPHA host); skipped
// elsewhere. No network access and nothing outside a temp directory is touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync,
  statSync, chmodSync, cpSync, truncateSync, rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "git-backup", "dibayar-git-backup.sh");
const linux = process.platform === "linux";

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
};

function gitOk(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: gitEnv });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "dibayar-backup-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  const backupRoot = join(root, "backup");
  gitOk(root, "init", "--quiet", "--bare", "-b", "main", remote);
  gitOk(root, "init", "--quiet", "-b", "main", work);
  writeFileSync(join(work, "f.txt"), "one\n");
  gitOk(work, "add", "f.txt");
  gitOk(work, "commit", "--quiet", "-m", "one");
  gitOk(work, "tag", "v0.1.0");
  writeFileSync(join(work, "f.txt"), "two\n");
  gitOk(work, "commit", "--quiet", "-am", "two");
  gitOk(work, "remote", "add", "origin", remote);
  gitOk(work, "push", "--quiet", "origin", "main", "main:staging", "HEAD~1:refs/heads/feature/x", "--tags");
  return { root, remote, work, backupRoot };
}

function backup(ctx, args, extraEnv = {}) {
  return spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      ...gitEnv,
      DIBAYAR_BACKUP_ROOT: ctx.backupRoot,
      DIBAYAR_BACKUP_REMOTE_URL: ctx.remote,
      DIBAYAR_BACKUP_MIN_FREE_MB: "1",
      DIBAYAR_BACKUP_FETCH_ATTEMPTS: "1",
      ...extraEnv,
    },
  });
}

const run = (ctx, ts, env = {}) => backup(ctx, ["run"], { DIBAYAR_BACKUP_TIMESTAMP: ts, ...env });
const snaps = (ctx) => readdirSync(join(ctx.backupRoot, "snapshots")).sort();
const manifest = (ctx, ts) => readFileSync(join(ctx.backupRoot, "snapshots", ts, "manifest.txt"), "utf8");
const refFrom = (text, ref) => text.match(new RegExp(`^ref ${ref} ([0-9a-f]+)$`, "m"))?.[1];
const lastSuccess = (ctx) => readFileSync(join(ctx.backupRoot, "LAST_SUCCESS"), "utf8").trim();
// Snapshot directories are read-only (0500) by design.
function cleanup(ctx) {
  spawnSync("chmod", ["-R", "u+w", ctx.root]);
  rmSync(ctx.root, { recursive: true, force: true });
}

const mode = (p) => (statSync(p).mode & 0o777).toString(8);

test("publishes a verified, immutable snapshot with manifest and checksum", { skip: !linux }, () => {
  const ctx = setup();
  try {
    const r = run(ctx, "20260101T030000Z");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(snaps(ctx), ["20260101T030000Z"]);
    const dir = join(ctx.backupRoot, "snapshots", "20260101T030000Z");
    const m = manifest(ctx, "20260101T030000Z");
    assert.match(m, /^status: success$/m);
    assert.match(m, /^bundle_verify: ok$/m);
    assert.match(m, /^restore_check: ok$/m);
    assert.equal(refFrom(m, "refs/heads/main"), gitOk(ctx.remote, "rev-parse", "main"));
    assert.equal(refFrom(m, "refs/heads/staging"), gitOk(ctx.remote, "rev-parse", "staging"));
    assert.ok(refFrom(m, "refs/tags/v0.1.0"));
    assert.ok(refFrom(m, "refs/heads/feature/x"));
    assert.match(readFileSync(join(dir, "SHA256SUMS"), "utf8"), /^[0-9a-f]{64} {2}dibayar-20260101T030000Z\.bundle$/m);
    assert.equal(lastSuccess(ctx), "20260101T030000Z");
    assert.equal(mode(ctx.backupRoot), "700");
    assert.equal(mode(dir), "500");
    assert.equal(mode(join(dir, "manifest.txt")), "400");
    const okLog = readFileSync(join(ctx.backupRoot, "logs", "20260101T030000Z.ok.log"), "utf8");
    assert.match(okLog, /PUBLISHED snapshot/);
    assert.match(okLog, /run 20260101T030000Z OK\n$/, "log is complete through the final line");
    assert.deepEqual(readdirSync(join(ctx.backupRoot, "logs")), ["20260101T030000Z.ok.log"]);
    // The mirror can never push.
    assert.equal(gitOk(join(ctx.backupRoot, "mirror.git"), "config", "remote.origin.pushurl"), "PUSH-DISABLED-read-only-backup-mirror");

    const v = backup(ctx, ["verify"]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.match(v.stdout + v.stderr, /restored staging = [0-9a-f]{40} \(matches manifest\)/);
    assert.equal(backup(ctx, ["status"]).status, 0);
  } finally {
    cleanup(ctx);
  }
});

test("older snapshot survives a force-update and branch deletion upstream", { skip: !linux }, () => {
  const ctx = setup();
  try {
    assert.equal(run(ctx, "20260101T030000Z").status, 0);
    const oldStaging = gitOk(ctx.remote, "rev-parse", "staging");

    // Rewrite staging upstream and delete a feature branch.
    gitOk(ctx.work, "checkout", "--quiet", "--orphan", "rewrite");
    writeFileSync(join(ctx.work, "f.txt"), "rewritten\n");
    gitOk(ctx.work, "commit", "--quiet", "-am", "rewritten history");
    gitOk(ctx.work, "push", "--quiet", "--force", "origin", "rewrite:staging", ":feature/x");
    const newStaging = gitOk(ctx.remote, "rev-parse", "staging");
    assert.notEqual(newStaging, oldStaging);

    const r = run(ctx, "20260102T030000Z");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(refFrom(manifest(ctx, "20260102T030000Z"), "refs/heads/staging"), newStaging);
    assert.equal(refFrom(manifest(ctx, "20260102T030000Z"), "refs/heads/feature/x"), undefined, "mirror pruned");

    // The first snapshot is untouched and still restores the old history.
    assert.equal(refFrom(manifest(ctx, "20260101T030000Z"), "refs/heads/staging"), oldStaging);
    const v = backup(ctx, ["verify", "20260101T030000Z"]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.match(v.stdout + v.stderr, new RegExp(`restored staging = ${oldStaging}`));
  } finally {
    cleanup(ctx);
  }
});

test("retention removes only the oldest snapshots, after a new one is published", { skip: !linux }, () => {
  const ctx = setup();
  const low = { DIBAYAR_BACKUP_KEEP: "2", DIBAYAR_BACKUP_ALLOW_LOW_KEEP: "1" };
  try {
    for (const ts of ["20260101T030000Z", "20260102T030000Z", "20260103T030000Z"]) {
      assert.equal(run(ctx, ts, low).status, 0);
    }
    assert.deepEqual(snaps(ctx), ["20260102T030000Z", "20260103T030000Z"]);

    // A failed run must not trigger retention.
    gitOk(ctx.work, "push", "--quiet", "origin", ":staging");
    const failed = run(ctx, "20260104T030000Z", low);
    assert.notEqual(failed.status, 0);
    assert.deepEqual(snaps(ctx), ["20260102T030000Z", "20260103T030000Z"]);
  } finally {
    cleanup(ctx);
  }
});

test("missing required branch fails without publishing and keeps the failure log", { skip: !linux }, () => {
  const ctx = setup();
  try {
    assert.equal(run(ctx, "20260101T030000Z").status, 0);
    gitOk(ctx.work, "push", "--quiet", "origin", ":staging");
    const r = run(ctx, "20260102T030000Z");
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /required branch 'staging' missing/);
    assert.deepEqual(snaps(ctx), ["20260101T030000Z"], "no partial or failed snapshot published");
    assert.equal(lastSuccess(ctx), "20260101T030000Z");
    const logs = readdirSync(join(ctx.backupRoot, "logs"));
    assert.ok(logs.includes("20260102T030000Z.FAILED.log"), logs.join(","));
    const failedLog = readFileSync(join(ctx.backupRoot, "logs", "20260102T030000Z.FAILED.log"), "utf8");
    assert.match(failedLog, /required branch 'staging' missing/);
    assert.match(failedLog, /RUN FAILED \(exit 1\); no snapshot published/);
    // A later successful run with shorter retention never deletes failure logs.
    gitOk(ctx.work, "push", "--quiet", "origin", "main:staging");
    assert.equal(run(ctx, "20260103T030000Z").status, 0);
    assert.ok(readdirSync(join(ctx.backupRoot, "logs")).includes("20260102T030000Z.FAILED.log"));
  } finally {
    cleanup(ctx);
  }
});

test("low disk space fails before touching existing snapshots", { skip: !linux }, () => {
  const ctx = setup();
  const low = { DIBAYAR_BACKUP_KEEP: "1", DIBAYAR_BACKUP_ALLOW_LOW_KEEP: "1" };
  try {
    assert.equal(run(ctx, "20260101T030000Z", low).status, 0);
    const r = run(ctx, "20260102T030000Z", { ...low, DIBAYAR_BACKUP_MIN_FREE_MB: "999999999" });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /MB free/);
    assert.deepEqual(snaps(ctx), ["20260101T030000Z"]);
  } finally {
    cleanup(ctx);
  }
});

test("refuses retention below the 30-snapshot policy without an explicit override", { skip: !linux }, () => {
  const ctx = setup();
  try {
    const r = run(ctx, "20260101T030000Z", { DIBAYAR_BACKUP_KEEP: "5" });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /below the 30-snapshot policy minimum/);
    assert.equal(existsSync(join(ctx.backupRoot, "snapshots", "20260101T030000Z")), false);
  } finally {
    cleanup(ctx);
  }
});

test("an interrupted run's incomplete directory is never counted and is cleaned up", { skip: !linux }, () => {
  const ctx = setup();
  try {
    assert.equal(run(ctx, "20260101T030000Z").status, 0);
    const stale = join(ctx.backupRoot, "snapshots", ".incomplete-20260101T120000Z");
    mkdirSync(stale);
    writeFileSync(join(stale, "partial.bundle"), "partial");
    assert.match(backup(ctx, ["status"]).stdout, /1 successful/);
    assert.equal(run(ctx, "20260102T030000Z").status, 0);
    assert.equal(existsSync(stale), false);
    assert.deepEqual(snaps(ctx), ["20260101T030000Z", "20260102T030000Z"]);
  } finally {
    cleanup(ctx);
  }
});

test("verify detects a corrupted or truncated bundle", { skip: !linux }, () => {
  const ctx = setup();
  try {
    assert.equal(run(ctx, "20260101T030000Z").status, 0);
    const snapRoot = join(ctx.backupRoot, "snapshots");

    // Flipped bytes: caught by the checksum.
    const flipped = join(snapRoot, "20260101T040000Z");
    cpSync(join(snapRoot, "20260101T030000Z"), flipped, { recursive: true });
    chmodSync(flipped, 0o700);
    const fb = join(flipped, "dibayar-20260101T030000Z.bundle");
    chmodSync(fb, 0o600);
    const buf = readFileSync(fb);
    buf[buf.length - 30] ^= 0xff;
    writeFileSync(fb, buf);
    const v1 = backup(ctx, ["verify", "20260101T040000Z"]);
    assert.notEqual(v1.status, 0);
    assert.match(v1.stdout + v1.stderr, /SHA-256 mismatch|FAILED verification/);

    // Truncated with a recomputed checksum: caught by git itself.
    const trunc = join(snapRoot, "20260101T050000Z");
    cpSync(join(snapRoot, "20260101T030000Z"), trunc, { recursive: true });
    chmodSync(trunc, 0o700);
    const tb = join(trunc, "dibayar-20260101T030000Z.bundle");
    chmodSync(tb, 0o600);
    truncateSync(tb, Math.floor(statSync(tb).size / 2));
    chmodSync(join(trunc, "SHA256SUMS"), 0o600);
    const sum = spawnSync("sha256sum", ["dibayar-20260101T030000Z.bundle"], { cwd: trunc, encoding: "utf8" }).stdout;
    writeFileSync(join(trunc, "SHA256SUMS"), sum);
    const v2 = backup(ctx, ["verify", "20260101T050000Z"]);
    assert.notEqual(v2.status, 0);
    assert.match(v2.stdout + v2.stderr, /FAILED verification/);

    // The original is still good.
    assert.equal(backup(ctx, ["verify", "20260101T030000Z"]).status, 0);
  } finally {
    cleanup(ctx);
  }
});
