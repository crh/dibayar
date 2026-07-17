import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runGuard,
  parseRubricSection,
  findLastSectionForDate,
  isValidDateString,
  isValidBranchName,
  jakartaDateToday,
  DEFAULT_EXPECTED_BRANCH,
} from "./cron-guard.mjs";

const GUARD_PATH = join(import.meta.dirname, "cron-guard.mjs");
const BRANCH = "test-branch";
const DATE = "2026-07-17";

const tmpDirs = [];
function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), "cron-guard-test-"));
  tmpDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const READY_SCORE =
  "- Rubric self-score: Evidence honesty 2/2 (ok); shipped completeness 2/2 (ok); " +
  "security discipline 2/2 (ok); Focus 2/2 (ok); deploy health 2/2 (ok); " +
  "report quality 2/2 (ok). Total 12/12 — good day.";

function dailyLogWithScore(date, scoreLine, title = "Task E test") {
  return `# DAILY_LOG.md\n\n## Day 1 ${title} — ${date}\n\n- did work\n${scoreLine}\n`;
}

function stateMd(lines = 5) {
  return Array.from({ length: lines }, (_, i) => `line ${i}`).join("\n") + "\n";
}

// Builds an isolated repo with a bare "origin" and a synced remote-tracking
// ref, so head-matches-origin checks are deterministic and network-free.
function setupRepo({
  branch = BRANCH,
  dirty = false,
  originSha = "same",
  skipOriginRef = false,
  stateLines = 5,
  dailyLog = dailyLogWithScore(DATE, READY_SCORE),
  omitState = false,
  omitDailyLog = false,
} = {}) {
  const repo = makeTmpDir();
  git(repo, ["init", "-q"]);
  git(repo, ["checkout", "-q", "-b", branch]);
  git(repo, ["config", "user.email", "test@example.local"]);
  git(repo, ["config", "user.name", "Test"]);

  if (!omitState) writeFileSync(join(repo, "STATE.md"), stateMd(stateLines));
  if (!omitDailyLog) writeFileSync(join(repo, "DAILY_LOG.md"), dailyLog);
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "initial"]);
  const firstSha = git(repo, ["rev-parse", "HEAD"]);

  const bareDir = makeTmpDir();
  const bareRepo = join(bareDir, "origin.git");
  git(bareDir, ["init", "-q", "--bare", bareRepo]);
  git(repo, ["remote", "add", "origin", bareRepo]);

  if (!skipOriginRef) {
    if (originSha === "same") {
      git(repo, ["update-ref", `refs/remotes/origin/${branch}`, firstSha]);
    } else if (originSha === "behind") {
      // origin has an older commit than local HEAD (local is ahead)
      writeFileSync(join(repo, "extra.txt"), "more\n");
      git(repo, ["add", "-A"]);
      git(repo, ["commit", "-q", "-m", "second"]);
      git(repo, ["update-ref", `refs/remotes/origin/${branch}`, firstSha]);
    }
  }

  if (dirty) {
    writeFileSync(join(repo, "untracked.txt"), "oops\n");
  }

  return repo;
}

test("fully READY repo passes all checks", () => {
  const repo = setupRepo();
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, true, JSON.stringify(result.failures));
  assert.equal(result.failures.length, 0);
  assert.equal(result.meta.rubricTotal, 12);
});

test("dirty working tree blocks", () => {
  const repo = setupRepo({ dirty: true });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "clean-working-tree"));
});

test("wrong branch blocks", () => {
  const repo = setupRepo();
  const result = runGuard({ repo, date: DATE, expectedBranch: "some-other-branch" });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "expected-branch"));
});

test("missing remote-tracking ref blocks", () => {
  const repo = setupRepo({ skipOriginRef: true });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "head-matches-origin"));
});

test("divergent/ahead HEAD vs origin blocks", () => {
  const repo = setupRepo({ originSha: "behind" });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  const f = result.failures.find((x) => x.rule === "head-matches-origin");
  assert.ok(f);
  assert.match(f.reason, /ahead/);
});

test("missing current-date rubric score blocks", () => {
  const repo = setupRepo({ dailyLog: dailyLogWithScore("2026-01-01", READY_SCORE) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "daily-log-entry-found"));
});

test("malformed dimension score blocks", () => {
  const badScore = READY_SCORE.replace("Evidence honesty 2/2", "Evidence honesty two/2");
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  const f = result.failures.find((x) => x.rule === "daily-log-dimensions-complete");
  assert.ok(f);
  assert.match(f.reason, /missing dimension.*evidence honesty/);
});

test("wrong-denominator dimension score is treated as malformed", () => {
  const badScore = READY_SCORE.replace("Focus 2/2", "Focus 2/3");
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  const f = result.failures.find((x) => x.rule === "daily-log-dimensions-complete");
  assert.ok(f);
  assert.match(f.reason, /unparseable dimension score.*focus/);
});

test("duplicate dimension blocks", () => {
  const badScore = READY_SCORE.replace(
    "Focus 2/2 (ok); deploy health",
    "Focus 2/2 (ok); Focus 1/2 (dup); deploy health",
  );
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  const f = result.failures.find((x) => x.rule === "daily-log-dimensions-complete");
  assert.ok(f);
  assert.match(f.reason, /duplicate dimension.*focus/);
});

test("missing dimension blocks", () => {
  const badScore = READY_SCORE.replace("Focus 2/2 (ok); ", "");
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  const f = result.failures.find((x) => x.rule === "daily-log-dimensions-complete");
  assert.ok(f);
  assert.match(f.reason, /missing dimension.*focus/);
});

test("arithmetic mismatch blocks", () => {
  const badScore = READY_SCORE.replace("Total 12/12", "Total 11/12");
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "daily-log-arithmetic-matches"));
});

