import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodError } from "zod";
import { auth } from "@/auth";
import { invoiceCreateSchema } from "@/lib/invoice-validation";
import { createInvoiceOnce, listInvoices, type InvoiceRecord } from "@/lib/invoices";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/invoices", () => ({
  createInvoiceOnce: vi.fn(),
  listInvoices: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedCreateInvoice = vi.mocked(createInvoiceOnce);
const mockedListInvoices = vi.mocked(listInvoices);

function makeRequest(body: unknown, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/invoices", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest(headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/invoices", {
    method: "POST",
    headers,
    body: "{not valid json",
  });
}

function parseInvalidInputError(): ZodError {
  const result = invoiceCreateSchema.safeParse({});
  if (result.success) throw new Error("expected schema.safeParse to fail");
  return result.error;
}

const invoice: InvoiceRecord = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "NONE",
  status: "DRAFT",
  dueDate: null,
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
};

describe("GET /api/invoices", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedListInvoices.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Kamu harus masuk terlebih dahulu.");
    expect(mockedListInvoices).not.toHaveBeenCalled();
  });

  it("mengembalikan daftar invoice milik pengguna yang sedang login", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedListInvoices.mockResolvedValue([invoice]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invoices).toEqual([
      { ...invoice, createdAt: invoice.createdAt.toISOString(), updatedAt: invoice.updatedAt.toISOString() },
    ]);
    expect(mockedListInvoices).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("mengembalikan 500 terkontrol saat daftar invoice gagal dimuat", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedListInvoices.mockRejectedValue(new Error("database details must not leak"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Invoice belum bisa dimuat. Coba lagi." });
  });
});

describe("POST /api/invoices", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateInvoice.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await POST(makeRequest({ dealId: "deal-1" }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Kamu harus masuk terlebih dahulu.");
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });

  it("mengembalikan 400 saat input tidak valid", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateInvoice.mockRejectedValue(parseInvalidInputError());

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Periksa kembali data invoice kamu.");
    expect(body.fields).toBeDefined();
  });

  it("mengembalikan 404 saat deal tidak ditemukan atau bukan milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateInvoice.mockResolvedValue(null);

    const response = await POST(makeRequest({ dealId: "deal-x" }));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Deal tidak ditemukan.");
  });

  it("mengembalikan 201 beserta invoice saat berhasil dibuat", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateInvoice.mockResolvedValue({ record: invoice, replayed: false });

    const response = await POST(makeRequest({ dealId: "deal-1" }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.invoice.id).toBe("invoice-1");
    expect(body.invoice.number).toBe("INV/2026/07/001");
  });

  it("mengembalikan 500 untuk error tak terduga yang bukan ZodError", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateInvoice.mockRejectedValue(new Error("db down"));

    const response = await POST(makeRequest({ dealId: "deal-1" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Invoice belum bisa dibuat. Coba lagi.");
  });

  it("mengembalikan 400 saat body bukan JSON yang valid", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(makeMalformedRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Periksa kembali data invoice kamu.");
    expect(body.fields).toBeUndefined();
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });

  it("mengembalikan 500 terkontrol saat auth() gagal karena masalah infrastruktur", async () => {
    mockedAuth.mockRejectedValue(new Error("auth provider unreachable"));

    const response = await POST(makeRequest({ dealId: "deal-1" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Invoice belum bisa dibuat. Coba lagi.");
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });
});

describe("same-origin protection for POST /api/invoices", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateInvoice.mockReset();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("allows a same-origin POST", async () => {
    mockedCreateInvoice.mockResolvedValue({ record: invoice, replayed: false });

    const response = await POST(makeRequest({ dealId: "deal-1" }));

    expect(response.status).toBe(201);
    expect(mockedCreateInvoice).toHaveBeenCalled();
  });

  it("rejects a POST with a missing Origin header", async () => {
    const response = await POST(makeRequest({ dealId: "deal-1" }, {}));

    expect(response.status).toBe(403);
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });

  it("rejects a POST with a cross-origin Origin header", async () => {
    const response = await POST(makeRequest({ dealId: "deal-1" }, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });

  it("rejects a POST with a malformed Origin header", async () => {
    const response = await POST(makeRequest({ dealId: "deal-1" }, { origin: "not-a-url" }));

    expect(response.status).toBe(403);
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });
});

describe("Idempotency-Key on POST /api/invoices (#53)", () => {
  const key = "5b0f7c2e-8a41-4d7e-9a35-1c2b3d4e5f60";

  beforeEach(() => {
    mockedAuth.mockReset();
    mockedCreateInvoice.mockReset();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("passes the key to the create, scoped to the session user", async () => {
    mockedCreateInvoice.mockResolvedValue({ record: invoice, replayed: false });

    const response = await POST(makeRequest({ dealId: "deal-1" }, { origin: "http://localhost", "Idempotency-Key": key }));

    expect(response.status).toBe(201);
    expect(mockedCreateInvoice).toHaveBeenCalledWith(expect.anything(), "user-1", { dealId: "deal-1" }, key);
  });

  it("passes no key when the request has none", async () => {
    mockedCreateInvoice.mockResolvedValue({ record: invoice, replayed: false });

    await POST(makeRequest({ dealId: "deal-1" }));

    expect(mockedCreateInvoice).toHaveBeenCalledWith(expect.anything(), "user-1", { dealId: "deal-1" }, null);
  });

  it("answers a repeat of a stored create with 200 and the stored invoice", async () => {
    mockedCreateInvoice.mockResolvedValue({ record: invoice, replayed: true });

    const response = await POST(makeRequest({ dealId: "deal-1" }, { origin: "http://localhost", "Idempotency-Key": key }));

    expect(response.status).toBe(200);
    expect((await response.json()).invoice.id).toBe(invoice.id);
  });

  it("refuses a malformed key with 400 before creating anything", async () => {
    const response = await POST(makeRequest({ dealId: "deal-1" }, { origin: "http://localhost", "Idempotency-Key": "bad key" }));

    expect(response.status).toBe(400);
    expect(mockedCreateInvoice).not.toHaveBeenCalled();
  });

  it("answers 409 when the key was used for different content", async () => {
    mockedCreateInvoice.mockRejectedValue(new IdempotencyConflictError());

    const response = await POST(makeRequest({ dealId: "deal-1" }, { origin: "http://localhost", "Idempotency-Key": key }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("Permintaan ini bentrok dengan permintaan sebelumnya. Muat ulang halaman lalu coba lagi.");
  });
});
