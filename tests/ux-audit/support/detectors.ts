import type { Page } from "@playwright/test";
import { ALLOWED_SCROLL_CONTAINERS, type ScrollExceptionRule } from "./scroll-policy";

export type ElementFinding = {
  selector: string;
  tag: string;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
};

export type OverflowFinding = ElementFinding & {
  classification: "outside-viewport" | "intentional-scroll-descendant";
  scrollAncestor: string | null;
};

export type OverflowReport = {
  viewportWidth: number;
  documentClientWidth: number;
  documentScrollWidth: number;
  pageOverflow: boolean;
  elements: OverflowFinding[];
};

export type TouchTargetFinding = ElementFinding & {
  required: 44;
  effective: { width: number; height: number; source: "element" | "pseudo-overlay" };
  reason: "effective-area-below-44" | "pseudo-overlaps-adjacent-control";
  pseudoOverlay: { pseudo: "::before" | "::after" } | null;
};

export type WrappedActionRowFinding = ElementFinding & {
  childLines: number[];
};

export async function detectHorizontalOverflow(
  page: Page,
  allowedScrollContainers: readonly ScrollExceptionRule[] = ALLOWED_SCROLL_CONTAINERS,
): Promise<OverflowReport> {
  return page.evaluate((rules) => {
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

    // Known intentional horizontal-scroll containers, from the reviewable
    // registry in ./scroll-policy.ts (passed in as `rules` since this runs
    // inside the browser and can't import it directly). Exemption is by
    // exact selector match only — not by role/aria-label pattern-matching —
    // so an unrelated horizontal scroller isn't accidentally waved through.
    function isKnownIntentionalScrollAncestor(candidate: HTMLElement) {
      return rules.some(
        (rule) =>
          (rule.testid !== undefined && candidate.dataset?.testid === rule.testid) ||
          (rule.uxScroll !== undefined && candidate.dataset?.uxScroll === rule.uxScroll),
      );
    }

    function findIntentionalScrollAncestor(element: Element): HTMLElement | null {
      let node = element.parentElement;
      while (node && node !== document.body) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") {
          return isKnownIntentionalScrollAncestor(node) ? node : null;
        }
        node = node.parentElement;
      }
      return null;
    }

    // A genuinely active dialog/menu surface: the ARIA role that makes it
    // one, actually rendered (not display:none/visibility:hidden/aria-hidden),
    // and taken out of normal flow so it can legitimately span or extend
    // past the viewport edge by design (a full-bleed sheet/menu), mirroring
    // the touch-target detector's own contract for the same concept.
    function isActiveDialogOrMenu(node: HTMLElement) {
      const role = node.getAttribute("role");
      if (role !== "dialog" && role !== "menu") return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (node.getAttribute("aria-hidden") === "true") return false;
      return style.position === "fixed" || style.position === "absolute";
    }

    // A fixed, click-accepting element is only a real active-modal backdrop
    // under the same production contract as the touch-target detector:
    // explicitly aria-hidden="true" (backdrops hide page content from
    // assistive tech), covering essentially the whole viewport, AND a
    // sibling in the same parent that is a genuinely active dialog/menu --
    // not any large fixed div that happens to overflow.
    function isActiveModalBackdrop(node: HTMLElement) {
      const style = getComputedStyle(node);
      if (style.position !== "fixed" || style.pointerEvents !== "auto") return false;
      if (node.getAttribute("aria-hidden") !== "true") return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) return false;
      const parent = node.parentElement;
      if (!parent) return false;
      return Array.from(parent.children).some(
        (sibling) => sibling !== node && isActiveDialogOrMenu(sibling as HTMLElement),
      );
    }

    // A position:fixed element that overflows the viewport is exempted only
    // when it's a verified active overlay/backdrop -- never blanket-skipped
    // just for being fixed, so a genuinely misplaced fixed element (a stray
    // banner, a mispositioned fixed nav) still gets reported.
    function isVerifiedActiveOverlay(node: HTMLElement) {
      return isActiveDialogOrMenu(node) || isActiveModalBackdrop(node);
    }

    const root = document.documentElement;
    const viewportWidth = window.innerWidth;
    const pageOverflow = root.scrollWidth > root.clientWidth + 1;
    const elements: OverflowFinding[] = [];
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = html.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < -0.5 || rect.right > viewportWidth + 0.5) {
        if (style.position === "fixed" && isVerifiedActiveOverlay(html)) continue;
        const scrollAncestor = !pageOverflow ? findIntentionalScrollAncestor(html) : null;
        elements.push({
          ...describe(element, rect),
          classification: scrollAncestor ? "intentional-scroll-descendant" : "outside-viewport",
          scrollAncestor: scrollAncestor ? describe(scrollAncestor, scrollAncestor.getBoundingClientRect()).selector : null,
        });
      }
    }
    return {
      viewportWidth,
      documentClientWidth: root.clientWidth,
      documentScrollWidth: root.scrollWidth,
      pageOverflow,
      elements,
    };
  }, allowedScrollContainers);
}