test("total below 10 blocks", () => {
  const badScore =
    "- Rubric self-score: Evidence honesty 1/2 (ok); shipped completeness 1/2 (ok); " +
    "security discipline 1/2 (ok); Focus 2/2 (ok); deploy health 1/2 (ok); " +
    "report quality 1/2 (ok). Total 7/12 — acceptable.";
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "daily-log-total-minimum-10"));
});

test("total >= 10 with one dimension at 0 still blocks (zero caps the day)", () => {
  const badScore =
    "- Rubric self-score: Evidence honesty 2/2 (ok); shipped completeness 2/2 (ok); " +
    "security discipline 2/2 (ok); Focus 0/2 (drift); deploy health 2/2 (ok); " +
    "report quality 2/2 (ok). Total 10/12 — acceptable (Focus 0/2 caps the day at acceptable).";
  const repo = setupRepo({ dailyLog: dailyLogWithScore(DATE, badScore) });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  const f = result.failures.find((x) => x.rule === "daily-log-no-zero-dimension");
  assert.ok(f, JSON.stringify(result.failures));
  assert.match(f.reason, /focus/);
  // arithmetic is actually fine (10 == 10) and total >= 10; only the
  // zero-dimension rule should fire, not the arithmetic or minimum rules.
  assert.ok(!result.failures.some((x) => x.rule === "daily-log-arithmetic-matches"));
  assert.ok(!result.failures.some((x) => x.rule === "daily-log-total-minimum-10"));
});

test("missing STATE.md blocks", () => {
  const repo = setupRepo({ omitState: true });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "state-md-exists"));
});

test("STATE.md over 120 lines blocks", () => {
  const repo = setupRepo({ stateLines: 121 });
  const result = runGuard({ repo, date: DATE, expectedBranch: BRANCH });
  assert.equal(result.ready, false);
  assert.ok(result.failures.some((f) => f.rule === "state-md-max-120-lines"));
});

test("parseRubricSection is a pure function usable standalone", () => {
  const parsed = parseRubricSection(READY_SCORE);
  assert.equal(parsed.parseable, true);
  assert.equal(parsed.total, 12);
  assert.equal(Object.keys(parsed.dimensions).length, 6);
});

test("findLastSectionForDate picks the last matching section", () => {
  const text =
    `## Day 1 first — ${DATE}\n\nfirst body\n\n` +
    `## Day 1 second — ${DATE}\n\nsecond body\n`;
  const section = findLastSectionForDate(text, DATE);
  assert.match(section, /second body/);
  assert.doesNotMatch(section, /first body/);
});

test("isValidDateString rejects garbage and non-calendar dates", () => {
  assert.equal(isValidDateString("2026-07-17"), true);
  assert.equal(isValidDateString("2026-13-01"), false);
  assert.equal(isValidDateString("not-a-date"), false);
  assert.equal(isValidDateString("2026-02-30"), false);
});

test("isValidBranchName rejects unsafe shapes", () => {
  assert.equal(isValidBranchName("hermes/m2-invoice"), true);
  assert.equal(isValidBranchName("-rf"), false);
  assert.equal(isValidBranchName("has space"), false);
  assert.equal(isValidBranchName("has..dots"), false);
  assert.equal(isValidBranchName(""), false);
});

test("jakartaDateToday returns YYYY-MM-DD shape", () => {
  assert.match(jakartaDateToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test("default expected branch constant matches this repo's branch", () => {
  assert.equal(DEFAULT_EXPECTED_BRANCH, "hermes/m2-invoice");
});

// --- Wrapper (CLI) behavior ---

function runCli(args, options = {}) {
  return spawnSync("node", [GUARD_PATH, ...args], { encoding: "utf8", ...options });
}

test("wrapper: --check-only on a READY repo exits 0 and prints READY", () => {
  const repo = setupRepo();
  const result = runCli(["--repo", repo, "--date", DATE, "--expected-branch", BRANCH, "--check-only"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^READY/);
});

test("wrapper: --check-only on a blocked repo exits nonzero and prints BLOCKED", () => {
  const repo = setupRepo({ dirty: true });
  const result = runCli(["--repo", repo, "--date", DATE, "--expected-branch", BRANCH, "--check-only"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /^BLOCKED/);
  assert.match(result.stdout, /clean-working-tree/);
});

test("wrapper: missing child command without --check-only is a usage error", () => {
  const repo = setupRepo();
  const result = runCli(["--repo", repo, "--date", DATE, "--expected-branch", BRANCH]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage error/);
});

test("wrapper: blocked repo never invokes the child (sentinel not created)", () => {
  const repo = setupRepo({ dirty: true });
  const sentinel = join(repo, "sentinel-blocked.txt");
  const result = runCli([
    "--repo", repo,
    "--date", DATE,
    "--expected-branch", BRANCH,
    "--",
    "node", "-e", `require("fs").writeFileSync(${JSON.stringify(sentinel)}, "ran")`,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /^BLOCKED/);
  assert.equal(existsSync(sentinel), false);
});

test("wrapper: READY repo executes the child and propagates its nonzero exit code", () => {
  const repo = setupRepo();
  const sentinel = join(repo, "sentinel-ready.txt");
  const result = runCli([
    "--repo", repo,
    "--date", DATE,
    "--expected-branch", BRANCH,
    "--",
    "node", "-e", `require("fs").writeFileSync(${JSON.stringify(sentinel)}, "ran"); process.exit(7)`,
  ]);
  assert.equal(result.status, 7);
  assert.match(result.stdout, /^READY/);
  assert.equal(existsSync(sentinel), true);
});
