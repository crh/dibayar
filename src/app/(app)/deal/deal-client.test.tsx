import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
  contactName: null,
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
  afterEach(() => {
    window.history.replaceState(null, "", "/deal");
  });

  it("updates the URL via history.pushState (not a router navigation) when a stage filter chip is clicked, so back/forward can step through it without a server round trip", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/deal?tahap=NEGO");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Nego" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("updates the URL back to the plain /deal path when Semua is selected", async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=NEGO"));
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Semua" }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/deal");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not fetch or navigate when switching filters — the already-loaded deals are filtered client-side", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));
    await user.click(screen.getByRole("button", { name: "Semua" }));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reflects the current URL's tahap value as the pressed filter on initial render", () => {
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

  it("restores the filter shown before the click when the user navigates back (popstate), without a server round trip", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));
    expect(screen.getByRole("button", { name: "Nego" }).getAttribute("aria-pressed")).toBe("true");

    // Simulate the browser restoring the prior URL and firing popstate, as it
    // does for a same-document history entry created by pushState.
    window.history.replaceState(null, "", "/deal");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("picks up a tahap filter added by a same-route Next.js navigation (e.g. TopBar's New Invoice link) on the already-mounted instance", () => {
    const { rerender } = render(
      <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />
    );
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("false");

    // Same mounted DealClient instance: only the reactive searchParams value
    // changes, as it would after a <Link href="/deal?tahap=INVOICE"> click.
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=INVOICE"));
    rerender(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("clears the filter when a same-route Next.js navigation removes tahap from the URL (e.g. TopBar's New Deal link) on the already-mounted instance", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=INVOICE"));
    const { rerender } = render(
      <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />
    );
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");

    // Same mounted DealClient instance: only the reactive searchParams value
    // changes, as it would after a <Link href="/deal"> click.
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    rerender(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("false");
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