export async function detectSmallTouchTargets(
  page: Page,
  options: { selector?: string; ignoreSelector?: string } = {},
): Promise<TouchTargetFinding[]> {
  const selector = options.selector ?? "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=menuitem],[role=tab]";
  const ignoreSelector = options.ignoreSelector ?? "[data-ux-touch-ignore]";
  return page.evaluate(({ selector, ignoreSelector }) => {
    function describe(element: Element, rect: DOMRect | { x: number; y: number; width: number; height: number }) {
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

    // A pseudo counts only when it is actually declared/rendered — not a
    // bare `content: none` (no pseudo box) or a hidden/collapsed one — and
    // only positioned pseudos (absolute/fixed) can extend a hit area beyond
    // the host element's own box.
    function renderedPseudo(html: HTMLElement, pseudo: "::before" | "::after") {
      const style = getComputedStyle(html, pseudo);
      if (!style || style.content === "none" || style.content === "") return null;
      if (style.display === "none" || style.visibility === "hidden") return null;
      if (style.position !== "absolute" && style.position !== "fixed") return null;
      return style;
    }

    function preservesKeyboardSemantics(html: HTMLElement) {
      if (html.getAttribute("aria-hidden") === "true") return false;
      const isNativeControl = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(html.tagName) ||
        (html.tagName === "A" && html.hasAttribute("href"));
      return isNativeControl || html.tabIndex >= 0;
    }

    // Marches outward from the element's own edges along the four cardinal
    // directions, using real hit-testing (not CSS math) to find how far a
    // pseudo overlay actually extends the clickable area back onto this
    // element. Direction-independent so it works for centered overlays
    // (the common `::before` hit-area pattern) and asymmetric ones alike.
    function measureEffectiveExtent(html: HTMLElement, rect: DOMRect) {
      const maxDist = 32;
      const hits = (x: number, y: number) => {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === html || html.contains(hit));
      };
      // Sample inside each integer distance bin rather than at the outer
      // boundary. This avoids both browser edge rounding and the false +1
      // inflation that could turn a 43px pseudo hit-area into 44px.
      const march = (originX: number, originY: number, dx: number, dy: number) => {
        let extent = 0;
        for (let d = 1; d <= maxDist; d += 1) {
          const sampleDistance = d - 0.25;
          if (!hits(originX + dx * sampleDistance, originY + dy * sampleDistance)) break;
          extent = d;
        }
        return extent;
      };
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      const leftExtent = march(rect.left, midY, -1, 0);
      const rightExtent = march(rect.right, midY, 1, 0);
      const topExtent = march(midX, rect.top, 0, -1);
      const bottomExtent = march(midX, rect.bottom, 0, 1);
      return {
        left: rect.left - leftExtent,
        right: rect.right + rightExtent,
        top: rect.top - topExtent,
        bottom: rect.bottom + bottomExtent,
        width: rect.width + leftExtent + rightExtent,
        height: rect.height + topExtent + bottomExtent,
      };
    }

    function rectsOverlap(a: { left: number; right: number; top: number; bottom: number }, b: DOMRect) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    // A genuinely active dialog/menu surface: the ARIA role that makes it
    // one, actually rendered (not display:none/visibility:hidden/aria-hidden),
    // and taken out of normal flow so it can sit on top of page content.
    function isActiveDialogOrMenu(node: HTMLElement) {
      const role = node.getAttribute("role");
      if (role !== "dialog" && role !== "menu") return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (node.getAttribute("aria-hidden") === "true") return false;
      return style.position === "fixed" || style.position === "absolute";
    }

    // A fixed, click-accepting element spanning ~the whole viewport is only
    // an actual modal backdrop/scrim when it carries the production contract
    // for a real scrim: explicitly `aria-hidden="true"` (backdrops hide page
    // content from assistive tech) AND a sibling in the same parent that is
    // a genuinely active dialog/menu. The mere presence of an active dialog
    // *anywhere* in the document is not proof — an unrelated full-bleed
    // overlay elsewhere in the DOM must not be waved through on that basis
    // alone, so findings behind it still get suppressed only when both
    // explicit signals are present together.
    function isActiveModalBackdrop(node: HTMLElement) {
      const style = getComputedStyle(node);
      if (style.position !== "fixed" || style.pointerEvents !== "auto") return false;
      if (node.getAttribute("aria-hidden") !== "true") return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) return false;
      const parent = node.parentElement;
      if (!parent) return false;
      return Array.from(parent.children).some(
        (sibling) => sibling !== node && isActiveDialogOrMenu(sibling as HTMLElement),
      );
    }

    function isOverlayRoot(node: HTMLElement) {
      return isActiveDialogOrMenu(node) || isActiveModalBackdrop(node);
    }

    function collectActiveOverlayRoots(): HTMLElement[] {
      return Array.from(document.querySelectorAll("*")).filter((node) =>
        isOverlayRoot(node as HTMLElement),
      ) as HTMLElement[];
    }

    // A target is only exempt from its own size defect when a real active
    // overlay's rectangle fully covers its visible rect — center-point
    // sampling would let a backdrop that merely clips a corner suppress a
    // finding the user can still (partially) reach. Any overlay containing
    // the candidate itself (e.g. the dialog's own content) doesn't count.
    function isFullyOccludedByActiveOverlay(html: HTMLElement, rect: DOMRect, overlayRoots: HTMLElement[]) {
      const visibleLeft = Math.max(rect.left, 0);
      const visibleRight = Math.min(rect.right, window.innerWidth);
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, window.innerHeight);
      if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return false;
      return overlayRoots.some((root) => {
        if (root === html || root.contains(html)) return false;
        const overlayRect = root.getBoundingClientRect();
        if (
          getComputedStyle(root).pointerEvents === "none" ||
          overlayRect.left > visibleLeft + 0.5 ||
          overlayRect.top > visibleTop + 0.5 ||
          overlayRect.right < visibleRight - 0.5 ||
          overlayRect.bottom < visibleBottom - 0.5
        ) return false;
        const insetX = Math.min(0.5, (visibleRight - visibleLeft) / 2);
        const insetY = Math.min(0.5, (visibleBottom - visibleTop) / 2);
        const samplePoints = [
          [visibleLeft + insetX, visibleTop + insetY],
          [visibleRight - insetX, visibleTop + insetY],
          [visibleLeft + insetX, visibleBottom - insetY],
          [visibleRight - insetX, visibleBottom - insetY],
          [(visibleLeft + visibleRight) / 2, (visibleTop + visibleBottom) / 2],
        ];
        return samplePoints.every(([x, y]) => {
          const stack = document.elementsFromPoint(x, y);
          const overlayIndex = stack.indexOf(root);
          const targetIndex = stack.findIndex((node) => node === html || html.contains(node));
          return overlayIndex >= 0 && targetIndex >= 0 && overlayIndex < targetIndex;
        }) && (
          overlayRect.left <= visibleLeft + 0.5 &&
          overlayRect.top <= visibleTop + 0.5 &&
          overlayRect.right >= visibleRight - 0.5 &&
          overlayRect.bottom >= visibleBottom - 0.5
        );
      });
    }

    const candidates: { html: HTMLElement; rect: DOMRect }[] = [];
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const html = element as HTMLElement;
      if (html.matches(ignoreSelector) || html.closest(ignoreSelector)) continue;
      if (html.matches(":disabled,[aria-disabled=true]")) continue;
      const style = getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) continue;
      candidates.push({ html, rect });
    }

    const overlayRoots = collectActiveOverlayRoots();
    const findings: TouchTargetFinding[] = [];
    for (const { html, rect } of candidates) {
      if (rect.width >= 44 && rect.height >= 44) continue; // real box already meets the floor
      if (isFullyOccludedByActiveOverlay(html, rect, overlayRoots)) continue; // fully covered by an active dialog/menu or its backdrop, not a size defect

      const pseudo: "::before" | "::after" | null =
        renderedPseudo(html, "::before") ? "::before" : renderedPseudo(html, "::after") ? "::after" : null;

      if (!pseudo || !preservesKeyboardSemantics(html)) {
        findings.push({
          ...describe(html, rect),
          required: 44,
          effective: { width: rect.width, height: rect.height, source: "element" },
          reason: "effective-area-below-44",
          pseudoOverlay: null,
        });
        continue;
      }

      const effective = measureEffectiveExtent(html, rect);
      if (effective.width < 44 || effective.height < 44) {
        findings.push({
          ...describe(html, rect),
          required: 44,
          effective: { width: effective.width, height: effective.height, source: "pseudo-overlay" },
          reason: "effective-area-below-44",
          pseudoOverlay: { pseudo },
        });
        continue;
      }

      const conflict = candidates.some(
        (other) => other.html !== html && rectsOverlap(effective, other.rect),
      );
      if (conflict) {
        findings.push({
          ...describe(html, rect),
          required: 44,
          effective: { width: effective.width, height: effective.height, source: "pseudo-overlay" },
          reason: "pseudo-overlaps-adjacent-control",
          pseudoOverlay: { pseudo },
        });
      }
      // else: the pseudo overlay genuinely provides a >=44x44 hit area that
      // hit-tests back to this control without stealing a neighbor's box —
      // not reported as a finding.
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
      const style = getComputedStyle(html);
      if (style.display !== "flex" && style.display !== "inline-flex") continue;
      if (style.flexDirection === "column" || style.flexDirection === "column-reverse") continue;
      if (style.flexWrap !== "wrap" && style.flexWrap !== "wrap-reverse") continue;
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

export type ScrollContainerMeasurement = {
  found: boolean;
  scrollWidth: number;
  clientWidth: number;
  /** scrollWidth exceeds clientWidth by more than a 1px rounding tolerance. */
  requiresHorizontalScroll: boolean;
};

// Measures whether a specific, already-known intentional-scroll container
// (e.g. the Deals board rail, `[data-testid="deal-board-rail"]`) actually
// needs to scroll right now -- distinct from detectHorizontalOverflow, which
// only asks whether such a container exists and exempts its descendants from
// the page-level check. A container can legitimately be `overflow-x: auto`
// at every viewport (so it CAN scroll) while still being required not to
// NEED to at specific viewports (see routes/deals.desktop-scroll.spec.ts).
export async function measureScrollContainer(page: Page, selector: string): Promise<ScrollContainerMeasurement> {
  return page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) return { found: false, scrollWidth: 0, clientWidth: 0, requiresHorizontalScroll: false };
    const { scrollWidth, clientWidth } = element;
    return { found: true, scrollWidth, clientWidth, requiresHorizontalScroll: scrollWidth > clientWidth + 1 };
  }, selector);
}

