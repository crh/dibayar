#!/usr/bin/env node
// Preflight + wrapper for a future unattended Hermes/Claude cron execution.
// Fails closed before running any child command if the repo or the daily
// rubric evidence is unsafe. Node stdlib only; no shell interpolation.
//
// Usage:
//   node scripts/cron-guard.mjs [--repo <path>] [--date YYYY-MM-DD]
//     [--expected-branch <branch>] --check-only
//   node scripts/cron-guard.mjs [--repo <path>] [--date YYYY-MM-DD]
//     [--expected-branch <branch>] -- <command> [args...]
//
// This script does not fetch, push, deploy, touch a database, or schedule
// cron. It only inspects local git refs and two tracked docs files.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_EXPECTED_BRANCH = "hermes/m2-invoice";
export const REQUIRED_DIMENSIONS = [
  "evidence honesty",
  "shipped completeness",
  "security discipline",
  "focus",
  "deploy health",
  "report quality",
];
export const STATE_MD_MAX_LINES = 120;
export const RUBRIC_TOTAL_MINIMUM = 10;

export function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// A safe-enough git ref/branch shape: no leading dash (flag injection), no
// whitespace, no "..", no shell metacharacters. Only exercised for the
// explicit --expected-branch override (default is hardcoded, never argv).
export function isValidBranchName(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)) return false;
  if (value.includes("..") || value.includes("//")) return false;
  return true;
}

export function jakartaDateToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function runGit(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    error: result.error,
  };
}

function splitTopLevel(text, delimiter) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

// Parses one DAILY_LOG.md "## ..." section body for its rubric self-score
// line. Pure function of text, exported for direct unit testing.
export function parseRubricSection(sectionText) {
  const lineMatch = sectionText.match(/Rubric self-score:\s*(.+)/);
  if (!lineMatch) {
    return { parseable: false, reason: 'no "Rubric self-score:" line found' };
  }
  const scoreText = lineMatch[1];

  const totalIdx = scoreText.search(/\bTotal\s+\d+\s*\/\s*12\b/i);
  if (totalIdx === -1) {
    return { parseable: false, reason: "no Total x/12 found" };
  }
  const totalMatch = scoreText.slice(totalIdx).match(/Total\s+(\d+)\s*\/\s*12/i);
  const total = Number.parseInt(totalMatch[1], 10);
  const dimensionsText = scoreText.slice(0, totalIdx);

  const clauses = splitTopLevel(dimensionsText, ";").map((c) => c.trim()).filter(Boolean);

  const found = new Map(); // normalized name -> array of {raw, score, valid}
  for (const clause of clauses) {
    const m = clause.match(/^([A-Za-z][A-Za-z ]*?)\s+(\d+)\s*\/\s*(\d+)\b/);
    if (!m) continue; // not a scored clause; ignore
    const name = m[1].trim().toLowerCase().replace(/\s+/g, " ");
    const numerator = Number.parseInt(m[2], 10);
    const denominator = Number.parseInt(m[3], 10);
    const valid = denominator === 2 && Number.isInteger(numerator) && numerator >= 0 && numerator <= 2;
    if (!found.has(name)) found.set(name, []);
    found.get(name).push({ score: numerator, valid });
  }

  const missing = [];
  const duplicate = [];
  const malformed = [];
  const dimensions = {};

  for (const dim of REQUIRED_DIMENSIONS) {
    const entries = found.get(dim);
    if (!entries || entries.length === 0) {
      missing.push(dim);
      continue;
    }
    if (entries.length > 1) {
      duplicate.push(dim);
      continue;
    }
    const [entry] = entries;
    if (!entry.valid) {
      malformed.push(dim);
      continue;
    }
    dimensions[dim] = entry.score;
  }

  return {
    parseable: true,
    total,
    dimensions,
    missing,
    duplicate,
    malformed,
  };
}

