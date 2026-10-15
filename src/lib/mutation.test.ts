import { afterEach, describe, expect, it, vi } from "vitest";
import { findCreatedDeal, findCreatedInvoice, mutationErrorKey, readList, sendMutation } from "./mutation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function htmlResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    },
  } as unknown as Response;
}

describe("sendMutation", () => {
  it("is ok for a JSON 2xx answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, { deal: { id: "d1" } })));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "ok", status: 201, body: { deal: { id: "d1" } } });
  });

  it.each([400, 401, 403, 404, 409, 429, 500])("is rejected for the API's own JSON %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { error: "x" })));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "rejected", status, body: { error: "x" } });
  });

  it.each([502, 503, 504, 200])("is unknown for a %i answer that is not JSON (a gateway page)", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(status)));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "unknown" });
  });

  it("is rejected for a 4xx answer that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(404)));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "rejected", status: 404, body: null });
  });

  it("is unknown when the connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "unknown" });
  });

  it("is unknown, within the bounded wait, when no answer comes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const pending = sendMutation("/api/deals", { method: "POST" }, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ kind: "unknown" });
  });
});

describe("mutationErrorKey", () => {
  it("names what to do for an expired session, a refused Origin and the rate limit", () => {
    expect(mutationErrorKey({ kind: "rejected", status: 401, body: null }, "x")).toBe("error.sessionExpired");
    expect(mutationErrorKey({ kind: "rejected", status: 403, body: null }, "x")).toBe("error.originRejected");
    expect(mutationErrorKey({ kind: "rejected", status: 429, body: null }, "x")).toBe("error.rateLimited");
  });

  it("says the outcome is not known when there was no answer", () => {
    expect(mutationErrorKey({ kind: "unknown" }, "x")).toBe("error.connection");
  });

  it("keeps the action's own message for every other refusal, never the server's text", () => {
    for (const status of [400, 404, 409, 500]) {
      expect(mutationErrorKey({ kind: "rejected", status, body: { error: "raw server text" } }, "dashboard.saveError")).toBe("dashboard.saveError");
    }
  });
});

describe("findCreatedDeal", () => {
  const sent = { brand: "  Kopi Nusantara ", contactWa: "0812 3456 7890", scope: " 1 reels ", feeIdr: 1500000 };
  const stored = { id: "new", brand: "Kopi Nusantara", contactWa: "6281234567890", scope: "1 reels", feeIdr: 1500000 };

  it("finds the deal stored the way the server stores what was sent", () => {
    expect(findCreatedDeal([stored], new Set(), sent)).toBe(stored);
  });

  it("ignores a deal the page already had", () => {
    expect(findCreatedDeal([stored], new Set(["new"]), sent)).toBeNull();
  });

  it("ignores a deal that differs in any compared field", () => {
    expect(findCreatedDeal([{ ...stored, feeIdr: 1500001 }], new Set(), sent)).toBeNull();
    expect(findCreatedDeal([{ ...stored, brand: "Kopi" }], new Set(), sent)).toBeNull();
    expect(findCreatedDeal([{ ...stored, scope: "2 reels" }], new Set(), sent)).toBeNull();
    expect(findCreatedDeal([{ ...stored, contactWa: "6281111111111" }], new Set(), sent)).toBeNull();
  });
});

describe("findCreatedInvoice", () => {
  it("finds the deal's invoice, or nothing", () => {
    const invoice = { id: "i1", dealId: "d1" };
    expect(findCreatedInvoice([{ id: "i0", dealId: "d0" }, invoice], "d1")).toBe(invoice);
    expect(findCreatedInvoice([{ id: "i0", dealId: "d0" }], "d1")).toBeNull();
  });
});

describe("readList", () => {
  it("returns the list, or null when the check itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { deals: [{ id: "d1" }] })));
    await expect(readList("/api/deals", "deals")).resolves.toEqual([{ id: "d1" }]);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { error: "x" })));
    await expect(readList("/api/deals", "deals")).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(502)));
    await expect(readList("/api/deals", "deals")).resolves.toBeNull();
  });
});
