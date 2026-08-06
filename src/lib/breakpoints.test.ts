import { describe, expect, it } from "vitest";
import { BREAKPOINTS } from "./breakpoints";

describe("breakpoints", () => {
  it("defines the five named breakpoints with exact spec values", () => {
    expect(BREAKPOINTS).toEqual({
      XS: 320,
      SM: 360,
      MD: 640,
      LG: 1024,
      XL: 1440,
    });
  });

  it("exposes exactly the five spec-named breakpoints, in band order", () => {
    expect(Object.keys(BREAKPOINTS)).toEqual(["XS", "SM", "MD", "LG", "XL"]);
  });

  it("is frozen at runtime, so the exported values cannot be mutated", () => {
    expect(Object.isFrozen(BREAKPOINTS)).toBe(true);
    expect(BREAKPOINTS).toEqual({
      XS: 320,
      SM: 360,
      MD: 640,
      LG: 1024,
      XL: 1440,
    });
  });
});