// Finds the last "## ..." section whose header date matches `date`
// (YYYY-MM-DD), returns its body text or null if none found.
export function findLastSectionForDate(dailyLogText, date) {
  const lines = dailyLogText.split("\n");
  const headers = [];
  lines.forEach((line, idx) => {
    if (!/^##\s+/.test(line)) return;
    const dateMatch = line.match(/—\s*(\d{4}-\d{2}-\d{2})/);
    headers.push({ idx, date: dateMatch ? dateMatch[1] : null });
  });
  const matches = headers.filter((h) => h.date === date);
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const pos = headers.indexOf(last);
  const endIdx = pos + 1 < headers.length ? headers[pos + 1].idx : lines.length;
  return lines.slice(last.idx, endIdx).join("\n");
}

function addFailure(failures, rule, reason) {
  failures.push({ rule, reason });
}

export function runGuard({ repo, date, expectedBranch }) {
  const failures = [];
  const meta = {};

  if (!existsSync(repo) || !statSync(repo).isDirectory()) {
    addFailure(failures, "git-worktree", "--repo path does not exist or is not a directory");
    return { ready: false, failures, meta };
  }

  const isWorktree = runGit(repo, ["rev-parse", "--is-inside-work-tree"]);
  if (!isWorktree.ok || isWorktree.stdout !== "true") {
    addFailure(failures, "git-worktree", "repo path is not inside a git working tree");
    return { ready: false, failures, meta };
  }

  const toplevel = runGit(repo, ["rev-parse", "--show-toplevel"]);
  const repoRoot = toplevel.ok && toplevel.stdout ? toplevel.stdout : repo;

  const branchResult = runGit(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const currentBranch = branchResult.ok ? branchResult.stdout : null;
  if (currentBranch !== expectedBranch) {
    addFailure(
      failures,
      "expected-branch",
      `current branch does not match expected branch (expected "${expectedBranch}")`,
    );
  }
  meta.branch = currentBranch;

  const statusResult = runGit(repo, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const dirtyCount = statusResult.ok
    ? statusResult.stdout.split("\n").filter((l) => l.length > 0).length
    : null;
  if (!statusResult.ok || dirtyCount > 0) {
    addFailure(
      failures,
      "clean-working-tree",
      statusResult.ok
        ? `working tree has ${dirtyCount} uncommitted/untracked change(s)`
        : "unable to read working tree status",
    );
  }

  const headResult = runGit(repo, ["rev-parse", "HEAD"]);
  const originRefResult = runGit(repo, ["rev-parse", "refs/remotes/origin/" + expectedBranch]);
  if (!originRefResult.ok) {
    addFailure(
      failures,
      "head-matches-origin",
      `remote-tracking ref origin/${expectedBranch} not found locally (no implicit fetch performed)`,
    );
  } else if (!headResult.ok) {
    addFailure(failures, "head-matches-origin", "unable to resolve local HEAD");
  } else if (headResult.stdout !== originRefResult.stdout) {
    const counts = runGit(repo, [
      "rev-list",
      "--left-right",
      "--count",
      `refs/remotes/origin/${expectedBranch}...HEAD`,
    ]);
    let detail = "HEAD differs from origin";
    if (counts.ok) {
      const [behind, ahead] = counts.stdout.split(/\s+/);
      detail = `HEAD is ahead ${ahead} / behind ${behind} of origin/${expectedBranch}`;
    }
    addFailure(failures, "head-matches-origin", detail);
  }

  const statePath = resolve(repoRoot, "STATE.md");
  if (!existsSync(statePath)) {
    addFailure(failures, "state-md-exists", "STATE.md not found at repo root");
  } else {
    const stateLines = readFileSync(statePath, "utf8").split("\n");
    const lineCount = stateLines[stateLines.length - 1] === "" ? stateLines.length - 1 : stateLines.length;
    meta.stateMdLines = lineCount;
    if (lineCount > STATE_MD_MAX_LINES) {
      addFailure(
        failures,
        "state-md-max-120-lines",
        `STATE.md has ${lineCount} lines, exceeds ${STATE_MD_MAX_LINES}-line cap`,
      );
    }
  }

  const dailyLogPath = resolve(repoRoot, "DAILY_LOG.md");
  if (!existsSync(dailyLogPath)) {
    addFailure(failures, "daily-log-entry-found", "DAILY_LOG.md not found at repo root");
  } else {
    const dailyLogText = readFileSync(dailyLogPath, "utf8");
    const section = findLastSectionForDate(dailyLogText, date);
    if (section === null) {
      addFailure(failures, "daily-log-entry-found", `no DAILY_LOG rubric rollup entry found for date ${date}`);
    } else {
      const parsed = parseRubricSection(section);
      if (!parsed.parseable) {
        addFailure(failures, "daily-log-parseable", `DAILY_LOG entry for ${date}: ${parsed.reason}`);
      } else {
        const problems = [];
        if (parsed.missing.length > 0) problems.push(`missing dimension(s): ${parsed.missing.join(", ")}`);
        if (parsed.duplicate.length > 0) problems.push(`duplicate dimension(s): ${parsed.duplicate.join(", ")}`);
        if (parsed.malformed.length > 0) problems.push(`unparseable dimension score(s): ${parsed.malformed.join(", ")}`);
        if (problems.length > 0) {
          addFailure(failures, "daily-log-dimensions-complete", problems.join("; "));
        } else {
          const sum = Object.values(parsed.dimensions).reduce((a, b) => a + b, 0);
          meta.rubricTotal = parsed.total;
          meta.rubricSum = sum;
          if (sum !== parsed.total) {
            addFailure(
              failures,
              "daily-log-arithmetic-matches",
              `sum of dimension scores (${sum}) does not equal reported Total (${parsed.total})`,
            );
          }
          const zeroDims = REQUIRED_DIMENSIONS.filter((d) => parsed.dimensions[d] === 0);
          if (zeroDims.length > 0) {
            addFailure(
              failures,
              "daily-log-no-zero-dimension",
              `dimension(s) scored 0/2 (caps unattended execution regardless of total): ${zeroDims.join(", ")}`,
            );
          }
          if (parsed.total < RUBRIC_TOTAL_MINIMUM) {
            addFailure(
              failures,
              "daily-log-total-minimum-10",
              `Total ${parsed.total}/12 is below the minimum of ${RUBRIC_TOTAL_MINIMUM}`,
            );
          }
        }
      }
    }
  }

  return { ready: failures.length === 0, failures, meta };
}

function parseArgv(argv) {
  const opts = {
    repo: process.cwd(),
    date: null,
    expectedBranch: DEFAULT_EXPECTED_BRANCH,
    checkOnly: false,
    childCommand: null,
  };
  let i = 0;
  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      i++;
      break;
    }
    if (arg === "--repo") {
      opts.repo = argv[++i];
      if (opts.repo === undefined) throw new UsageError("--repo requires a value");
    } else if (arg === "--date") {
      opts.date = argv[++i];
      if (opts.date === undefined) throw new UsageError("--date requires a value");
      if (!isValidDateString(opts.date)) throw new UsageError("--date must be YYYY-MM-DD");
    } else if (arg === "--expected-branch") {
      opts.expectedBranch = argv[++i];
      if (opts.expectedBranch === undefined) throw new UsageError("--expected-branch requires a value");
      if (!isValidBranchName(opts.expectedBranch)) throw new UsageError("--expected-branch has an unsafe or invalid shape");
    } else if (arg === "--check-only") {
      opts.checkOnly = true;
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  if (!opts.checkOnly) {
    const rest = argv.slice(i);
    if (rest.length === 0) {
      throw new UsageError("a child command is required unless --check-only is set (use: -- <command> [args...])");
    }
    opts.childCommand = { command: rest[0], args: rest.slice(1) };
  }
  if (opts.repo === undefined) opts.repo = process.cwd();
  opts.repo = resolve(opts.repo);
  if (opts.date === null) opts.date = jakartaDateToday();
  return opts;
}

class UsageError extends Error {}

function printResult(result, date, expectedBranch) {
  if (result.ready) {
    console.log("READY");
    console.log(`  branch: matches expected ("${expectedBranch}")`);
    console.log(`  working tree: clean`);
    console.log(`  HEAD: matches origin/${expectedBranch}`);
    console.log(`  STATE.md: ${result.meta.stateMdLines} lines (<= ${STATE_MD_MAX_LINES})`);
    console.log(`  DAILY_LOG rubric (${date}): Total ${result.meta.rubricTotal}/12, all dimensions present and nonzero`);
  } else {
    console.log("BLOCKED");
    for (const f of result.failures) {
      console.log(`  [${f.rule}] ${f.reason}`);
    }
  }
}

function signalExitCode(signal) {
  const signals = { SIGINT: 2, SIGTERM: 15, SIGKILL: 9, SIGHUP: 1, SIGQUIT: 3 };
  return 128 + (signals[signal] ?? 1);
}

function main(argv) {
  let opts;
  try {
    opts = parseArgv(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`usage error: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }

  const result = runGuard({ repo: opts.repo, date: opts.date, expectedBranch: opts.expectedBranch });
  printResult(result, opts.date, opts.expectedBranch);

  if (!result.ready) {
    process.exit(1);
  }
  if (opts.checkOnly) {
    process.exit(0);
  }

  const child = spawnSync(opts.childCommand.command, opts.childCommand.args, { stdio: "inherit" });
  if (child.error) {
    console.error(`child command failed to start: ${child.error.message}`);
    process.exit(1);
  }
  if (child.signal) {
    process.exit(signalExitCode(child.signal));
  }
  process.exit(child.status ?? 1);
}

const isDirectRun = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main(process.argv.slice(2));
}
