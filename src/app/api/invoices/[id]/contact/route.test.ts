import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { getOwnedInvoiceContact } from "@/lib/invoices";
import { GET } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/invoices", () => ({ getOwnedInvoiceContact: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const mockedAuth = vi.mocked(auth);
const mockedGetOwnedInvoiceContact = vi.mocked(getOwnedInvoiceContact);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(id: string) {
  return new Request(`http://localhost/api/invoices/${id}/contact`);
}

beforeEach(() => {
  mockedAuth.mockReset();
  mockedGetOwnedInvoiceContact.mockReset();
});

describe("GET /api/invoices/[id]/contact", () => {
  it("rejects an unauthenticated request", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    expect(mockedGetOwnedInvoiceContact).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the session user, not just the invoice id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoiceContact.mockResolvedValue({
      deal: { contactWa: "628123456789", brand: "Kopi Nusantara" },
    });

    await GET(req("invoice-1"), makeContext("invoice-1"));

    expect(mockedGetOwnedInvoiceContact).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
  });

  it("returns 404 for another user's invoice instead of leaking its contact", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    mockedGetOwnedInvoiceContact.mockResolvedValue(null);

    const response = await GET(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice tidak ditemukan." });
  });

  it("returns the contact WhatsApp number and brand for the owner", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoiceContact.mockResolvedValue({
      deal: { contactWa: "628123456789", brand: "Kopi Nusantara" },
    });

    const response = await GET(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ contactWa: "628123456789", brand: "Kopi Nusantara" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetOwnedInvoiceContact.mockRejectedValue(new Error("db details must not leak"));

    const response = await GET(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Kontak invoice belum bisa dimuat. Coba lagi." });
  });
});
