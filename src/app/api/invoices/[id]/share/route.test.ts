import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { createOrRegenerateShare, getShareState, revokeShare } from "@/lib/invoice-share";
import { DELETE, GET, POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/invoice-share", () => ({
  getShareState: vi.fn(),
  createOrRegenerateShare: vi.fn(),
  revokeShare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const mockedAuth = vi.mocked(auth);
const mockedGetShareState = vi.mocked(getShareState);
const mockedCreateOrRegenerateShare = vi.mocked(createOrRegenerateShare);
const mockedRevokeShare = vi.mocked(revokeShare);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(method: string, id: string, headers?: HeadersInit) {
  const defaultHeaders = method === "GET" ? undefined : { origin: "http://localhost" };
  return new Request(`http://localhost/api/invoices/${id}/share`, {
    method,
    headers: headers ?? defaultHeaders,
  });
}

beforeEach(() => {
  mockedAuth.mockReset();
  mockedGetShareState.mockReset();
  mockedCreateOrRegenerateShare.mockReset();
  mockedRevokeShare.mockReset();
});

describe("GET /api/invoices/[id]/share", () => {
  it("rejects an unauthenticated request", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET(req("GET", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    expect(mockedGetShareState).not.toHaveBeenCalled();
  });

  it("returns 404 for an invoice not owned by the session user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetShareState.mockResolvedValue({ kind: "not-found" });

    const response = await GET(req("GET", "invoice-x"), makeContext("invoice-x"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Invoice tidak ditemukan.");
  });

  it("returns the active state without a token or hash", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetShareState.mockResolvedValue({
      kind: "state",
      active: true,
      expiresAt: new Date("2026-10-17T00:00:00.000Z"),
    });

    const response = await GET(req("GET", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ active: true, expiresAt: "2026-10-17T00:00:00.000Z" });
    expect(mockedGetShareState).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetShareState.mockRejectedValue(new Error("db details must not leak"));

    const response = await GET(req("GET", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Status berbagi belum bisa dimuat. Coba lagi." });
  });
});

describe("POST /api/invoices/[id]/share", () => {
  it("rejects an unauthenticated request", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await POST(req("POST", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    expect(mockedCreateOrRegenerateShare).not.toHaveBeenCalled();
  });

  it("returns 404 for an invoice not owned by the session user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateOrRegenerateShare.mockResolvedValue({ kind: "not-found" });

    const response = await POST(req("POST", "invoice-x"), makeContext("invoice-x"));

    expect(response.status).toBe(404);
  });

  it("creates or regenerates and returns the plaintext path exactly once", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateOrRegenerateShare.mockResolvedValue({
      kind: "created",
      path: "/i/abc123token",
      expiresAt: new Date("2026-10-17T00:00:00.000Z"),
    });

    const response = await POST(req("POST", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      active: true,
      path: "/i/abc123token",
      expiresAt: "2026-10-17T00:00:00.000Z",
    });
    expect(mockedCreateOrRegenerateShare).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedCreateOrRegenerateShare.mockRejectedValue(new Error("db details must not leak"));

    const response = await POST(req("POST", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Tautan berbagi belum bisa dibuat. Coba lagi." });
  });
});

describe("DELETE /api/invoices/[id]/share", () => {
  it("rejects an unauthenticated request", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await DELETE(req("DELETE", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(401);
    expect(mockedRevokeShare).not.toHaveBeenCalled();
  });

  it("returns 404 for an invoice not owned by the session user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedRevokeShare.mockResolvedValue({ kind: "not-found" });

    const response = await DELETE(req("DELETE", "invoice-x"), makeContext("invoice-x"));

    expect(response.status).toBe(404);
  });

  it("revokes and returns the inactive state", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedRevokeShare.mockResolvedValue({ kind: "revoked" });

    const response = await DELETE(req("DELETE", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: false });
    expect(mockedRevokeShare).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedRevokeShare.mockRejectedValue(new Error("db details must not leak"));

    const response = await DELETE(req("DELETE", "invoice-1"), makeContext("invoice-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Tautan berbagi belum bisa dicabut. Coba lagi." });
  });
});

describe("same-origin protection for POST/DELETE /api/invoices/[id]/share", () => {
  beforeEach(() => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("allows a same-origin POST", async () => {
    mockedCreateOrRegenerateShare.mockResolvedValue({
      kind: "created",
      path: "/i/abc123token",
      expiresAt: new Date("2026-10-17T00:00:00.000Z"),
    });

    const response = await POST(req("POST", "invoice-1", { origin: "http://localhost" }), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(mockedCreateOrRegenerateShare).toHaveBeenCalled();
  });

  it("allows a same-origin DELETE", async () => {
    mockedRevokeShare.mockResolvedValue({ kind: "revoked" });

    const response = await DELETE(req("DELETE", "invoice-1", { origin: "http://localhost" }), makeContext("invoice-1"));

    expect(response.status).toBe(200);
    expect(mockedRevokeShare).toHaveBeenCalled();
  });

  it("rejects a POST with a missing Origin header", async () => {
    const response = await POST(req("POST", "invoice-1", {}), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(mockedCreateOrRegenerateShare).not.toHaveBeenCalled();
  });

  it("rejects a DELETE with a missing Origin header", async () => {
    const response = await DELETE(req("DELETE", "invoice-1", {}), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(mockedRevokeShare).not.toHaveBeenCalled();
  });

  it("rejects a POST with a cross-origin Origin header", async () => {
    const response = await POST(
      req("POST", "invoice-1", { origin: "https://evil.example" }),
      makeContext("invoice-1"),
    );

    expect(response.status).toBe(403);
    expect(mockedCreateOrRegenerateShare).not.toHaveBeenCalled();
  });

  it("rejects a DELETE with a cross-origin Origin header", async () => {
    const response = await DELETE(
      req("DELETE", "invoice-1", { origin: "https://evil.example" }),
      makeContext("invoice-1"),
    );

    expect(response.status).toBe(403);
    expect(mockedRevokeShare).not.toHaveBeenCalled();
  });

  it("rejects a POST with a malformed Origin header", async () => {
    const response = await POST(req("POST", "invoice-1", { origin: "not-a-url" }), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(mockedCreateOrRegenerateShare).not.toHaveBeenCalled();
  });

  it("rejects a DELETE with a malformed Origin header", async () => {
    const response = await DELETE(req("DELETE", "invoice-1", { origin: "not-a-url" }), makeContext("invoice-1"));

    expect(response.status).toBe(403);
    expect(mockedRevokeShare).not.toHaveBeenCalled();
  });

  it("keeps no-store headers on a rejected cross-origin response", async () => {
    const response = await POST(
      req("POST", "invoice-1", { origin: "https://evil.example" }),
      makeContext("invoice-1"),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
