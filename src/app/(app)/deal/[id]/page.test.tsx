import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { auth } from "@/auth";
import { getOwnedDeal, listDealStageTransitions, type DealRecord } from "@/lib/deals";
import DealDetailPage from "./page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/deals", async () => {
  const actual = await vi.importActual<typeof import("@/lib/deals")>("@/lib/deals");
  return { ...actual, getOwnedDeal: vi.fn(), listDealStageTransitions: vi.fn() };
});

const { notFound, redirect } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ notFound, redirect }));

vi.mock("./deal-detail-client", () => ({
  default: ({ initialDeal, history }: { initialDeal: DealRecord; history: unknown[] }) => (
    <div data-testid="deal-detail-client">
      {initialDeal.brand} · {history.length}
    </div>
  ),
}));

const mockedAuth = vi.mocked(auth);
const mockedGetOwnedDeal = vi.mocked(getOwnedDeal);
const mockedListDealStageTransitions = vi.mocked(listDealStageTransitions);

const dealFixture: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "6281234567890",
  contactName: null,
  scope: "1 Reel + 2 Story",
  feeIdr: 2_500_000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

beforeEach(() => {
  notFound.mockClear();
  redirect.mockClear();
});

describe("/deal/:id", () => {
  it("redirects unauthenticated visitors to sign-in", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(DealDetailPage({ params: Promise.resolve({ id: "deal-1" }) })).rejects.toThrow(
      "REDIRECT:/api/auth/signin?callbackUrl=%2Fdeal",
    );
    expect(mockedGetOwnedDeal).not.toHaveBeenCalled();
  });

  it("renders 404 for a deal that doesn't exist or belongs to another user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" } as never);
    mockedGetOwnedDeal.mockResolvedValue(null);

    await expect(DealDetailPage({ params: Promise.resolve({ id: "deal-1" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mockedGetOwnedDeal).toHaveBeenCalledWith(expect.anything(), "deal-1", "user-1");
  });

  it("renders the deal and its stage history for the owning user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" } as never);
    mockedGetOwnedDeal.mockResolvedValue(dealFixture);
    mockedListDealStageTransitions.mockResolvedValue([
      { id: "t-1", dealId: "deal-1", fromStatus: null, toStatus: "MASUK", createdAt: new Date() },
    ]);

    const page = await DealDetailPage({ params: Promise.resolve({ id: "deal-1" }) });
    render(page);

    expect(screen.getByTestId("deal-detail-client").textContent).toBe("Kopi Nusantara · 1");
  });
});
