import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { getUserSettings, saveUserSettings } from "@/lib/user-settings";
import { userSettingsRateLimiter } from "@/lib/rate-limit";
import { GET, PATCH } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/user-settings", () => ({
  getUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  userSettingsRateLimiter: { check: vi.fn() },
}));

const mockedAuth = vi.mocked(auth);
const mockedGetUserSettings = vi.mocked(getUserSettings);
const mockedSaveUserSettings = vi.mocked(saveUserSettings);
const mockedRateLimitCheck = vi.mocked(userSettingsRateLimiter.check);

const settingsView = {
  issuerName: "Kenji Creator",
  issuerAddress: "",
  issuerWhatsapp: "",
  issuerEmail: "",
  bankName: "Bank Central",
  bankAccountNumber: "1234567890",
  bankAccountHolder: "Kenji Creator",
  templateSend: "default send",
  templateChase: "default chase",
  updatedAt: null,
};

function patchRequest(body: unknown, headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/me/settings", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function malformedPatchRequest(headers: HeadersInit = { origin: "http://localhost" }) {
  return new Request("http://localhost/api/me/settings", {
    method: "PATCH",
    headers,
    body: "{not valid json",
  });
}

describe("GET /api/me/settings", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedGetUserSettings.mockReset();
  });

  it("rejects a request without a session", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockedGetUserSettings).not.toHaveBeenCalled();
  });

  it("returns the caller's own settings, scoped to the session user id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetUserSettings.mockResolvedValue(settingsView);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockedGetUserSettings).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect((await response.json()).settings).toEqual(settingsView);
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedGetUserSettings.mockRejectedValue(new Error("database details must not leak"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Pengaturan belum bisa dimuat. Coba lagi." });
  });
});

describe("PATCH /api/me/settings", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedSaveUserSettings.mockReset();
    mockedRateLimitCheck.mockReset();
    mockedRateLimitCheck.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 });
  });

  it("rejects a request without a session", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const response = await PATCH(patchRequest({ issuerName: "Kenji" }));

    expect(response.status).toBe(401);
    expect(mockedSaveUserSettings).not.toHaveBeenCalled();
  });

  it("saves valid settings, scoped to the session user id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedSaveUserSettings.mockResolvedValue(settingsView);

    const response = await PATCH(patchRequest({ issuerName: "Kenji Creator" }));

    expect(response.status).toBe(200);
    expect(mockedSaveUserSettings).toHaveBeenCalledWith(expect.anything(), "user-1", { issuerName: "Kenji Creator" });
    expect((await response.json()).settings).toEqual(settingsView);
  });

  it("never lets a client-supplied user id override the session's own id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedSaveUserSettings.mockResolvedValue(settingsView);

    await PATCH(patchRequest({ issuerName: "Kenji Creator", userId: "someone-else" }));

    expect(mockedSaveUserSettings).toHaveBeenCalledWith(expect.anything(), "user-1", expect.anything());
    expect(mockedSaveUserSettings).not.toHaveBeenCalledWith(expect.anything(), "someone-else", expect.anything());
  });

  it("rejects invalid input with a field-level error but no echoed values", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const { userSettingsInputSchema } = await import("@/lib/user-settings-validation");
    const zodError = userSettingsInputSchema.safeParse({ issuerName: "" }).error;
    mockedSaveUserSettings.mockRejectedValue(zodError);

    const response = await PATCH(patchRequest({ issuerName: "", bankAccountNumber: "secret-account-123" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Periksa kembali data pengaturan kamu.");
    expect(JSON.stringify(body)).not.toContain("secret-account-123");
  });

  it("rejects malformed JSON", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(malformedPatchRequest());

    expect(response.status).toBe(400);
    expect(mockedSaveUserSettings).not.toHaveBeenCalled();
  });

  it("returns a controlled 500 without leaking database or field details", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedSaveUserSettings.mockRejectedValue(new Error("bankAccountNumber=999 database details must not leak"));

    const response = await PATCH(patchRequest({ issuerName: "Kenji" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Pengaturan belum bisa disimpan. Coba lagi." });
  });

  it("rejects a request with a missing Origin header", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(patchRequest({ issuerName: "Kenji" }, {}));

    expect(response.status).toBe(403);
    expect(mockedSaveUserSettings).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(patchRequest({ issuerName: "Kenji" }, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(mockedSaveUserSettings).not.toHaveBeenCalled();
  });

  it("keys the rate limiter by the session user id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedSaveUserSettings.mockResolvedValue(settingsView);

    await PATCH(patchRequest({ issuerName: "Kenji" }));

    expect(mockedRateLimitCheck).toHaveBeenCalledWith("user-1");
  });

  it("returns 429 with Retry-After when the limiter rejects the request, before persisting", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockedRateLimitCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });

    const response = await PATCH(patchRequest({ issuerName: "Kenji" }));

    expect(response.status).toBe(429);
    expect(response.headers.has("Retry-After")).toBe(true);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mockedSaveUserSettings).not.toHaveBeenCalled();
  });
});
