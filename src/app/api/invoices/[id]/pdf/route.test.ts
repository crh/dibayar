import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { auth } from "@/auth";
import { getOwnedInvoice } from "@/lib/invoices";
import { resolveOwnerInvoiceDocument } from "@/lib/invoice-snapshot";
import { renderToBuffer } from "@react-pdf/renderer";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/invoices", () => ({ getOwnedInvoice: vi.fn() }));
vi.mock("@/lib/invoice-snapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/invoice-snapshot")>()),
  resolveOwnerInvoiceDocument: vi.fn(),
}));
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer: vi.fn() };
});

const mockedAuth = vi.mocked(auth);
const mockedGetOwnedInvoice = vi.mocked(getOwnedInvoice);
const mockedResolve = vi.mocked(resolveOwnerInvoiceDocument);
const mockedRenderToBuffer = vi.mocked(renderToBuffer);
const context = { params: Promise.resolve({ id: "invoice-1" }) };

const invoice = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "PPH23" as const,
  status: "SENT" as const,
  dueDate: new Date("2026-07-31T00:00:00.000Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const emptySettings = {
  issuerName: "",
  issuerAddress: "",
  issuerWhatsapp: "",
  issuerEmail: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
};

function documentFor(settings = emptySettings) {
  return {
    frozen: true,
    input: {
      invoice: { id: invoice.id, number: invoice.number, subtotalIdr: invoice.subtotalIdr, withholdingTaxType: invoice.withholdingTaxType, dueDate: invoice.dueDate, createdAt: invoice.createdAt },
      deal: { brand: "Kopi Nusantara", contactName: null, scope: "Video kampanye", paymentTerms: null },
      settings,
    },
  };
}

describe("GET /api/invoices/[id]/pdf", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedGetOwnedInvoice.mockReset();
    mockedResolve.mockReset();
    mockedResolve.mockResolvedValue(documentFor());
    mockedRenderToBuffer.mockReset();
  });

  it("rejects an unauthenticated request", async () => {
    mockedAuth.mockResolvedValue(null as never);
    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), context);
    expect(response.status).toBe(401);
  });

  it("returns 404 when the invoice is not owned", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(null as never);
    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), context);
    expect(response.status).toBe(404);
  });

  it("returns 404 rather than crashing when the invoice's deal is somehow missing", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoice);
    mockedResolve.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), context);
    expect(response.status).toBe(404);
    expect(mockedRenderToBuffer).not.toHaveBeenCalled();
  });

  it("streams an owned invoice as a PDF attachment", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoice);
    mockedRenderToBuffer.mockResolvedValue(Buffer.from("%PDF-1.7 test"));

    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain('filename="INV-2026-07-001.pdf"');
    expect(await response.text()).toBe("%PDF-1.7 test");
    expect(mockedRenderToBuffer).toHaveBeenCalledOnce();
  });

  it("builds the canonical document model from the resolved document (snapshot or live Draft), not empty defaults", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoice);
    mockedResolve.mockResolvedValue(documentFor({ ...emptySettings, issuerName: "Aulia Rahma", bankName: "BCA" }));
    mockedRenderToBuffer.mockResolvedValue(Buffer.from("%PDF"));

    await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), context);

    expect(mockedResolve).toHaveBeenCalledWith(expect.anything(), invoice);
    const documentElement = mockedRenderToBuffer.mock.calls[0][0] as unknown as {
      props: { model: { issuer: { name: string }; bank: { bankName: string } } };
    };
    expect(documentElement.props.model.issuer.name).toBe("Aulia Rahma");
    expect(documentElement.props.model.bank.bankName).toBe("BCA");
  });

  it("returns a controlled 500 when the owned PDF cannot be generated", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoice);
    mockedRenderToBuffer.mockRejectedValue(new Error("renderer details must not leak"));

    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "PDF invoice belum bisa dibuat. Coba lagi." });
  });
});
