import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DealRecord } from "@/lib/deals";
import { DEAL_DRAG_MIME } from "@/components/deals/deal-card";
import DealClient from "./deal-client";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockedUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockedUseSearchParams(),
}));

const dealFixture: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Acme",
  contactWa: "6281234567890",
  scope: "Video promosi",
  feeIdr: 1500000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockedUseSearchParams.mockReturnValue(new URLSearchParams());
});

describe("DealClient stage filter (T-14)", () => {
  it("pushes (not replaces) the URL when a stage filter chip is clicked, so back/forward can step through it", async () => {
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));

    expect(mockPush).toHaveBeenCalledWith("/deal?tahap=NEGO");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("pushes back to the plain /deal URL when Semua is selected", async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=NEGO"));
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Semua" }));

    expect(mockPush).toHaveBeenCalledWith("/deal");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("reflects the current URL's tahap value as the pressed filter, not stale local state", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=DEAL"));
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    expect(screen.getByRole("button", { name: "Deal" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("falls back to no filter when the URL's tahap value is invalid", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=NOT_A_STAGE"));
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("region")).toHaveLength(6);
  });
});

describe("DealClient stage movement (T-15)", () => {
  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  it("moves the card immediately (optimistic), before the request resolves", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Nego" }));

    // Moved immediately client-side, before the in-flight PATCH resolves.
    expect(screen.getAllByRole("region", { name: "Nego" })[0].textContent).toContain("Acme");

    resolveFetch(jsonResponse(200, { deal: { ...dealFixture, status: "NEGO" } }));
    vi.unstubAllGlobals();
  });

  it("rolls back to the prior stage and shows an error when the move request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(500, {}))));

    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Nego" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Deal belum bisa diperbarui. Coba lagi.");
    expect(screen.getAllByRole("region", { name: "Masuk" })[0].textContent).toContain("Acme");
    expect(screen.getAllByRole("region", { name: "Nego" })[0].textContent).not.toContain("Acme");

    vi.unstubAllGlobals();
  });

  it("does not issue a request when a card is dropped back onto the column it is already in", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    // dealFixture is already at MASUK; dropping it on the MASUK column is a no-op.
    const masukColumn = screen.getByRole("region", { name: "Masuk" });
    fireEvent.drop(masukColumn, {
      dataTransfer: { types: [DEAL_DRAG_MIME], getData: () => dealFixture.id, setData: vi.fn() },
    });

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
