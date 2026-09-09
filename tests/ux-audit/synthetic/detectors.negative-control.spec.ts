// Negative-control proof (see docs/testing/UX_AUDIT.md "Proving the
// detectors work"): the real defects this harness was built to catch
// (Deals desktop horizontal scroll, `Needs chasing` empty-state copy) may
// already be fixed on `main` -- passing specs elsewhere in this suite prove
// the CURRENT app is clean, not that the CHECKS themselves would catch a
// regression. These tests use synthetic, test-only HTML (page.setContent),
// never real application code, to prove each detector still fails loudly
// when given genuinely bad input. If any test in this file ever passes
// without its detector reporting a finding, the detector has regressed and
// can no longer be trusted to gate CI.
import { expect, test } from "@playwright/test";
import {
  detectHorizontalOverflow,
  detectSmallTouchTargets,
  detectHiddenRequiredControls,
  detectEmptyStateInconsistency,
  measureScrollContainer,
} from "../support/detectors";

test.describe("Synthetic negative controls: detectors must fail on bad input", () => {
  test("1. page-level horizontal overflow is detected", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setContent(`<style>body{margin:0}.overflow{width:2000px;height:20px}</style><div class="overflow">too wide</div>`);
    const report = await detectHorizontalOverflow(page);
    expect(report.pageOverflow).toBe(true);
  });

  test("2. a desktop Deals-like board with unintended horizontal scroll is detected", async ({ page }) => {
    // Same shape as the real deal-board-rail (data-testid="deal-board-rail",
    // overflow-x:auto, several stage columns) but with columns too wide to
    // fit a desktop viewport -- exactly the regression
    // routes/deals.desktop-scroll.spec.ts exists to catch on the real board.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setContent(`
      <style>body{margin:0}
        [data-testid="deal-board-rail"]{display:flex;overflow-x:auto;width:1280px}
        .stage{min-width:260px;flex:0 0 auto}
      </style>
      <div data-testid="deal-board-rail">
        ${Array.from({ length: 6 }, (_, i) => `<section class="stage">Stage ${i}</section>`).join("")}
      </div>
    `);
    const rail = await measureScrollContainer(page, '[data-testid="deal-board-rail"]');
    expect(rail.found).toBe(true);
    expect(rail.requiresHorizontalScroll).toBe(true);
  });

  test("3. an element escaping the viewport is detected", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <style>body{margin:0}</style>
      <div data-ux-id="escapee" style="position:absolute;left:500px;top:0;width:100px;height:40px">off-screen</div>
    `);
    const report = await detectHorizontalOverflow(page);
    const finding = report.elements.find((item) => item.selector === '[data-ux-id="escapee"]');
    expect(finding, "escaping element must be reported").toBeDefined();
    expect(finding?.classification).toBe("outside-viewport");
  });

  test("4. an overlapping interactive control (touch-target hit-area theft) is detected", async ({ page }) => {
    await page.setContent(`
      <div style="position:relative;width:300px;height:150px;margin:100px">
        <button data-ux-id="target-b" style="position:absolute;box-sizing:border-box;border:0;padding:0;margin:0;left:24px;top:0;width:44px;height:44px">B</button>
        <button data-ux-id="target-a" style="position:absolute;box-sizing:border-box;border:0;padding:0;margin:0;left:0;top:0;width:16px;height:16px">A</button>
      </div>
      <style>
        [data-ux-id="target-a"]::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 44px; height: 44px;
        }
      </style>
    `);
    const findings = await detectSmallTouchTargets(page);
    const conflict = findings.find((item) => item.selector === '[data-ux-id="target-a"]');
    expect(conflict, "control whose enlarged hit-area steals a neighbor's box must be reported").toBeDefined();
    expect(conflict?.reason).toBe("pseudo-overlaps-adjacent-control");
  });

  test("5. an invisible required control is detected", async ({ page }) => {
    await page.setContent(`
      <button data-ux-required data-ux-id="submit-cta" style="display:none">Kirim</button>
    `);
    const findings = await detectHiddenRequiredControls(page);
    expect(findings).toHaveLength(1);
    expect(findings[0].selector).toBe('[data-ux-id="submit-cta"]');
    expect(findings[0].reason).toBe("display-none");
  });

  test("5b. a visible required control produces no finding (control case for #5)", async ({ page }) => {
    await page.setContent(`<button data-ux-required data-ux-id="submit-cta">Kirim</button>`);
    expect(await detectHiddenRequiredControls(page)).toEqual([]);
  });

  test("6. an incorrect empty-state/data expectation is detected", async ({ page }) => {
    // Deliberately wrong: the container declares 2 real items but its DOM
    // renders neither the items nor omits the empty-state copy -- exactly
    // the class of bug section 6 (Needs Chasing) exists to catch: a widget
    // that silently reports "nothing to do" while data disagrees.
    await page.setContent(`
      <section data-ux-id="queue" data-ux-item-count="2">
        <p data-ux-empty-state>Tidak ada yang perlu dikejar.</p>
      </section>
    `);
    const result = await detectEmptyStateInconsistency(page, '[data-ux-id="queue"]');
    expect(result.consistent, "declared item count vs. rendered empty-state copy must be flagged as inconsistent").toBe(false);
    expect(result.declaredItemCount).toBe(2);
    expect(result.renderedItemCount).toBe(0);
    expect(result.showsEmptyCopy).toBe(true);
  });

  test("6b. a correctly matched empty state produces no inconsistency (control case for #6)", async ({ page }) => {
    await page.setContent(`
      <section data-ux-id="queue" data-ux-item-count="0">
        <p data-ux-empty-state>Tidak ada yang perlu dikejar.</p>
      </section>
    `);
    const result = await detectEmptyStateInconsistency(page, '[data-ux-id="queue"]');
    expect(result.consistent).toBe(true);
  });

  test("6c. a correctly matched actionable state produces no inconsistency (control case for #6)", async ({ page }) => {
    await page.setContent(`
      <section data-ux-id="queue" data-ux-item-count="2">
        <div data-ux-item>Item 1</div>
        <div data-ux-item>Item 2</div>
      </section>
    `);
    const result = await detectEmptyStateInconsistency(page, '[data-ux-id="queue"]');
    expect(result.consistent).toBe(true);
  });
});
