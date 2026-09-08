import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FloatingActionButton } from "./floating-action-button";

describe("FloatingActionButton", () => {
  it("links to /deal?tambah=1 with an accessible + Deal name", () => {
    render(<FloatingActionButton />);

    const link = screen.getByRole("link", { name: "+ Deal" });
    expect(link.getAttribute("href")).toBe("/deal?tambah=1");
  });

  it("is a fixed 56px circle pinned bottom-right above the bottom nav and safe area, hidden at SM and above", () => {
    render(<FloatingActionButton />);

    const link = screen.getByRole("link", { name: "+ Deal" });
    expect(link.className).toContain("fixed");
    expect(link.className).toContain("h-14");
    expect(link.className).toContain("w-14");
    expect(link.className).toContain("right-4");
    expect(link.className).toContain("bottom-[calc(72px+env(safe-area-inset-bottom))]");
    expect(link.className).toContain("min-[640px]:hidden");
  });
});
