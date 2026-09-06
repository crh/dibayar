import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("is a fixed 56px bar visible below the MD band only", () => {
    render(<BottomNav pathname="/" />);

    const nav = screen.getByTestId("bottom-nav");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");
    expect(nav.className).toContain("h-14");
    expect(nav.className).toContain("min-[640px]:hidden");
  });

  it("renders the four nav items in order, each at least 44px tall", () => {
    render(<BottomNav pathname="/" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Beranda", "Deal", "Invoice", "Pengaturan"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/deal", "/invoice", "/pengaturan"]);
    for (const link of links) {
      expect(link.className).toContain("min-h-11");
    }
  });

  it("marks the active item with aria-current=page and a visibly distinct style", () => {
    render(<BottomNav pathname="/deal" />);

    const active = screen.getByRole("link", { name: "Deal" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("text-primary");

    const inactive = screen.getByRole("link", { name: "Beranda" });
    expect(inactive.getAttribute("aria-current")).toBeNull();
  });

  it("treats a nested detail route as belonging to its parent nav item", () => {
    render(<BottomNav pathname="/deal/abc123" />);

    expect(screen.getByRole("link", { name: "Deal" }).getAttribute("aria-current")).toBe("page");
  });
});
