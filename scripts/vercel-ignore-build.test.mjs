import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(here, "vercel-ignore-build.sh");
const vercelJsonPath = join(here, "..", "vercel.json");

// Branches that must deploy / must never auto-deploy. Shared by the
// ignoreCommand (secondary) and git.deploymentEnabled (primary) tests below so
// the two layers cannot drift apart.
const DEPLOY_REFS = ["main", "staging", "preview/foo", "preview/hermes-1", "preview/codex/m4-invoiced-this-month"];
const CI_ONLY_REFS = [
  "feature/foo",
  "fix/bar",
  "chore/baz",
  "chore/workflow-ci-only-smoke",
  "fix/example",
  "feature/example",
  "codex/example",
  "codex/m4-invoiced-this-month",
  "hermes/example",
  "hermes/m2-invoice",
  "brand-new-prefix/never-seen-before",
  "unprefixed-branch",
  "previewish-branch",
  "preview",
  "main-backup",
  "staging/old",
];

function runFor(ref) {
  const env = { ...process.env };
  if (ref === undefined) {
    delete env.VERCEL_GIT_COMMIT_REF;
  } else {
    env.VERCEL_GIT_COMMIT_REF = ref;
  }
  return spawnSync("bash", [scriptPath], { env, encoding: "utf8" });
}

// exit 1 = Vercel proceeds with the build (see docs/DEVELOPMENT-WORKFLOW.md,
// "Ordinary branches are CI-only").
for (const ref of DEPLOY_REFS) {
  test(`builds allowlisted ref "${ref}"`, () => {
    const result = runFor(ref);
    assert.equal(result.status, 1);
  });
}

// exit 0 = Vercel skips the build.
for (const ref of CI_ONLY_REFS) {
  test(`skips non-allowlisted ref "${ref}"`, () => {
    const result = runFor(ref);
    assert.equal(result.status, 0);
  });
}

test("fails open (builds) when VERCEL_GIT_COMMIT_REF is unset", () => {
  const result = runFor(undefined);
  assert.equal(result.status, 1);
});

test("does not treat a 'preview' prefix without a slash as allowlisted", () => {
  const result = runFor("previewish-branch");
  assert.equal(result.status, 0);
});

// --- git.deploymentEnabled: the PRIMARY pre-deployment gate -----------------
//
// Vercel matches branch names with minimatch, where `*` does NOT cross `/`
// (so `"*": false` would leave `chore/foo` deployable) and `**` does. A
// branch deploys if ANY matching rule is true; an unmatched branch defaults
// to true. This tiny matcher mirrors just the constructs vercel.json uses
// (literal names, `*`, `**`) so the rule set can be evaluated without adding
// a dependency.
function globToRegExp(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i++;
    } else if (ch === "*") {
      source += "[^/]*";
    } else {
      source += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function vercelDeploys(rules, ref) {
  const matching = Object.entries(rules).filter(([pattern]) => globToRegExp(pattern).test(ref));
  if (matching.length === 0) return true; // Vercel default for unspecified branches
  return matching.some(([, enabled]) => enabled === true);
}

const vercelConfig = JSON.parse(readFileSync(vercelJsonPath, "utf8"));
const rules = vercelConfig.git?.deploymentEnabled;

test("vercel.json git.deploymentEnabled is the exact reviewed allowlist", () => {
  assert.deepEqual(rules, {
    "**": false,
    main: true,
    staging: true,
    "preview/**": true,
  });
});

test("vercel.json keeps ignoreCommand as defense in depth", () => {
  assert.equal(vercelConfig.ignoreCommand, "bash scripts/vercel-ignore-build.sh");
});

for (const ref of DEPLOY_REFS) {
  test(`git.deploymentEnabled auto-deploys "${ref}"`, () => {
    assert.equal(vercelDeploys(rules, ref), true);
  });
}

for (const ref of CI_ONLY_REFS) {
  test(`git.deploymentEnabled blocks "${ref}" before a deployment is created`, () => {
    assert.equal(vercelDeploys(rules, ref), false);
  });
}

test('a bare "*" catch-all would NOT block slash-containing branches (why the rule is "**")', () => {
  const singleStar = { "*": false, main: true, staging: true, "preview/**": true };
  assert.equal(vercelDeploys(singleStar, "chore/foo"), true);
  assert.equal(vercelDeploys(rules, "chore/foo"), false);
});

test("git.deploymentEnabled and ignoreCommand agree on every reviewed ref", () => {
  for (const ref of [...DEPLOY_REFS, ...CI_ONLY_REFS]) {
    const scriptBuilds = runFor(ref).status === 1;
    assert.equal(vercelDeploys(rules, ref), scriptBuilds, `layers disagree for "${ref}"`);
  }
});
