import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodError } from "zod";
import { auth } from "@/auth";
import { dealInputSchema } from "@/lib/deal-validation";
import { createDealOnce, listDeals, type DealRecord } from "@/lib/deals";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/deals", () => ({
  createDealOnce: vi.fn(),
  listDeals: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedCreateDeal = vi.mocked(createDealOnce);
const mockedListDeals = vi.mocked(listDeals);

function makeRequest(body: unknown, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/deals", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest(headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/deals", {
    method: "POST",
    headers,
    body: "{not valid json",
  });
}

function parseInvalidInputError(): ZodError {
  const result = dealInputSchema.safeParse({});
  if (result.success) throw new Error("expected schema.safeParse to fail");
  return result.error;
}

const deal: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "6281212345678",
  contactName: null,
  scope: "3 video TikTok",
  feeIdr: 1_500_000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-07-17T00:00:00.000Z"),
  updatedAt: new Date("2026-07-17T00:00:00.000Z"),
};

describe("GET /api/deals", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedListDeals.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Kamu harus masuk terlebih dahulu.");
    expect(mockedListDeals).not.toHaveBeenCalled();
  });

  it("mengembalikan daftar deal milik pengguna yang sedang login", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedListDeals.mockResolvedValue([deal]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deals).toEqual([
      { ...deal, createdAt: deal.createdAt.toISOString(), updatedAt: deal.updatedAt.toISOString() },
    ]);
    expect(mockedListDeals).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("mengembalikan 500 terkontrol saat daftar deal gagal dimuat", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedListDeals.mockRejectedValue(new Error("database details must not leak"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Deal belum bisa dimuat. Coba lagi." });
  });
});

describe("POST /api/deals", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateDeal.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Kamu harus masuk terlebih dahulu.");
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });

  it("mengembalikan 400 saat input tidak valid", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateDeal.mockRejectedValue(parseInvalidInputError());

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Periksa kembali data deal kamu.");
    expect(body.fields).toBeDefined();
  });

  it("mengembalikan 201 beserta deal saat berhasil dibuat", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateDeal.mockResolvedValue({ record: deal, replayed: false });

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.deal.id).toBe("deal-1");
    expect(body.deal.brand).toBe("Kopi Nusantara");
  });

  it("mengembalikan 500 untuk error tak terduga yang bukan ZodError", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateDeal.mockRejectedValue(new Error("db down"));

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Deal belum bisa disimpan. Coba lagi.");
  });

  it("mengembalikan 400 saat body bukan JSON yang valid", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(makeMalformedRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Periksa kembali data deal kamu.");
    expect(body.fields).toBeUndefined();
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });

  it("mengembalikan 500 terkontrol saat auth() gagal karena masalah infrastruktur", async () => {
    mockedAuth.mockRejectedValue(new Error("auth provider unreachable"));

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Deal belum bisa disimpan. Coba lagi.");
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });
});

describe("same-origin protection for POST /api/deals", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateDeal.mockReset();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("allows a same-origin POST", async () => {
    mockedCreateDeal.mockResolvedValue({ record: deal, replayed: false });

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(201);
    expect(mockedCreateDeal).toHaveBeenCalled();
  });

  it("rejects a POST with a missing Origin header", async () => {
    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, {}));

    expect(response.status).toBe(403);
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });

  it("rejects a POST with a cross-origin Origin header", async () => {
    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });

  it("rejects a POST with a malformed Origin header", async () => {
    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, { origin: "not-a-url" }));

    expect(response.status).toBe(403);
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });
});

describe("Idempotency-Key on POST /api/deals (#53)", () => {
  const key = "5b0f7c2e-8a41-4d7e-9a35-1c2b3d4e5f60";

  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateDeal.mockReset();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("passes the key to the create, scoped to the session user", async () => {
    mockedCreateDeal.mockResolvedValue({ record: deal, replayed: false });

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, { origin: "http://localhost", "Idempotency-Key": key }));

    expect(response.status).toBe(201);
    expect(mockedCreateDeal).toHaveBeenCalledWith(expect.anything(), "user-1", { brand: "Kopi Nusantara" }, key);
  });

  it("passes no key when the request has none", async () => {
    mockedCreateDeal.mockResolvedValue({ record: deal, replayed: false });

    await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(mockedCreateDeal).toHaveBeenCalledWith(expect.anything(), "user-1", { brand: "Kopi Nusantara" }, null);
  });

  it("answers a repeat of a stored create with 200 and the stored deal", async () => {
    mockedCreateDeal.mockResolvedValue({ record: deal, replayed: true });

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, { origin: "http://localhost", "Idempotency-Key": key }));

    expect(response.status).toBe(200);
    expect((await response.json()).deal.id).toBe(deal.id);
  });

  it("refuses a malformed key with 400 before creating anything", async () => {
    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, { origin: "http://localhost", "Idempotency-Key": "bad key" }));

    expect(response.status).toBe(400);
    expect(mockedCreateDeal).not.toHaveBeenCalled();
  });

  it("answers 409 when the key was used for different content", async () => {
    mockedCreateDeal.mockRejectedValue(new IdempotencyConflictError());

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }, { origin: "http://localhost", "Idempotency-Key": key }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("Permintaan ini bentrok dengan permintaan sebelumnya. Muat ulang halaman lalu coba lagi.");
  });
});
