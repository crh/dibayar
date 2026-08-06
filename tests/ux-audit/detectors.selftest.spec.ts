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

  test("touch-target detector reports visible interactive targets below 44px", async ({ page }) => {
    await page.setContent(`
      <button data-ux-id="small" style="width:30px;height:30px">S</button>
      <button data-ux-id="ok" style="width:44px;height:44px">OK</button>
    `);
    const findings = await detectSmallTouchTargets(page);
    expect(findings.map((item) => item.selector)).toEqual(['[data-ux-id="small"]']);
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
