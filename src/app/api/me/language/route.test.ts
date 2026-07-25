import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { updateUserLanguage } from "@/lib/user-language";
import { userLanguageRateLimiter } from "@/lib/rate-limit";
import { PATCH } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/user-language", () => ({
  updateUserLanguage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  userLanguageRateLimiter: { check: vi.fn() },
}));

const mockedAuth = vi.mocked(auth);
const mockedUpdateUserLanguage = vi.mocked(updateUserLanguage);
const mockedRateLimitCheck = vi.mocked(userLanguageRateLimiter.check);

function patchRequest(body: unknown, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/me/language", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function malformedPatchRequest(headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/me/language", {
    method: "PATCH",
    headers,
    body: "{not valid json",
  });
}

describe("PATCH /api/me/language", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedUpdateUserLanguage.mockReset();
    mockedRateLimitCheck.mockReset();
    mockedRateLimitCheck.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
  });

  it("rejects a request without a session", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await PATCH(patchRequest({ language: "id" }));

    expect(response.status).toBe(401);
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalled();
  });

  it("persists a valid language, scoped to the session user id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateUserLanguage.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest({ language: "id" }));

    expect(response.status).toBe(200);
    expect(mockedUpdateUserLanguage).toHaveBeenCalledWith(expect.anything(), "user-1", "id");
    expect((await response.json()).language).toBe("id");
  });

  it("never lets a client-supplied user id override the session's own id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateUserLanguage.mockResolvedValue(undefined);

    await PATCH(patchRequest({ language: "en", userId: "someone-else" }));

    expect(mockedUpdateUserLanguage).toHaveBeenCalledWith(expect.anything(), "user-1", "en");
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalledWith(expect.anything(), "someone-else", expect.anything());
  });

  it("rejects an invalid language value", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(patchRequest({ language: "fr" }));

    expect(response.status).toBe(400);
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(malformedPatchRequest());

    expect(response.status).toBe(400);
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalled();
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateUserLanguage.mockRejectedValue(new Error("database details must not leak"));

    const response = await PATCH(patchRequest({ language: "id" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Preferensi bahasa belum bisa disimpan. Coba lagi." });
  });

  it("rejects a request with a missing Origin header", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(patchRequest({ language: "id" }, {}));

    expect(response.status).toBe(403);
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(patchRequest({ language: "id" }, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalled();
  });

  it("keys the rate limiter by the session user id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedUpdateUserLanguage.mockResolvedValue(undefined);

    await PATCH(patchRequest({ language: "id" }));

    expect(mockedRateLimitCheck).toHaveBeenCalledWith("user-1");
  });

  it("returns 429 with Retry-After when the limiter rejects the request, before persisting", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedRateLimitCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });

    const response = await PATCH(patchRequest({ language: "id" }));

    expect(response.status).toBe(429);
    expect(response.headers.has("Retry-After")).toBe(true);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mockedUpdateUserLanguage).not.toHaveBeenCalled();
  });
});
