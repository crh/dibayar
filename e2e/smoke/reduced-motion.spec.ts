// Real-interaction coverage for the reduced-motion preference
// (docs/testing/journey-coverage.json: A11Y-04).
//
// The app's motion is the account menu sliding up (a 200 ms keyframe
// animation, src/components/account-menu.tsx) and the colour/transform
// transitions on buttons, fields and links (globals.css, 150-180 ms). With
// `prefers-reduced-motion: reduce` one rule in globals.css cuts every
// animation and transition to 0.01 ms.
//
// What a person with that preference must get is "the same controls, and
// nothing moves". So each test opens the account menu, opens and closes the
// add-deal dialog and marks an invoice paid through the visible controls,
// and after every step measures motion the way the browser reports it, three
// ways:
//
// - how long every animation and transition that finished actually ran, from
//   the browser's own animationend / transitionend events (recorded from the
//   first script of every page);
// - the longest animation still running (document.getAnimations(); a
//   finished one is no longer listed, which is why the events are recorded);
// - the longest animation/transition duration any element would use
//   (computed style).
//
// It is a measurement of motion, not a screenshot.
//
// The first test is the control: with no preference, the same menu reports
// an animation that ran for 200 ms and transitions of at least 150 ms, so
// each way of measuring is known to see the app's motion when there is some.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { press, responseTo } from "../support/journey";

// The reduced-motion rule's own value, in milliseconds.
const REDUCED_MS = 0.01;

type Motion = { finishedMs: number; finished: number; runningMs: number; animationMs: number; transitionMs: number };

// Records, in every page of the context, how long each finished animation
// and transition ran (elapsedTime is in seconds).
async function recordFinishedMotion(page: Page) {
  await page.addInitScript(() => {
    const finished: Array<{ type: string; ms: number }> = [];
    (window as unknown as { __finishedMotion: typeof finished }).__finishedMotion = finished;
    // The cancel events too: motion cut short (its element removed, the
    // property changed again) reports how long it had run the same way.
    for (const type of ["animationend", "transitionend", "animationcancel", "transitioncancel"] as const) {
      document.addEventListener(type, (event) => finished.push({ type, ms: (event as AnimationEvent | TransitionEvent).elapsedTime * 1000 }), true);
    }
  });
}

// The longest motion on the page right now, in milliseconds.
async function measureMotion(page: Page): Promise<Motion> {
  return page.evaluate(() => {
    const toMs = (value: string) =>
      Math.max(0, ...value.split(",").map((part) => {
        const text = part.trim();
        const number = Number.parseFloat(text);
        if (!Number.isFinite(number)) return 0;
        return text.endsWith("ms") ? number : number * 1000;
      }));
    let animationMs = 0;
    let transitionMs = 0;
    for (const element of document.querySelectorAll("*")) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        if (style.animationName !== "none") animationMs = Math.max(animationMs, toMs(style.animationDuration));
        if (style.transitionProperty !== "none") transitionMs = Math.max(transitionMs, toMs(style.transitionDuration));
      }
    }
    const runningMs = Math.max(0, ...document.getAnimations().map((animation) => {
      const duration = animation.effect?.getComputedTiming().duration;
      return typeof duration === "number" ? duration : 0;
    }));
    const finished = (window as unknown as { __finishedMotion?: Array<{ type: string; ms: number }> }).__finishedMotion ?? [];
    return { finishedMs: Math.max(0, ...finished.map((entry) => entry.ms)), finished: finished.length, runningMs, animationMs, transitionMs };
  });
}

function longest(motion: Motion): number {
  return Math.max(motion.finishedMs, motion.runningMs, motion.animationMs, motion.transitionMs);
}

async function openAccountMenu(page: Page, isMobile: boolean) {
  await press(page.getByRole("button", { name: "Menu akun" }), isMobile);
  const menu = page.getByRole("menu", { name: "Menu akun" });
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("reduced motion", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("control: with no motion preference the account menu animates and buttons have transitions", async ({ page, isMobile }) => {
    await recordFinishedMotion(page);
    await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);
    // Beranda's loading placeholders pulse on a 2 s animation of their own.
    // Wait until they are gone, so the longest animation measured below is
    // the menu's (CI run 38127790377 measured 2000 ms here once, on retry 200).
    await expect(page.locator('[data-testid$="-skeleton"]')).toHaveCount(0);
    const menu = await openAccountMenu(page, isMobile);
    expect(await menu.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("0.2s");
    const motion = await measureMotion(page);
    expect(motion.animationMs).toBe(200);
    expect(motion.transitionMs).toBeGreaterThanOrEqual(150);
    // The slide really ran, for its 200 ms (allowing the browser's rounding).
    await expect.poll(async () => (await measureMotion(page)).finishedMs).toBeGreaterThanOrEqual(199);
  });

  test.describe("prefers-reduced-motion: reduce", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("opening the account menu and the add-deal dialog, and marking an invoice paid, all work with no motion", async ({ page, isMobile }) => {
      const manifest = loadFixtureManifest();
      const expectStill = async (step: string) => {
        const motion = await measureMotion(page);
        expect(longest(motion), `${step}: longest motion on the page, in ms (${JSON.stringify(motion)})`).toBeLessThanOrEqual(REDUCED_MS);
      };

      await recordFinishedMotion(page);
      await page.goto("/");
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      await expectStill("Beranda");

      // The account menu: the same menu, in its final place at once. Its
      // animation still "runs" and ends, in 0.01 ms: wait for that end, so
      // the measurement below includes it.
      const menu = await openAccountMenu(page, isMobile);
      await expect.poll(async () => (await measureMotion(page)).finished, { message: "the menu's shortened animation has ended" }).toBeGreaterThanOrEqual(1);
      await expectStill("account menu open");
      expect(await menu.evaluate((element) => {
        const style = getComputedStyle(element);
        return { opacity: style.opacity, transform: style.transform };
      })).toEqual({ opacity: "1", transform: "none" });
      await expect(menu.getByRole("menuitem", { name: "Pengaturan" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expectStill("account menu closed");

      // The add-deal dialog, opened from the visible + Deal and closed again.
      const plusDeal = isMobile
        ? page.getByRole("link", { name: "+ Deal", exact: true })
        : page.getByTestId("top-bar").getByRole("link", { name: "+ Deal", exact: true });
      await press(plusDeal, isMobile);
      const dialog = page.getByRole("dialog", { name: "Tambah deal" });
      await expect(dialog).toBeVisible();
      await expectStill("add-deal dialog open");
      await press(dialog.getByRole("button", { name: "Tutup" }), isMobile);
      await expect(dialog).toHaveCount(0);
      await expectStill("add-deal dialog closed");

      // A status action still does its job, and its "paid" moment does not move.
      await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/invoice$/);
      await expectStill("invoice list");
      await press(page.getByRole("link", { name: new RegExp(manifest.brands[manifest.deals.invoiceSent]) }), isMobile);
      await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
      await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
      await expectStill("invoice detail");
      const paid = await responseTo(page, "PATCH", `/api/invoices/${manifest.invoices.sent}`, () =>
        press(page.getByRole("region", { name: "Status pembayaran" }).getByRole("button", { name: "Tandai lunas", exact: true }), isMobile));
      expect(paid.ok()).toBe(true);
      await expect(page.getByText("Lunas — invoice ini sudah selesai.")).toBeVisible();
      await expectStill("after Tandai lunas");
      await page.reload();
      await expect(page.getByRole("main").locator("header").first().getByText("Lunas ✓", { exact: true })).toBeVisible();
      await expectStill("after reload");
    });
  });
});
