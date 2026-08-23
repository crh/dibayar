import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DealRecord, DealStageTransitionRecord } from "@/lib/deals";
import DealDetailClient from "./deal-detail-client";

const dealFixture: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "+6281234567890",
  contactName: null,
  scope: "1 Reel + 2 Story",
  feeIdr: 2_500_000,
  deadline: new Date("2026-09-01T00:00:00.000Z"),
  paymentTerms: null,
  status: "NEGO",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const historyFixture: DealStageTransitionRecord[] = [
  { id: "t-2", dealId: "deal-1", fromStatus: "MASUK", toStatus: "NEGO", createdAt: new Date("2026-08-02T00:00:00.000Z") },
  { id: "t-1", dealId: "deal-1", fromStatus: null, toStatus: "MASUK", createdAt: new Date("2026-08-01T00:00:00.000Z") },
];

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("DealDetailClient", () => {
  it("shows the deal's brand, current stage, fee, deadline, and scope", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    expect(screen.getByRole("heading", { name: "Kopi Nusantara" })).toBeDefined();
    expect(screen.getByText(/Nego/)).toBeDefined();
    expect(screen.getByText("Rp 2.500.000")).toBeDefined();
    expect(screen.getByText("1 Sep 2026")).toBeDefined();
    expect(screen.getByText("1 Reel + 2 Story")).toBeDefined();
  });

  it("renders the stage history newest first, with a distinct label for the creation entry", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={historyFixture} />);

    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items[0]).toContain("Masuk → Nego");
    expect(items[1]).toContain("Deal dibuat langsung di tahap Masuk");
  });

  it("shows an empty-history message when there is no stage history yet", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);
    expect(screen.getByText("Belum ada riwayat perpindahan tahap.")).toBeDefined();
  });

  it("saves an edited contact name and shows a success message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { deal: { ...dealFixture, contactName: "Budi" } }))),
    );
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    await user.type(screen.getByLabelText("Nama kontak"), "Budi");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Nama kontak disimpan");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/deals/deal-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ contactName: "Budi" }),
      }),
    );
  });

  it("shows an error and keeps the typed value when saving the contact name fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(500, {}))));
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    await user.type(screen.getByLabelText("Nama kontak"), "Budi");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Nama kontak belum bisa disimpan. Coba lagi.",
    );
    expect(screen.getByLabelText("Nama kontak")).toHaveProperty("value", "Budi");
  });
});

describe("DealDetailClient WhatsApp action (T-18)", () => {
  it("offers a Buka WhatsApp button for a valid contact number, and never opens it on its own", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    expect(screen.getByRole("button", { name: "Buka WhatsApp" })).toBeDefined();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("opens wa.me with the deal's brand in the message only when the button is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    await user.click(screen.getByRole("button", { name: "Buka WhatsApp" }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [href, target, features] = openSpy.mock.calls[0];
    expect(href).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(decodeURIComponent(String(href))).toContain("Kopi Nusantara");
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("shows a repair form instead of the WhatsApp button when the contact number is invalid", () => {
    render(<DealDetailClient initialDeal={{ ...dealFixture, contactWa: "not-a-phone" }} history={[]} />);

    expect(screen.getByRole("alert").textContent).toBe("Nomor WhatsApp ini sepertinya tidak valid. Perbaiki dulu di bawah.");
    expect(screen.getByLabelText("Perbaiki nomor WhatsApp")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Buka WhatsApp" })).toBeNull();
  });

  it("repairing the number only unblocks the WhatsApp button -- saving never opens WhatsApp by itself", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse(200, { deal: { ...dealFixture, contactWa: "+6281234567890" } })),
      ),
    );
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={{ ...dealFixture, contactWa: "not-a-phone" }} history={[]} />);

    const input = screen.getByLabelText("Perbaiki nomor WhatsApp");
    await user.clear(input);
    await user.type(input, "+6281234567890");
    await user.click(screen.getByRole("button", { name: "Simpan nomor" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Nomor WhatsApp disimpan");
    expect(screen.getByRole("button", { name: "Buka WhatsApp" })).toBeDefined();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
