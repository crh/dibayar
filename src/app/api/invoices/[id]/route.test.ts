import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { getOwnedInvoice, updateInvoiceStatus, type InvoiceRecord } from "@/lib/invoices";
import { GET, PATCH } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/invoices", () => ({
  getOwnedInvoice: vi.fn(),
  updateInvoiceStatus: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedGetOwnedInvoice = vi.mocked(getOwnedInvoice);
const mockedUpdateInvoiceStatus = vi.mocked(updateInvoiceStatus);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(id: string, body: unknown, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request(`http://localhost/api/invoices/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function malformedPatchRequest(id: string, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request(`http://localhost/api/invoices/${id}`, {
    method: "PATCH",
    headers,
    body: "{not valid json",
  });
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

describe("GET /api/invoices/[id]", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedGetOwnedInvoice.mockReset();
    mockedUpdateInvoiceStatus.mockReset();
  });

  it("menolak permintaan tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET(new Request("http://localhost/api/invoices/invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Kamu harus masuk terlebih dahulu.");
    expect(mockedGetOwnedInvoice).not.toHaveBeenCalled();
  });

  it("mengembalikan 404 saat invoice tidak ditemukan atau bukan milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/invoices/invoice-x"), makeContext("invoice-x"));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Invoice tidak ditemukan.");
  });

  it("mengembalikan 200 beserta invoice milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoice);

    const response = await GET(new Request("http://localhost/api/invoices/invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invoice.id).toBe("invoice-1");
    expect(mockedGetOwnedInvoice).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
  });

  it("mengembalikan 500 terkontrol saat detail invoice gagal dimuat", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockRejectedValue(new Error("database details must not leak"));

    const response = await GET(new Request("http://localhost/api/invoices/invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Invoice belum bisa dimuat. Coba lagi." });
  });

  it("menolak perubahan status tanpa sesi login", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await PATCH(patchRequest("invoice-1", { status: "SENT" }), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    expect(mockedUpdateInvoiceStatus).not.toHaveBeenCalled();
  });

  it("mengembalikan 409 untuk transisi status yang tidak diizinkan", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateInvoiceStatus.mockResolvedValue({ kind: "invalid-transition" });

    const response = await PATCH(patchRequest("invoice-1", { status: "PAID" }), makeContext("invoice-1"));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("Status invoice tidak bisa diubah seperti itu.");
  });

  it("memperbarui status invoice milik pengguna", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateInvoiceStatus.mockResolvedValue({ kind: "updated", invoice: { ...invoice, status: "SENT" } });

    const response = await PATCH(patchRequest("invoice-1", { status: "SENT" }), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(mockedUpdateInvoiceStatus).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1", "SENT");
    expect((await response.json()).invoice.status).toBe("SENT");
  });

  it("mengembalikan 400 saat body bukan JSON yang valid", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(malformedPatchRequest("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Status invoice tidak valid.");
    expect(mockedUpdateInvoiceStatus).not.toHaveBeenCalled();
  });

  it("mengembalikan 500 terkontrol saat auth() gagal karena masalah infrastruktur", async () => {
    mockedAuth.mockRejectedValue(new Error("auth provider unreachable"));

    const response = await PATCH(patchRequest("invoice-1", { status: "SENT" }), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Status invoice belum bisa diperbarui. Coba lagi.");
    expect(mockedUpdateInvoiceStatus).not.toHaveBeenCalled();
  });
});

describe("same-origin protection for PATCH /api/invoices/[id]", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedUpdateInvoiceStatus.mockReset();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("allows a same-origin PATCH", async () => {
    mockedUpdateInvoiceStatus.mockResolvedValue({ kind: "updated", invoice: { ...invoice, status: "SENT" } });

    const response = await PATCH(patchRequest("invoice-1", { status: "SENT" }), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(mockedUpdateInvoiceStatus).toHaveBeenCalled();
  });

  it("rejects a PATCH with a missing Origin header", async () => {
    const response = await PATCH(patchRequest("invoice-1", { status: "SENT" }, {}), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(mockedUpdateInvoiceStatus).not.toHaveBeenCalled();
  });

  it("rejects a PATCH with a cross-origin Origin header", async () => {
    const response = await PATCH(
      patchRequest("invoice-1", { status: "SENT" }, { origin: "https://evil.example" }),
      makeContext("invoice-1"),
    );

    expect(response.status).toBe(403);
    expect(mockedUpdateInvoiceStatus).not.toHaveBeenCalled();
  });

  it("rejects a PATCH with a malformed Origin header", async () => {
    const response = await PATCH(
      patchRequest("invoice-1", { status: "SENT" }, { origin: "not-a-url" }),
      makeContext("invoice-1"),
    );

    expect(response.status).toBe(403);
    expect(mockedUpdateInvoiceStatus).not.toHaveBeenCalled();
  });
});
