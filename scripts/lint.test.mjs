import { test } from "node:test";
import assert from "node:assert/strict";
import { exitCodeForResults } from "./lint.mjs";

test("exitCodeForResults returns 0 when no result has an error", () => {
  assert.equal(
    exitCodeForResults([
      { errorCount: 0, warningCount: 0 },
      { errorCount: 0, warningCount: 3 },
    ]),
    0,
  );
});

test("exitCodeForResults returns 0 for an empty results array", () => {
  assert.equal(exitCodeForResults([]), 0);
});

test("exitCodeForResults returns 1 when any result has an error", () => {
  assert.equal(
    exitCodeForResults([
      { errorCount: 0, warningCount: 0 },
      { errorCount: 2, warningCount: 0 },
    ]),
    1,
  );
});
