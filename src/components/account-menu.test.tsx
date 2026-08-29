import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("is closed by default", () => {
    render(<AccountMenu language="id" />);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Menu akun" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the menu on click, exposing the Settings and Sign Out rows", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Pengaturan" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Keluar" })).toBeDefined();
  });

  it("opens the menu on click, exposing the Settings and Sign Out rows in English", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="en" />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeDefined();
  });

  it("does not render a language switch — language selection moved out of the account menu", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    expect(screen.queryByRole("menuitemradio")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows the authenticated user's email when provided", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" email="chris@example.com" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    expect(screen.getByText("chris@example.com")).toBeDefined();
  });

  it("omits the email row when no email is provided", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    expect(screen.queryByText("@")).toBeNull();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Menu akun" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AccountMenu language="id" />
        <button type="button">Outside</button>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reaches both the Settings and Sign Out rows via Tab", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    const trigger = screen.getByRole("button", { name: "Menu akun" });
    await user.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Pengaturan" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Keluar" }));
  });

  it("reaches both the Settings and Sign Out rows via Tab in English", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="en" />);

    const trigger = screen.getByRole("button", { name: "Account menu" });
    await user.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Settings" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Sign out" }));
  });

  it("moves focus into the menu when it opens", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    const trigger = screen.getByRole("button", { name: "Menu akun" });
    expect(document.activeElement).not.toBe(trigger);

    await user.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Pengaturan" }));
    expect(document.activeElement).not.toBe(trigger);
  });

  it("gives the trigger button and menu items a touch target at least 44px", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    const trigger = screen.getByRole("button", { name: "Menu akun" });
    expect(trigger.className).toContain("h-11");
    expect(trigger.className).toContain("w-11");

    await user.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Pengaturan" }).className).toContain("h-11");
    expect(screen.getByRole("menuitem", { name: "Keluar" }).className).toContain("h-11");
  });

  it("gives the mobile sheet's close button a genuine 44x44 hit target, not just an enlarged glyph (T-27)", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });
    window.dispatchEvent(new Event("resize"));

    const user = userEvent.setup();
    render(<AccountMenu language="id" />);
    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    const closeButton = screen.getByRole("button", { name: "Tutup" });
    expect(closeButton.className).toContain("h-11");
    expect(closeButton.className).toContain("w-11");
    expect(closeButton.textContent).toBe("×");

    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: originalWidth });
  });

  it("closes and focuses trigger when a menu item is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    const trigger = screen.getByRole("button", { name: "Menu akun" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(screen.getByRole("menuitem", { name: "Pengaturan" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes and focuses trigger when a menu item is clicked in English", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="en" />);

    const trigger = screen.getByRole("button", { name: "Account menu" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses fixed desktop positioning anchored to the trigger, not a CSS-relative offset", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("fixed");
    expect(menu.className).not.toContain("absolute");
  });

  it("pushes the desktop menu below a content landmark it would otherwise overlap (T-27 F2)", async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 768 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 900 });

    const triggerRect = { x: 700, y: 9.5, width: 44, height: 44, top: 9.5, left: 700, right: 744, bottom: 53.5, toJSON() {} };
    const menuSizeRect = { x: 0, y: 0, width: 260, height: 146.5, top: 0, left: 0, right: 0, bottom: 146.5, toJSON() {} };
    const cardRect = { x: 48, y: 96, width: 672, height: 141.5, top: 96, left: 48, right: 720, bottom: 237.5, toJSON() {} };

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.matches('button[aria-haspopup="menu"]')) return triggerRect as DOMRect;
        if (this.matches('[role="menu"]')) return menuSizeRect as DOMRect;
        if (this.matches('[data-testid="obstacle"]')) return cardRect as DOMRect;
        return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} } as DOMRect;
      });

    // jsdom doesn't implement elementsFromPoint; stand it up for this test so
    // the collision pass has something real to sample against.
    document.elementsFromPoint = vi.fn((x: number, y: number) => {
      const card = document.querySelector('[data-testid="obstacle"]');
      if (card && x >= cardRect.left && x <= cardRect.right && y >= cardRect.top && y <= cardRect.bottom) {
        return [card];
      }
      return [];
    });

    const user = userEvent.setup();
    render(
      <div>
        <AccountMenu language="id" />
        <section data-testid="obstacle" aria-label="Income figure" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    const menu = screen.getByRole("menu");
    // Naive placement (trigger.bottom + gap) would land at 61.5px, which
    // overlaps the 96..237.5 obstacle -- the menu must clear it instead.
    expect(menu.style.top).toBe("245.5px");

    rectSpy.mockRestore();
    // @ts-expect-error -- test-only cleanup of the jsdom polyfill above.
    delete document.elementsFromPoint;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: originalHeight });
  });

  it("closes when the route changes via client navigation, not only browser back/forward", async () => {
    const usePathnameMock = vi.fn().mockReturnValue("/deal");
    vi.doMock("next/navigation", () => ({ usePathname: usePathnameMock }));
    vi.resetModules();
    const { AccountMenu: IsolatedAccountMenu } = await import("./account-menu");

    const user = userEvent.setup();
    const { rerender } = render(<IsolatedAccountMenu language="id" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByRole("menu")).toBeDefined();

    usePathnameMock.mockReturnValue("/invoice");
    rerender(<IsolatedAccountMenu language="id" />);

    expect(screen.queryByRole("menu")).toBeNull();

    vi.doUnmock("next/navigation");
    vi.resetModules();
  });
});
