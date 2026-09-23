import { vi } from "vitest";

// Vitest runs outside Next's build pipeline, so next/font/local's webpack
// loader (which resolves `src` file paths into real font-face CSS) never
// runs -- mock its return shape instead.
vi.mock("next/font/local", () => ({
  default: () => ({ variable: "font-local", className: "font-local" }),
}));
