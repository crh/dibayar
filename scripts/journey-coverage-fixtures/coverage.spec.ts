// Each test (and each comment) is a deliberate case for the journey-coverage
// negative controls in scripts/journey-coverage.test.mjs. Keep titles in sync.
import { expect, test } from "@playwright/test";

// A commented-out test must not count:
// test("commented-out test", async () => {});

// A renamed test whose old title survives only in this comment must not
// count: "old title before the rename"
test("passes everywhere", async () => {
  expect(1 + 1).toBe(2);
});

test("unconditional skip in the body", async () => {
  test.skip();
});

test("expected failure in the body", async () => {
  test.fail(true, "known defect");
  expect(1).toBe(2);
});

test("desktop only by project name", async ({ browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop only");
  expect(browserName).toBe("chromium");
});

test("mobile only by isMobile", async ({ isMobile }) => {
  test.skip(isMobile !== true, "mobile only");
  expect(isMobile).toBe(true);
});

test("skip under an opaque condition", async () => {
  if (process.env.JOURNEY_COVERAGE_FIXTURE_NEVER_SET) test.skip();
});

test.skip("declared skip", async () => {});

test.fail("declared expected failure", async () => {
  expect(1).toBe(2);
});

test.fixme("declared fixme", async () => {});

test.describe("suite skipped on mobile", () => {
  test.skip(({ isMobile }) => isMobile, "desktop-only suite");

  test("member of a mobile-skipped suite", async () => {});
});

test.describe.skip("skipped suite", () => {
  test("member of a skipped suite", async () => {});
});
