import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DealRecord } from "@/lib/deals";
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
