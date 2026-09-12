import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SideNav } from "./side-nav";

describe("SideNav", () => {
  it("is hidden below the LG band and a fixed-width column at LG and above", () => {
    render(<SideNav pathname="/" />);

    const nav = screen.getByTestId("side-nav");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("min-[1024px]:flex");
    expect(nav.className).toContain("min-[1024px]:w-[240px]");
    expect(nav.className).toContain("min-[1440px]:w-[264px]");
  });

  it("stays persistent beneath the 64px sticky TopBar at LG and above", () => {
    render(<SideNav pathname="/" />);

    const nav = screen.getByTestId("side-nav");
    expect(nav.className).toContain("min-[1024px]:sticky");
    expect(nav.className).toContain("min-[1024px]:top-16");
    expect(nav.className).toContain("min-[1024px]:min-h-[calc(100vh-4rem)]");
    expect(nav.className).toContain("min-[1024px]:overflow-y-auto");
  });

  it("uses min-height (not a fixed height) so its background stretches to match a taller main column instead of leaving a seam", () => {
    render(<SideNav pathname="/" />);

    const nav = screen.getByTestId("side-nav");
    expect(nav.className).not.toMatch(/min-\[1024px\]:h-\[calc\(100vh-4rem\)\]/);
  });

  it("renders the four nav items in order, each a 44px touch target", () => {
    render(<SideNav pathname="/" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Beranda", "Deal", "Invoice", "Pengaturan"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/deal", "/invoice", "/pengaturan"]);
    for (const link of links) {
      expect(link.className).toContain("h-11");
      expect(link.className).toContain("rounded-[12px]");
    }
  });

  it("marks the active item with aria-current=page and a visibly distinct style", () => {
    render(<SideNav pathname="/pengaturan" />);

    const active = screen.getByRole("link", { name: "Pengaturan" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("border-l-primary");
    expect(active.className).toContain("bg-primary-tint");

    const inactive = screen.getByRole("link", { name: "Beranda" });
    expect(inactive.getAttribute("aria-current")).toBeNull();
    expect(inactive.className).not.toContain("bg-primary-tint");
  });

  it("treats a nested detail route as belonging to its parent nav item", () => {
    render(<SideNav pathname="/invoice/inv-1" />);

    expect(screen.getByRole("link", { name: "Invoice" }).getAttribute("aria-current")).toBe("page");
  });
});
