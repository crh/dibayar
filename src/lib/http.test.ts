import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("resolves with the response when fetch settles before the timeout", async () => {
    const response = { ok: true, status: 200 } as Response;
    vi.stubGlobal("fetch", vi.fn(async () => response));

    await expect(fetchWithTimeout("/api/x", undefined, 1000)).resolves.toBe(response);
  });

  it("rejects once the bounded timeout elapses, even if fetch never settles", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    const pending = fetchWithTimeout("/api/x", undefined, 1000);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("passes an abort signal through to fetch", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithTimeout("/api/x", { method: "POST" }, 1000);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });
});
