import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "vercel-ignore-build.sh");

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
for (const ref of ["main", "staging", "preview/foo", "preview/hermes-1"]) {
  test(`builds allowlisted ref "${ref}"`, () => {
    const result = runFor(ref);
    assert.equal(result.status, 1);
  });
}

// exit 0 = Vercel skips the build.
for (const ref of ["feature/foo", "fix/bar", "chore/baz", "codex/m4-invoiced-this-month", "hermes/m2-invoice"]) {
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
