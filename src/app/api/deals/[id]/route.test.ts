import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { deleteDeal } from "@/lib/deals";
import { DELETE } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/deals", () => ({
  getOwnedDeal: vi.fn(),
  updateDeal: vi.fn(),
  deleteDeal: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedDeleteDeal = vi.mocked(deleteDeal);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/deals/[id]", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedDeleteDeal.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await DELETE(
      new Request("http://localhost/api/deals/deal-1", { method: "DELETE" }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(401);
    expect(mockedDeleteDeal).not.toHaveBeenCalled();
  });

  it("mengembalikan 404 saat deal tidak ditemukan atau bukan milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedDeleteDeal.mockResolvedValue({ kind: "not-found" });

    const response = await DELETE(
      new Request("http://localhost/api/deals/deal-x", { method: "DELETE" }),
      makeContext("deal-x"),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Deal tidak ditemukan.");
  });

  it("mengembalikan 409 saat deal masih punya invoice", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedDeleteDeal.mockResolvedValue({ kind: "has-invoices" });

    const response = await DELETE(
      new Request("http://localhost/api/deals/deal-1", { method: "DELETE" }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("Deal ini punya invoice, jadi belum bisa dihapus.");
  });

  it("menghapus deal milik pengguna yang tidak punya invoice", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedDeleteDeal.mockResolvedValue({ kind: "deleted" });

    const response = await DELETE(
      new Request("http://localhost/api/deals/deal-1", { method: "DELETE" }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(204);
    expect(mockedDeleteDeal).toHaveBeenCalledWith(expect.anything(), "deal-1", "user-1");
  });
});