export type HiddenRequiredControlFinding = ElementFinding & {
  reason: "display-none" | "visibility-hidden" | "zero-opacity" | "zero-dimensions" | "detached";
};

// Controls can't be scanned for "is this wrongly hidden" without knowing
// intent -- a collapsed mobile menu button being display:none on desktop is
// correct, not a defect. This only inspects elements explicitly marked
// `data-ux-required` (or a caller-supplied selector) -- i.e. "this control
// must always be usable on this route/state", declared at the call site,
// never inferred. See routes/matrix.spec.ts and
// synthetic/detectors.negative-control.spec.ts.
export async function detectHiddenRequiredControls(
  page: Page,
  selector = "[data-ux-required]",
): Promise<HiddenRequiredControlFinding[]> {
  return page.evaluate((selector) => {
    function describe(element: Element, rect: DOMRect | { x: number; y: number; width: number; height: number }) {
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

    const findings: HiddenRequiredControlFinding[] = [];
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const html = element as HTMLElement;
      if (!html.isConnected) {
        findings.push({ ...describe(html, { x: 0, y: 0, width: 0, height: 0 }), reason: "detached" });
        continue;
      }
      const style = getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      if (style.display === "none") {
        findings.push({ ...describe(html, rect), reason: "display-none" });
      } else if (style.visibility === "hidden") {
        findings.push({ ...describe(html, rect), reason: "visibility-hidden" });
      } else if (Number.parseFloat(style.opacity) === 0) {
        findings.push({ ...describe(html, rect), reason: "zero-opacity" });
      } else if (rect.width === 0 || rect.height === 0) {
        findings.push({ ...describe(html, rect), reason: "zero-dimensions" });
      }
    }
    return findings;
  }, selector);
}

