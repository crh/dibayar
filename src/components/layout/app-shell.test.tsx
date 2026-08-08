import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/deal",
}));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders the top bar, side nav, and bottom nav around the page content", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByTestId("top-bar")).toBeDefined();
    expect(screen.getByTestId("side-nav")).toBeDefined();
    expect(screen.getByTestId("bottom-nav")).toBeDefined();
    expect(screen.getByText("page content")).toBeDefined();
  });

  it("puts page content inside a single main landmark, without nesting the shell inside it", () => {
    render(
      <AppShell>
        <main>page content</main>
      </AppShell>,
    );

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].textContent).toContain("page content");
  });

  it("derives the active nav item from the current pathname for every nav surface", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    for (const testId of ["top-bar-nav", "side-nav", "bottom-nav"]) {
      const container = screen.getByTestId(testId);
      const active = container.querySelector('[aria-current="page"]');
      expect(active?.textContent).toBe("Deal");
    }
  });

  it("renders the shell-owned account menu via the top bar", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByRole("button", { name: "Menu akun" })).toBeDefined();
  });

  it("renders exactly one floating action button and one account-menu trigger", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    // Both the top bar's inline "+ Deal" link and the FAB share the "+ Deal"
    // accessible name; the FAB is the one fixed-positioned over the content.
    const dealLinks = screen.getAllByRole("link", { name: "+ Deal" });
    const fabLinks = dealLinks.filter((link) => link.className.includes("fixed"));
    expect(fabLinks).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Menu akun" })).toHaveLength(1);
  });
});
