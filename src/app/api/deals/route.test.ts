import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodError } from "zod";
import { auth } from "@/auth";
import { dealInputSchema } from "@/lib/deal-validation";
import { createDeal, listDeals, type DealRecord } from "@/lib/deals";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/deals", () => ({
  createDeal: vi.fn(),
  listDeals: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedCreateDeal = vi.mocked(createDeal);
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
    mockedCreateDeal.mockResolvedValue(deal);

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

describe("POST /api/deals failure diagnostics (issue #50)", () => {
  const IPHONE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateDeal.mockReset();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  function loggedEntry() {
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line.startsWith("[deal-create-failed] ")).toBe(true);
    return { line, entry: JSON.parse(line.slice("[deal-create-failed] ".length)) };
  }

  it("names the rejected fields and Zod codes, never the values typed", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-secret-id" } } as never);
    const input = { brand: "Rahasia Brand", contactWa: "12345", scope: "Isi scope", feeIdr: 1_000_000 };
    const parsed = dealInputSchema.safeParse(input);
    if (parsed.success) throw new Error("expected the short number to fail");
    mockedCreateDeal.mockRejectedValue(parsed.error);

    const response = await POST(makeRequest(input, { origin: "http://localhost", "user-agent": IPHONE_UA }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("INVALID_INPUT");
    expect(body.ref).toMatch(/^[0-9a-f]{8}$/);
    expect(Object.keys(body.fields)).toEqual(["contactWa"]);

    const { line, entry } = loggedEntry();
    expect(entry).toEqual({
      ref: body.ref,
      status: 400,
      code: "INVALID_INPUT",
      device: "ios",
      issues: [{ path: "contactWa", code: "too_small" }],
    });
    for (const secret of ["12345", "Rahasia Brand", "Isi scope", "user-secret-id", "iPhone OS"]) {
      expect(line).not.toContain(secret);
    }
  });

  it.each([
    ["no session", () => mockedAuth.mockResolvedValue(null as never), makeRequest({}), 401, "UNAUTHENTICATED"],
    [
      "a cross-origin request",
      () => mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never),
      makeRequest({}, { origin: "https://evil.example" }),
      403,
      "ORIGIN_REJECTED",
    ],
    [
      "a body that is not JSON",
      () => mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never),
      makeMalformedRequest(),
      400,
      "INVALID_JSON",
    ],
  ] as const)("reports %s with its own code", async (_label, arrange, request, status, code) => {
    arrange();

    const response = await POST(request);

    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.code).toBe(code);
    const { entry } = loggedEntry();
    expect(entry).toMatchObject({ ref: body.ref, status, code, device: "other" });
  });

  it("records a Prisma error code for a server failure, not its message", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateDeal.mockRejectedValue(Object.assign(new Error("connect to db-host.internal failed"), { code: "P1001" }));

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Deal belum bisa disimpan. Coba lagi.", code: "SERVER_ERROR", ref: body.ref });
    const { line, entry } = loggedEntry();
    expect(entry.errorName).toBe("P1001");
    expect(line).not.toContain("db-host");
  });

  it("logs nothing for a deal that is saved", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateDeal.mockResolvedValue(deal);

    const response = await POST(makeRequest({ brand: "Kopi Nusantara" }));

    expect(response.status).toBe(201);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("same-origin protection for POST /api/deals", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateDeal.mockReset();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("allows a same-origin POST", async () => {
    mockedCreateDeal.mockResolvedValue(deal);

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
