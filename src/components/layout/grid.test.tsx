import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { Grid } from "./grid";
import { BREAKPOINTS } from "@/lib/breakpoints";

describe("Grid", () => {
  it("renders a stable ds-grid class contract and preserves className passthrough", () => {
    const { container } = render(
      <Grid className="custom-extra">
        <span>one</span>
      </Grid>,
    );
    const root = container.firstElementChild;
    expect(root?.classList.contains("ds-grid")).toBe(true);
    expect(root?.classList.contains("custom-extra")).toBe(true);
  });

  it("does not change child DOM order", () => {
    render(
      <Grid>
        <span>alpha</span>
        <span>beta</span>
        <span>gamma</span>
      </Grid>,
    );
    const texts = screen.getAllByText(/alpha|beta|gamma/).map((el) => el.textContent);
    expect(texts).toEqual(["alpha", "beta", "gamma"]);
  });

  it("declares single-column base layout and a 12-column/24px-gutter rule at the LG breakpoint in globals.css", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

    const baseRuleMatch = css.match(/\.ds-grid\s*\{[^}]*\}/);
    expect(baseRuleMatch).not.toBeNull();
    // minmax(0, 1fr) rather than a bare 1fr: a bare `1fr` track's minimum
    // sizing function is `auto`, which grows the track (and the page) to
    // fit the widest child's min-content/max-content size instead of
    // shrinking to the viewport -- the root cause of a real page-overflow
    // bug (T-27). minmax(0, 1fr) caps the automatic minimum at 0 so
    // content wraps/shrinks inside the track instead of expanding it.
    expect(baseRuleMatch![0]).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);

    const lgQueryMatch = css.match(new RegExp(`@media \\(min-width:\\s*${BREAKPOINTS.LG}px\\)\\s*\\{[\\s\\S]*?\\.ds-grid\\s*\\{[^}]*\\}`));
    expect(lgQueryMatch).not.toBeNull();
    expect(lgQueryMatch![0]).toMatch(/grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
    expect(lgQueryMatch![0]).toMatch(/gap:\s*24px/);
  });

  it("does not duplicate breakpoint values as unused CSS custom properties", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

    expect(css).not.toMatch(/--bp-(xs|sm|md|lg|xl)\s*:/);
  });

  it("declares a reusable 44px minimum tap-target overlay (T-27)", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

    expect(css).toMatch(/\.ds-tap-target\s*\{[^}]*position:\s*relative/);
    const overlayMatch = css.match(/\.ds-tap-target::before\s*\{[^}]*\}/);
    expect(overlayMatch).not.toBeNull();
    expect(overlayMatch![0]).toMatch(/width:\s*max\(100%,\s*44px\)/);
    expect(overlayMatch![0]).toMatch(/height:\s*max\(100%,\s*44px\)/);
  });
});
