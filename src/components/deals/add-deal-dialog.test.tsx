import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { AddDealDialog } from "./add-deal-dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <AddDealDialog open={open} onClose={() => setOpen(false)} title="Tambah deal" closeLabel="Tutup">
        <input aria-label="Nama brand" />
        <button type="button">Simpan</button>
      </AddDealDialog>
    </div>
  );
}

describe("AddDealDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <AddDealDialog open={false} onClose={vi.fn()} title="Tambah deal" closeLabel="Tutup">
        <input aria-label="Nama brand" />
      </AddDealDialog>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves focus into the panel on open, landing on the first focusable element", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tutup" }));
  });

  // FIND-13: /deal?tambah=1 is rendered open by the server, so a field can
  // already have the keyboard when this component first runs in the browser.
  it("leaves focus where it is when it is already inside a dialog the server rendered open", () => {
    const ui = (
      <AddDealDialog open onClose={vi.fn()} title="Tambah deal" closeLabel="Tutup">
        <input aria-label="Nama brand" />
      </AddDealDialog>
    );
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(ui);
    const brandInput = container.querySelector("input")!;
    brandInput.focus();

    render(ui, { container, hydrate: true });

    expect(document.activeElement).toBe(brandInput);
  });

  it("still moves focus into a dialog the server rendered open when focus is outside it", () => {
    const ui = (
      <AddDealDialog open onClose={vi.fn()} title="Tambah deal" closeLabel="Tutup">
        <input aria-label="Nama brand" />
      </AddDealDialog>
    );
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(ui);

    render(ui, { container, hydrate: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tutup" }));
  });

  it("traps Tab focus within the panel, wrapping forward and backward at the ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const closeButton = screen.getByRole("button", { name: "Tutup" });
    const brandInput = screen.getByRole("textbox", { name: "Nama brand" });
    const saveButton = screen.getByRole("button", { name: "Simpan" });

    expect(document.activeElement).toBe(closeButton);

    await user.tab();
    expect(document.activeElement).toBe(brandInput);

    await user.tab();
    expect(document.activeElement).toBe(saveButton);

    // Tab from the last focusable element wraps back to the first.
    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    // Shift+Tab from the first focusable element wraps back to the last.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(saveButton);
  });

  it("closes on Escape and restores focus to the element that opened it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const openButton = screen.getByRole("button", { name: "Open" });
    await user.click(openButton);
    expect(screen.getByRole("dialog")).toBeDefined();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AddDealDialog open onClose={onClose} title="Tambah deal" closeLabel="Tutup">
        <input aria-label="Nama brand" />
      </AddDealDialog>,
    );

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AddDealDialog open onClose={onClose} title="Tambah deal" closeLabel="Tutup">
        <input aria-label="Nama brand" />
      </AddDealDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Tutup" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
