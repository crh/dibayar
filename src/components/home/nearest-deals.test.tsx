import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import { NearestDeals } from "./nearest-deals";

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brand: "Brand",
    contactWa: "+6281234567890",
    contactName: null,
    scope: "1 video Reels",
    feeIdr: 1_000_000,
    deadline: null,
    paymentTerms: null,
    status: "NEGO",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Before every fixture deadline below, so none of these tests exercise the
// overdue-styling path by accident -- that has its own dedicated tests.
const NOW = new Date("2026-07-01T00:00:00.000Z");

function renderNearest(deals: DealRecord[] | null) {
  return render(
    <LanguageProvider initialLanguage="id">
      <NearestDeals deals={deals} now={NOW} />
    </LanguageProvider>,
  );
}

describe("NearestDeals — selection", () => {
  it("excludes DIBAYAR deals and shows the three nearest deadlines, correctly linked, nearest first", () => {
    const paidSoonest = makeDeal({ id: "deal-paid", brand: "Paid Brand", status: "DIBAYAR", deadline: new Date("2026-07-20T00:00:00.000Z") });
    const nearest1 = makeDeal({ id: "deal-2", brand: "Second Nearest", status: "NEGO", deadline: new Date("2026-07-21T00:00:00.000Z") });
    const nearest2 = makeDeal({ id: "deal-4", brand: "Third Nearest", status: "INVOICE", deadline: new Date("2026-07-22T00:00:00.000Z") });
    const nearest3 = makeDeal({ id: "deal-3", brand: "First Nearest Fallback", status: "KONTEN", deadline: new Date("2026-07-24T00:00:00.000Z") });
    const farFuture = makeDeal({ id: "deal-5", brand: "Far Future Brand", status: "MASUK", deadline: new Date("2026-07-29T00:00:00.000Z") });

    renderNearest([paidSoonest, nearest1, nearest2, nearest3, farFuture]);

    const section = screen.getByRole("region", { name: "3 deal terdekat" });
    const links = within(section)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/deal/"));

    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/deal/deal-2", "/deal/deal-4", "/deal/deal-3"]);

    // DIBAYAR and the fourth-nearest deal are both excluded from the rendered list.
    expect(within(section).queryByText("Paid Brand")).toBeNull();
    expect(within(section).queryByText("Far Future Brand")).toBeNull();
  });

  it("renders the Indonesian empty-state copy and no list when there are no eligible deals", () => {
    renderNearest([]);

    expect(screen.getByText("Semua deal sudah selesai.")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("gives the 'Lihat semua' link a >=44px hit target without growing its visible size (T-27)", () => {
    renderNearest([]);

    expect(screen.getByRole("link", { name: "Lihat semua →" }).className).toMatch(/ds-tap-target/);
  });

  it("shows a 'Telat N hari' label instead of the plain date for a deal whose deadline has already passed", () => {
    const overdueDeal = makeDeal({ id: "deal-overdue", brand: "Overdue Brand", status: "KONTEN", deadline: new Date("2026-06-28T00:00:00.000Z") });
    render(
      <LanguageProvider initialLanguage="id">
        <NearestDeals deals={[overdueDeal]} now={new Date("2026-07-01T00:00:00.000Z")} />
      </LanguageProvider>,
    );

    expect(screen.getByText("Telat 3 hari")).toBeDefined();
  });

  it("shows the plain date, not an overdue label, for a deal whose deadline has not passed", () => {
    const upcomingDeal = makeDeal({ id: "deal-upcoming", brand: "Upcoming Brand", status: "KONTEN", deadline: new Date("2026-07-05T00:00:00.000Z") });
    renderNearest([upcomingDeal]);

    expect(screen.queryByText(/Telat/)).toBeNull();
  });
});
