import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { TopBar } from "./top-bar";

describe("TopBar", () => {
  it("shows the product name and hides the route title below the LG band", () => {
    render(<TopBar pathname="/deal" />);

    const product = screen.getByText("Dibayar");
    expect(product.className).toContain("min-[1024px]:hidden");
    const routeTitle = screen.getByTestId("route-title");
    expect(routeTitle.textContent).toBe("Deal");
    expect(routeTitle.className).toContain("hidden");
    expect(routeTitle.className).toContain("min-[1024px]:inline");
  });

  it("renders the four nav items in order as inline links, visible only in the MD band", () => {
    render(<TopBar pathname="/" />);

    const nav = screen.getByTestId("top-bar-nav");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("min-[640px]:flex");
    expect(nav.className).toContain("min-[1024px]:hidden");

    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Beranda", "Deal", "Invoice", "Pengaturan"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/deal", "/invoice", "/pengaturan"]);
  });

  it("gives each inline nav link a 44px-tall touch target", () => {
    render(<TopBar pathname="/" />);

    const nav = screen.getByTestId("top-bar-nav");
    const links = within(nav).getAllByRole("link");
    for (const link of links) {
      expect(link.className).toContain("h-11");
      expect(link.className).toContain("flex");
      expect(link.className).toContain("items-center");
    }
  });

  it("marks only the active nav item with aria-current=page", () => {
    render(<TopBar pathname="/invoice" />);

    const nav = screen.getByTestId("top-bar-nav");
    const active = within(nav).getByRole("link", { name: "Invoice" });
    expect(active.getAttribute("aria-current")).toBe("page");

    const inactive = within(nav).getByRole("link", { name: "Deal" });
    expect(inactive.getAttribute("aria-current")).toBeNull();
  });

  it("treats a nested detail route as belonging to its parent nav item", () => {
    render(<TopBar pathname="/deal/abc123" />);

    const nav = screen.getByTestId("top-bar-nav");
    expect(within(nav).getByRole("link", { name: "Deal" }).getAttribute("aria-current")).toBe("page");
  });

  it("renders the account menu trigger as the sole owner of account menu integration", () => {
    render(<TopBar pathname="/" />);

    expect(screen.getByRole("button", { name: "Menu akun" })).toBeDefined();
  });

  it("is a fixed 56px bar below the MD band and 64px at MD and above", () => {
    render(<TopBar pathname="/" />);

    const bar = screen.getByTestId("top-bar");
    expect(bar.className).toContain("h-14");
    expect(bar.className).toContain("min-[640px]:h-16");
  });

  it("shows an inline + Deal link to /deal, hidden below the SM band by class contract", () => {
    render(<TopBar pathname="/" />);

    const link = screen.getByRole("link", { name: "+ Deal" });
    expect(link.getAttribute("href")).toBe("/deal");
    expect(link.className).not.toContain("hidden");
    const wrapper = link.parentElement!;
    expect(wrapper.className).toContain("hidden");
    expect(wrapper.className).toContain("min-[640px]:flex");
  });

  it("shows a Buat invoice link to /deal?tahap=INVOICE, visible only at the LG band by class contract", () => {
    render(<TopBar pathname="/" />);

    const link = screen.getByRole("link", { name: "Buat invoice" });
    expect(link.getAttribute("href")).toBe("/deal?tahap=INVOICE");
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("min-[1024px]:inline-flex");
  });
});
