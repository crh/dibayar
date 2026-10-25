// The invoice due-date field, driven the way a person uses it (see
// e2e/invoices/due-date-integrity.spec.ts for why): clicks and taps land on
// the visible display text's own on-screen position, and digits go through
// the real keyboard into the native date input's segments. No fill(), no
// synthetic events.
import type { Locator, Page } from "@playwright/test";
import { expect } from "./test";

export const DUE_DATE_FIELD_LABEL = "Tanggal jatuh tempo";
const FIELD_LABEL = DUE_DATE_FIELD_LABEL;

function fieldWrapper(page: Page): Locator {
  return page.locator("#invoice-due-date").locator("xpath=..");
}

// The visible display is aria-hidden by design (the real <input> carries the
// accessible name), so it is located by its text inside the field wrapper.
export function visibleDisplay(page: Page, text: string): Locator {
  return fieldWrapper(page).getByText(text, { exact: true });
}

export async function activateVisibleText(page: Page, display: Locator, isMobile: boolean) {
  await display.scrollIntoViewIfNeeded();
  await expect(display).toBeVisible();
  await expect(display).toBeInViewport();
  const box = await display.boundingBox();
  expect(box, "visible due-date display has no layout box").not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

// Clicks the visible text (as a person would) and, if that opened the native
// picker, dismisses it with Escape so the keyboard reaches the segments.
// Then moves to the first segment wherever the click landed.
export async function focusFieldForTyping(page: Page, display: Locator) {
  const input = page.getByLabel(FIELD_LABEL);
  await activateVisibleText(page, display, false);
  await expect(input).toBeFocused();
  if (await input.evaluate((element) => { try { return element.matches(":open"); } catch { return false; } })) {
    await page.keyboard.press("Escape");
    await expect.poll(() => input.evaluate((element) => element.matches(":open"))).toBe(false);
  }
  await expect(input).toBeFocused();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
}
