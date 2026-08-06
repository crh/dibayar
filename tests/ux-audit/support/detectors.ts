import type { Page } from "@playwright/test";

export type ElementFinding = {
  selector: string;
  tag: string;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
};

export type OverflowReport = {
  viewportWidth: number;
  documentClientWidth: number;
  documentScrollWidth: number;
  pageOverflow: boolean;
  elements: ElementFinding[];
};

export type TouchTargetFinding = ElementFinding & {
  required: 44;
};

export type WrappedActionRowFinding = ElementFinding & {
  childLines: number[];
};

export async function detectHorizontalOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    function describe(element: Element, rect: DOMRect) {
      const html = element as HTMLElement;
      const id = html.id ? `#${CSS.escape(html.id)}` : "";
      const testId = html.dataset?.testid ? `[data-testid="${CSS.escape(html.dataset.testid)}"]` : "";
      const uxId = html.dataset?.uxId ? `[data-ux-id="${CSS.escape(html.dataset.uxId)}"]` : "";
      return {
        selector: uxId || testId || id || html.tagName.toLowerCase(),
        tag: html.tagName.toLowerCase(),
        text: (html.innerText || html.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 120),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }

    const root = document.documentElement;
    const viewportWidth = window.innerWidth;
    const elements: ElementFinding[] = [];
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") continue;
      const rect = html.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < -0.5 || rect.right > viewportWidth + 0.5) elements.push(describe(element, rect));
    }
    return {
      viewportWidth,
      documentClientWidth: root.clientWidth,
      documentScrollWidth: root.scrollWidth,
      pageOverflow: root.scrollWidth > root.clientWidth + 1,
      elements,
    };
  });
}

export async function detectSmallTouchTargets(
  page: Page,
  options: { selector?: string; ignoreSelector?: string } = {},
): Promise<TouchTargetFinding[]> {
  const selector = options.selector ?? "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=menuitem],[role=tab]";
  const ignoreSelector = options.ignoreSelector ?? "[data-ux-touch-ignore]";
  return page.evaluate(({ selector, ignoreSelector }) => {
    function describe(element: Element, rect: DOMRect) {
      const html = element as HTMLElement;
      const id = html.id ? `#${CSS.escape(html.id)}` : "";
      const testId = html.dataset?.testid ? `[data-testid="${CSS.escape(html.dataset.testid)}"]` : "";
      const uxId = html.dataset?.uxId ? `[data-ux-id="${CSS.escape(html.dataset.uxId)}"]` : "";
      return {
        selector: uxId || testId || id || html.tagName.toLowerCase(),
        tag: html.tagName.toLowerCase(),
        text: (html.innerText || html.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 120),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }

    const findings: TouchTargetFinding[] = [];
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const html = element as HTMLElement;
      if (html.matches(ignoreSelector) || html.closest(ignoreSelector)) continue;
      if (html.matches(":disabled,[aria-disabled=true]")) continue;
      const style = getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) continue;
      if (rect.width < 44 || rect.height < 44) findings.push({ ...describe(element, rect), required: 44 });
    }
    return findings;
  }, { selector, ignoreSelector });
}

export async function detectWrappedActionRows(
  page: Page,
  selector = "[data-ux-action-row]",
): Promise<WrappedActionRowFinding[]> {
  return page.evaluate((selector) => {
    function describe(element: Element, rect: DOMRect) {
      const html = element as HTMLElement;
      const id = html.id ? `#${CSS.escape(html.id)}` : "";
      const testId = html.dataset?.testid ? `[data-testid="${CSS.escape(html.dataset.testid)}"]` : "";
      const uxId = html.dataset?.uxId ? `[data-ux-id="${CSS.escape(html.dataset.uxId)}"]` : "";
      return {
        selector: uxId || testId || id || html.tagName.toLowerCase(),
        tag: html.tagName.toLowerCase(),
        text: (html.innerText || html.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 120),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }

    const findings: WrappedActionRowFinding[] = [];
    for (const row of Array.from(document.querySelectorAll(selector))) {
      const html = row as HTMLElement;
      const rect = html.getBoundingClientRect();
      const controls = Array.from(html.querySelectorAll(":scope > a[href],:scope > button,:scope > [role=button]")) as HTMLElement[];
      if (controls.length < 2) continue;
      const lines = [...new Set(controls.map((control) => Math.round(control.getBoundingClientRect().top)))];
      if (lines.length > 1) findings.push({ ...describe(row, rect), childLines: lines });
    }
    return findings;
  }, selector);
}

export async function rectanglesOverlap(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(({ first, second }) => {
    const a = document.querySelector(first)?.getBoundingClientRect();
    const b = document.querySelector(second)?.getBoundingClientRect();
    if (!a || !b) throw new Error(`Missing overlap target: ${first} or ${second}`);
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }, { first, second });
}
