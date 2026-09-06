import { expect, test } from "@playwright/test";
import { deterministicCaptureName } from "./support/capture";
import {
  detectHorizontalOverflow,
  detectSmallTouchTargets,
  detectWrappedActionRows,
  rectanglesOverlap,
} from "./support/detectors";
import { compareDocumentFields } from "./support/parity";

test.describe("T-00 detector self-tests", () => {
  test("deterministic screenshot names reject unsafe and ambiguous segments", () => {
    expect(deterministicCaptureName({ routeKey: "invoice-detail", stateKey: "sent-active", viewport: "xs320", language: "id" }))
      .toBe("invoice-detail__sent-active__xs320__id.png");
    expect(() => deterministicCaptureName({ routeKey: "../invoice", stateKey: "sent", viewport: "xs320", language: "id" }))
      .toThrow(/kebab-case/);
  });

  test("horizontal-overflow detector catches content even when the root masks scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>html{overflow-x:hidden}body{margin:0}.wide{width:420px;height:20px}</style>
      <div class="wide" data-ux-id="wide-fixture">wide</div>
    `);
    const report = await detectHorizontalOverflow(page);
    expect(report.elements.some((item) => item.selector === '[data-ux-id="wide-fixture"]')).toBe(true);
  });

  test("horizontal-overflow detector accepts bounded content", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`<style>body{margin:0}.fit{max-width:100%;height:20px}</style><div class="fit">fit</div>`);
    const report = await detectHorizontalOverflow(page);
    expect(report.pageOverflow).toBe(false);
    expect(report.elements).toEqual([]);
  });

  test("horizontal-overflow detector blocks real document expansion even without a scroll ancestor", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`<style>body{margin:0}.wide{width:500px;height:20px}</style><div class="wide" data-ux-id="unbounded">wide</div>`);
    const report = await detectHorizontalOverflow(page);
    expect(report.pageOverflow).toBe(true);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="unbounded"]');
    expect(finding?.classification).toBe("outside-viewport");
  });

  test("horizontal-overflow detector classifies an intentional overflow-x:auto rail descendant as non-blocking", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div data-testid="deal-board-rail" style="width:320px;overflow-x:auto">
        <div data-ux-id="rail-child" style="width:900px;height:20px">rail content</div>
      </div>
    `);
    const report = await detectHorizontalOverflow(page);
    expect(report.pageOverflow).toBe(false);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="rail-child"]');
    expect(finding?.classification).toBe("intentional-scroll-descendant");
    expect(finding?.scrollAncestor).toBe('[data-testid="deal-board-rail"]');
  });

  test("horizontal-overflow detector classifies the stage-filter chip rail scroll container as non-blocking", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div data-ux-scroll="stage-filter" data-ux-id="stage-filter-rail" style="width:320px;overflow-x:auto">
        <div data-ux-id="stage-filter-child" style="width:900px;height:20px">chips</div>
      </div>
    `);
    const report = await detectHorizontalOverflow(page);
    expect(report.pageOverflow).toBe(false);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="stage-filter-child"]');
    expect(finding?.classification).toBe("intentional-scroll-descendant");
    expect(finding?.scrollAncestor).toBe('[data-ux-id="stage-filter-rail"]');
  });

  test("horizontal-overflow detector exempts a verified active-dialog backdrop that pokes past the viewport edge", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div data-ux-id="real-backdrop" aria-hidden="true" style="position:fixed;top:0;left:-4px;width:328px;height:800px;pointer-events:auto"></div>
      <div role="dialog" style="position:fixed;top:0;left:0;width:1px;height:1px"></div>
    `);
    const report = await detectHorizontalOverflow(page);
    expect(report.elements.some((item) => item.selector === '[data-ux-id="real-backdrop"]')).toBe(false);
  });

  test("horizontal-overflow detector still reports an overflowing fixed element that is not a verified backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div data-ux-id="stray-fixed" style="position:fixed;top:0;left:-4px;width:328px;height:40px">stray</div>
    `);
    const report = await detectHorizontalOverflow(page);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="stray-fixed"]');
    expect(finding?.classification).toBe("outside-viewport");
  });

  test("horizontal-overflow detector still reports a fixed backdrop missing the active-dialog sibling required by the contract", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div data-ux-id="unpaired-backdrop" aria-hidden="true" style="position:fixed;top:0;left:-4px;width:328px;height:800px;pointer-events:auto"></div>
    `);
    const report = await detectHorizontalOverflow(page);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="unpaired-backdrop"]');
    expect(finding?.classification).toBe("outside-viewport");
  });

  test("horizontal-overflow detector still blocks an unrelated labeled role=group horizontal scroller", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div role="group" aria-label="Other scroller" data-ux-id="other-rail" style="width:320px;overflow-x:auto">
        <div data-ux-id="other-child" style="width:900px;height:20px">content</div>
      </div>
    `);
    const report = await detectHorizontalOverflow(page);
    expect(report.pageOverflow).toBe(false);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="other-child"]');
    expect(finding?.classification).toBe("outside-viewport");
    expect(finding?.scrollAncestor).toBeNull();
  });

  test("touch-target detector reports visible interactive targets below 44px", async ({ page }) => {
    await page.setContent(`
      <button data-ux-id="small" style="width:30px;height:30px">S</button>
      <button data-ux-id="ok" style="width:44px;height:44px">OK</button>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="small"]']);
  });

  test("touch-target detector credits a real >=44x44 box with no pseudo needed", async ({ page }) => {
    await page.setContent(`<button data-ux-id="ok" style="width:44px;height:44px">OK</button>`);
    expect(await detectSmallTouchTargets(page)).toEqual([]);
  });

  test("touch-target detector credits a pseudo hit-area that reaches 44x44", async ({ page }) => {
    await page.setContent(`
      <style>
        [data-ux-id="pseudo-pass"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 100px; width: 20px; height: 20px; }
        [data-ux-id="pseudo-pass"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 44px; height: 44px;
        }
      </style>
      <button data-ux-id="pseudo-pass">S</button>
    `);
    expect(await detectSmallTouchTargets(page)).toEqual([]);
  });

  test("touch-target detector does not round a 43px pseudo hit-area up to 44px", async ({ page }) => {
    await page.setContent(`
      <style>
        [data-ux-id="pseudo-43"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 100px; width: 20px; height: 20px; }
        [data-ux-id="pseudo-43"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 43px; height: 43px;
        }
      </style>
      <button data-ux-id="pseudo-43">S</button>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings).toHaveLength(1);
    expect(findings[0].selector).toBe('[data-ux-id="pseudo-43"]');
    expect(findings[0].effective.width).toBeLessThan(44);
  });

  test("touch-target detector still fails when the pseudo hit-area stays under 44x44", async ({ page }) => {
    await page.setContent(`
      <style>
        [data-ux-id="pseudo-fail"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 100px; width: 20px; height: 20px; }
        [data-ux-id="pseudo-fail"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="pseudo-fail">S</button>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings).toHaveLength(1);
    expect(findings[0].selector).toBe('[data-ux-id="pseudo-fail"]');
    expect(findings[0].reason).toBe("effective-area-below-44");
    expect(findings[0].effective.width).toBeLessThan(44);
  });

  test("touch-target detector does not silently pass a pseudo hit-area that steals a neighbor's box", async ({ page }) => {
    await page.setContent(`
      <div style="position:relative;width:300px;height:150px;margin:100px">
        <button data-ux-id="neighbor" style="position:absolute;box-sizing:border-box;border:0;padding:0;margin:0;left:24px;top:0;width:44px;height:44px">B</button>
        <button data-ux-id="conflict" style="position:absolute;box-sizing:border-box;border:0;padding:0;margin:0;left:0;top:0;width:16px;height:16px">A</button>
      </div>
      <style>
        [data-ux-id="conflict"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 44px; height: 44px;
        }
      </style>
    `);
    const findings = await detectSmallTouchTargets(page);
    const conflict = findings.find((item) => item.selector === '[data-ux-id="conflict"]');
    expect(conflict).toBeDefined();
    expect(conflict?.reason).toBe("pseudo-overlaps-adjacent-control");
  });

  test("touch-target detector skips a small control fully occluded by an explicit active-dialog backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>
        [data-ux-id="behind-backdrop"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 40px; width: 20px; height: 20px; }
        [data-ux-id="behind-backdrop"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="behind-backdrop">S</button>
      <div aria-hidden="true" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:auto"></div>
      <div role="dialog" style="position:fixed;top:0;left:0;width:1px;height:1px"></div>
    `);
    expect(await detectSmallTouchTargets(page)).toEqual([]);
  });

  test("touch-target detector does not suppress a finding for a non-intercepting active dialog", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>
        [data-ux-id="behind-passive-dialog"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 40px; width: 20px; height: 20px; }
        [data-ux-id="behind-passive-dialog"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="behind-passive-dialog">S</button>
      <div role="dialog" style="position:fixed;inset:0;pointer-events:none"></div>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="behind-passive-dialog"]']);
  });

  test("touch-target detector does not suppress a finding for an active dialog behind the target", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>
        [data-ux-id="behind-lower-dialog"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 40px; width: 20px; height: 20px; }
        [data-ux-id="behind-lower-dialog"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="behind-lower-dialog">S</button>
      <div role="dialog" style="position:fixed;inset:0;z-index:-1;pointer-events:auto"></div>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="behind-lower-dialog"]']);
  });

  test("touch-target detector still reports a small control under an unmarked fullscreen overlay even when an unrelated active dialog/menu exists elsewhere", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>
        [data-ux-id="behind-unmarked-overlay"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 40px; width: 20px; height: 20px; }
        [data-ux-id="behind-unmarked-overlay"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="behind-unmarked-overlay">S</button>
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:auto"></div>
      <div><div role="dialog" style="position:fixed;top:0;left:0;width:1px;height:1px"></div></div>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="behind-unmarked-overlay"]']);
  });

  test("touch-target detector still reports a small control under an unrelated fullscreen overlay with no active dialog/menu", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.setContent(`
      <style>
        [data-ux-id="behind-unrelated-overlay"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 40px; width: 20px; height: 20px; }
        [data-ux-id="behind-unrelated-overlay"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="behind-unrelated-overlay">S</button>
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:auto"></div>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="behind-unrelated-overlay"]']);
  });

  test("touch-target detector still reports a control only partially covered by an active-dialog backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    await page.setContent(`
      <button data-ux-id="partial-cover" style="position:fixed;box-sizing:border-box;border:0;padding:0;margin:0;left:10px;top:260px;width:30px;height:30px">S</button>
      <div style="position:fixed;top:0;left:0;width:400px;height:280px;pointer-events:auto"></div>
      <div role="dialog" style="position:fixed;top:0;left:0;width:1px;height:1px"></div>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="partial-cover"]']);
  });

  test("touch-target detector still reports a small control covered by a normal non-modal sibling", async ({ page }) => {
    await page.setContent(`
      <style>
        [data-ux-id="behind-sibling"] { position: relative; box-sizing: border-box; border: 0; padding: 0; margin: 100px; width: 20px; height: 20px; }
        [data-ux-id="behind-sibling"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 30px; height: 30px;
        }
      </style>
      <button data-ux-id="behind-sibling">S</button>
      <div style="position:absolute;top:90px;left:90px;width:220px;height:220px"></div>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="behind-sibling"]']);
  });

  test("wrapped-action detector reports multi-line action rows", async ({ page }) => {
    await page.setContent(`
      <style>
        [data-ux-action-row]{display:flex;flex-wrap:wrap;width:120px;gap:8px}
        [data-ux-action-row] button{width:80px;height:44px}
      </style>
      <div data-ux-action-row data-ux-id="wrapped"><button>One</button><button>Two</button></div>
    `);
    const findings = await detectWrappedActionRows(page);
    expect(findings).toHaveLength(1);
    expect(findings[0].selector).toBe('[data-ux-id="wrapped"]');
  });

  test("wrapped-action detector accepts an intentional single line", async ({ page }) => {
    await page.setContent(`
      <style>[data-ux-action-row]{display:flex;width:200px;gap:8px}[data-ux-action-row] button{width:80px;height:44px}</style>
      <div data-ux-action-row><button>One</button><button>Two</button></div>
    `);
    expect(await detectWrappedActionRows(page)).toEqual([]);
  });

  test("wrapped-action detector accepts intentional flex-direction: column stacking", async ({ page }) => {
    await page.setContent(`
      <style>
        [data-ux-action-row]{display:flex;flex-direction:column;width:120px;gap:8px}
        [data-ux-action-row] button{width:80px;height:44px}
      </style>
      <div data-ux-action-row data-ux-id="stacked"><button>One</button><button>Two</button></div>
    `);
    expect(await detectWrappedActionRows(page)).toEqual([]);
  });

  test("overlap detector uses real rectangles", async ({ page }) => {
    await page.setContent(`
      <div id="value" style="position:absolute;left:10px;top:10px;width:100px;height:100px"></div>
      <div id="menu" style="position:absolute;left:50px;top:50px;width:100px;height:100px"></div>
      <div id="safe" style="position:absolute;left:200px;top:200px;width:50px;height:50px"></div>
    `);
    expect(await rectanglesOverlap(page, "#value", "#menu")).toBe(true);
    expect(await rectanglesOverlap(page, "#value", "#safe")).toBe(false);
  });

  test("document parity requires the same fields, order, labels, and values", () => {
    const fields = [
      { key: "number", label: "Nomor invoice", value: "INV/2026/08/001" },
      { key: "total", label: "Total", value: "Rp 1.000.000" },
    ];
    expect(compareDocumentFields(fields, fields).equal).toBe(true);
    expect(compareDocumentFields(fields, [...fields].reverse()).equal).toBe(false);
    expect(compareDocumentFields(fields, [{ ...fields[0], value: "wrong" }, fields[1]]).mismatches).toHaveLength(1);
  });
});
