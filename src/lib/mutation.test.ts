import { afterEach, describe, expect, it, vi } from "vitest";
import { idempotencyKeyFor, mutationErrorKey, newIdempotencyKey, sendMutation } from "./mutation";

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

  it.each([400, 401, 403, 404, 409, 429])("is rejected for a JSON %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { error: "x" })));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "rejected", status, body: { error: "x" } });
  });

  it.each([502, 503, 504, 200])("is unknown for a %i answer that is not JSON (a gateway page)", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(status)));
    await expect(sendMutation("/api/deals", { method: "POST" })).resolves.toEqual({ kind: "unknown" });
  });

  // A gateway that gave up while the app was still storing the request can
  // answer with JSON too; JSON does not prove the app refused it (#53 review).
  it.each([500, 502, 503, 504])("is unknown for a JSON %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { message: "upstream timed out" })));
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

describe("idempotencyKeyFor", () => {
  it("keeps the pending key when the same content is sent again", () => {
    expect(idempotencyKeyFor({ key: "pending-key-0000000001", body: '{"a":1}' }, '{"a":1}')).toBe("pending-key-0000000001");
  });

  it("makes a new key when nothing is pending or the content changed", () => {
    const fresh = idempotencyKeyFor(null, '{"a":1}');
    expect(fresh).toMatch(/^[A-Za-z0-9-]{16,100}$/);
    expect(idempotencyKeyFor({ key: "pending-key-0000000001", body: '{"a":1}' }, '{"a":2}')).not.toBe("pending-key-0000000001");
  });

  it("makes a key of the accepted shape even without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });
    expect(newIdempotencyKey()).toBe("ab".repeat(16));
  });
});
