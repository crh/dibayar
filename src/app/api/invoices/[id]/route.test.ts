import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { getOwnedInvoice, type InvoiceRecord } from "@/lib/invoices";
import { GET } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/invoices", () => ({
  getOwnedInvoice: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockedAuth = vi.mocked(auth);
const mockedGetOwnedInvoice = vi.mocked(getOwnedInvoice);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
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
});
