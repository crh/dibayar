import type { Page, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

export async function assertNoSeriousA11yViolations(
  page: Page,
  testInfo: TestInfo,
  include?: string,
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (include) builder = builder.include(include);

  const results = await builder.analyze();
  const moderate = results.violations.filter((violation) => violation.impact === "moderate");
  if (moderate.length > 0) {
    await testInfo.attach("a11y-moderate", {
      body: JSON.stringify(moderate, null, 2),
      contentType: "application/json",
    });
  }

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}
