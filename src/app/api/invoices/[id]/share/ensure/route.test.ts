import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { ensureShare } from "@/lib/invoice-share";
import { POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/invoice-share", () => ({ ensureShare: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const mockedAuth = vi.mocked(auth);
const mockedEnsureShare = vi.mocked(ensureShare);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(id: string, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request(`http://localhost/api/invoices/${id}/share/ensure`, { method: "POST", headers });
}

beforeEach(() => {
  mockedAuth.mockReset();
  mockedEnsureShare.mockReset();
});

describe("POST /api/invoices/[id]/share/ensure", () => {
  it("rejects an unauthenticated request", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await POST(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    expect(mockedEnsureShare).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request before touching the share", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(req("invoice-1", { origin: "https://evil.example" }), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(mockedEnsureShare).not.toHaveBeenCalled();
  });

  it("rejects a request with no Origin header", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(req("invoice-1", {}), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(mockedEnsureShare).not.toHaveBeenCalled();
  });

  it("returns 404 for an invoice not owned by the session user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedEnsureShare.mockResolvedValue({ kind: "not-found" });

    const response = await POST(req("invoice-x"), makeContext("invoice-x"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice tidak ditemukan." });
    expect(mockedEnsureShare).toHaveBeenCalledWith(expect.anything(), "invoice-x", "user-1");
  });

  it("returns a reused share's path and its unchanged expiry", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedEnsureShare.mockResolvedValue({
      kind: "reused",
      path: "/i/existing-token",
      expiresAt: new Date("2026-10-17T00:00:00.000Z"),
    });

    const response = await POST(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: true,
      path: "/i/existing-token",
      expiresAt: "2026-10-17T00:00:00.000Z",
    });
    expect(mockedEnsureShare).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns a newly created share in the same shape", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedEnsureShare.mockResolvedValue({
      kind: "created",
      path: "/i/new-token",
      expiresAt: new Date("2026-12-30T00:00:00.000Z"),
    });

    const response = await POST(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: true, path: "/i/new-token", expiresAt: "2026-12-30T00:00:00.000Z" });
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedEnsureShare.mockRejectedValue(new Error("db details must not leak"));

    const response = await POST(req("invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Tautan berbagi belum bisa dibuat. Coba lagi." });
  });
});
