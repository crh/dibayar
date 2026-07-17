import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { deleteDeal, getOwnedDeal, updateDeal, type DealRecord } from "@/lib/deals";
import { DELETE, GET, PATCH } from "./route";

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
const mockedGetOwnedDeal = vi.mocked(getOwnedDeal);
const mockedDeleteDeal = vi.mocked(deleteDeal);
const mockedUpdateDeal = vi.mocked(updateDeal);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeMalformedPatchRequest(id: string) {
  return new Request(`http://localhost/api/deals/${id}`, {
    method: "PATCH",
    body: "{not valid json",
  });
}

const deal: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "6281212345678",
  scope: "3 video TikTok",
  feeIdr: 1_500_000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-07-17T00:00:00.000Z"),
  updatedAt: new Date("2026-07-17T00:00:00.000Z"),
};

describe("GET /api/deals/[id]", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedGetOwnedDeal.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET(new Request("http://localhost/api/deals/deal-1"), makeContext("deal-1"));

    expect(response.status).toBe(401);
    expect(mockedGetOwnedDeal).not.toHaveBeenCalled();
  });

  it("mengembalikan 404 saat deal tidak ditemukan atau bukan milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedDeal.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/deals/deal-x"), makeContext("deal-x"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Deal tidak ditemukan.");
  });

  it("mengembalikan 200 beserta deal milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedDeal.mockResolvedValue(deal);

    const response = await GET(new Request("http://localhost/api/deals/deal-1"), makeContext("deal-1"));

    expect(response.status).toBe(200);
    expect((await response.json()).deal.id).toBe("deal-1");
    expect(mockedGetOwnedDeal).toHaveBeenCalledWith(expect.anything(), "deal-1", "user-1");
  });

  it("mengembalikan 500 terkontrol saat detail deal gagal dimuat", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedDeal.mockRejectedValue(new Error("database details must not leak"));

    const response = await GET(new Request("http://localhost/api/deals/deal-1"), makeContext("deal-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Deal belum bisa dimuat. Coba lagi." });
  });
});

describe("PATCH /api/deals/[id]", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedUpdateDeal.mockReset();
  });

  it("mengembalikan 400 saat body bukan JSON yang valid", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(makeMalformedPatchRequest("deal-1"), makeContext("deal-1"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Periksa kembali data deal kamu.");
    expect(body.fields).toBeUndefined();
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("mengembalikan 500 terkontrol saat auth() gagal karena masalah infrastruktur", async () => {
    mockedAuth.mockRejectedValue(new Error("auth provider unreachable"));

    const response = await PATCH(
      new Request("http://localhost/api/deals/deal-1", { method: "PATCH", body: JSON.stringify({ brand: "X" }) }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Deal belum bisa diperbarui. Coba lagi.");
    expect(mockedUpdateDeal).not.toHaveBeenCalled();
  });

  it("memperbarui deal milik pengguna yang sedang login", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateDeal.mockResolvedValue(deal);

    const response = await PATCH(
      new Request("http://localhost/api/deals/deal-1", { method: "PATCH", body: JSON.stringify({ brand: "Kopi Baru" }) }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(200);
    expect(mockedUpdateDeal).toHaveBeenCalledWith(expect.anything(), "deal-1", "user-1", { brand: "Kopi Baru" });
  });
});

describe("DELETE /api/deals/[id]", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedDeleteDeal.mockReset();
  });

  it("mengembalikan 500 terkontrol saat auth() gagal karena masalah infrastruktur", async () => {
    mockedAuth.mockRejectedValue(new Error("auth provider unreachable"));

    const response = await DELETE(
      new Request("http://localhost/api/deals/deal-1", { method: "DELETE" }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Deal belum bisa dihapus. Coba lagi.");
    expect(mockedDeleteDeal).not.toHaveBeenCalled();
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

  it("mengembalikan 500 terkontrol saat penghapusan deal gagal", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedDeleteDeal.mockRejectedValue(new Error("database details must not leak"));

    const response = await DELETE(
      new Request("http://localhost/api/deals/deal-1", { method: "DELETE" }),
      makeContext("deal-1"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Deal belum bisa dihapus. Coba lagi." });
  });
});
