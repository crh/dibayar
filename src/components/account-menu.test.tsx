import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("is closed by default", () => {
    render(<AccountMenu language="id" onChange={vi.fn()} />);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Menu akun" })).toHaveProperty("ariaExpanded", "false");
  });

  it("opens the menu on click, exposing the language toggle and sign-out row", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getByRole("menuitemradio", { name: "Indonesia" })).toBeDefined();
    expect(screen.getByRole("menuitemradio", { name: "English" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Keluar" })).toBeDefined();
  });

  it("calls onChange with the other language when the toggle is used", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountMenu language="id" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    await user.click(screen.getByRole("menuitemradio", { name: "English" }));

    expect(onChange).toHaveBeenCalledWith("en");
  });

  it("renders the sign-out row as quiet destructive text, not a filled button", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));

    const signOut = screen.getByRole("menuitem", { name: "Keluar" });
    expect(signOut.getAttribute("href")).toBe("/api/auth/signout?callbackUrl=/");
    expect(signOut.className).toContain("text-overdue");
    expect(signOut.className).not.toContain("ds-button-destructive");
    expect(signOut.className).not.toMatch(/bg-overdue(?!-tint)/);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AccountMenu language="id" onChange={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reaches both the language toggle and sign-out row via Tab", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Menu akun" });
    await user.click(trigger);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Indonesia" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "English" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Keluar" }));
  });

  it("gives the trigger button and menu items a touch target at least 44px", async () => {
    const user = userEvent.setup();
    render(<AccountMenu language="id" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Menu akun" });
    expect(trigger.className).toContain("h-11");
    expect(trigger.className).toContain("w-11");

    await user.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "Indonesia" }).className).toContain("h-11");
    expect(screen.getByRole("menuitem", { name: "Keluar" }).className).toContain("h-11");
  });
});