export type EmptyStateConsistency = {
  consistent: boolean;
  declaredItemCount: number;
  renderedItemCount: number;
  showsEmptyCopy: boolean;
};

// A declarative cross-check for "the empty state claims there's nothing,
// but there actually is" (or the reverse): compares a container's own
// declared item count (`data-ux-item-count`, written by the component
// itself from its real data) against what actually rendered
// (`data-ux-item` children) and whether empty-state copy
// (`data-ux-empty-state`) is shown. All three signals must agree; see
// synthetic/detectors.negative-control.spec.ts for a worked bad-data example
// (this is a generic, declarative contract -- it is not wired into any
// production component, which would require adding these data-attributes
// there first).
export async function detectEmptyStateInconsistency(page: Page, containerSelector: string): Promise<EmptyStateConsistency> {
  return page.evaluate((containerSelector) => {
    const container = document.querySelector(containerSelector);
    if (!container) throw new Error(`Missing empty-state container: ${containerSelector}`);
    const declaredItemCount = Number.parseInt(container.getAttribute("data-ux-item-count") ?? "0", 10);
    const renderedItemCount = container.querySelectorAll("[data-ux-item]").length;
    const showsEmptyCopy = container.querySelector("[data-ux-empty-state]") !== null;
    const consistent =
      declaredItemCount === renderedItemCount &&
      (declaredItemCount > 0 ? !showsEmptyCopy : showsEmptyCopy);
    return { consistent, declaredItemCount, renderedItemCount, showsEmptyCopy };
  }, containerSelector);
}
