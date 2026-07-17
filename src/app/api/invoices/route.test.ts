import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodError } from "zod";
import { auth } from "@/auth";
import { invoiceCreateSchema } from "@/lib/invoice-validation";
import { createInvoice, listInvoices, type InvoiceRecord } from "@/lib/invoices";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/invoices", () => ({
  createInvoice: vi.fn(),
  listInvoices: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedCreateInvoice = vi.mocked(createInvoice);
const mockedListInvoices = vi.mocked(listInvoices);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest() {
  return new Request("http://localhost/api/invoices", {
    method: "POST",
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
    mockedCreateInvoice.mockResolvedValue(invoice);

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
