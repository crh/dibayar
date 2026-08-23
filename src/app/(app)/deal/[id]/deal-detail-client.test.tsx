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
