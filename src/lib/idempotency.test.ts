import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { createOnce, IdempotencyConflictError, readIdempotencyKey } from "./idempotency";

function requestWith(key?: string) {
  return new Request("http://localhost/api/deals", { method: "POST", headers: key === undefined ? {} : { "Idempotency-Key": key } });
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`userId`,`idempotencyKey`)", {
    code: "P2002",
    clientVersion: "7.8.0",
  });
}

describe("readIdempotencyKey", () => {
  it("is null when the request has no key (older pages, scripts)", () => {
    expect(readIdempotencyKey(requestWith())).toEqual({ ok: true, key: null });
  });

  it("accepts a random UUID", () => {
    const key = "5b0f7c2e-8a41-4d7e-9a35-1c2b3d4e5f60";
    expect(readIdempotencyKey(requestWith(key))).toEqual({ ok: true, key });
  });

  it.each(["", "short", "has spaces in it 1234", "x".repeat(101), "quote\"in-the-key-000"])("refuses %j", (key) => {
    expect(readIdempotencyKey(requestWith(key))).toEqual({ ok: false });
  });
});

describe("createOnce", () => {
  const same = () => true;

  it("creates when nothing is stored under the key", async () => {
    const create = vi.fn(async () => "new");
    await expect(createOnce(async () => null, create, same)).resolves.toEqual({ record: "new", replayed: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns the stored row for a repeat, without writing", async () => {
    const create = vi.fn(async () => "new");
    await expect(createOnce(async () => "stored", create, same)).resolves.toEqual({ record: "stored", replayed: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a key already used for different content", async () => {
    const create = vi.fn(async () => "new");
    await expect(createOnce(async () => "stored", create, () => false)).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  // The first request had not committed when this one looked; its insert
  // then waited on the unique index and failed once the first committed.
  it("returns the first request's row when this one loses the race on the unique index", async () => {
    const find = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null).mockResolvedValueOnce("winner");
    await expect(createOnce(find, async () => Promise.reject(uniqueViolation()), same)).resolves.toEqual({
      record: "winner",
      replayed: true,
    });
  });

  it("refuses the race winner too when its content differs", async () => {
    const find = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null).mockResolvedValueOnce("winner");
    await expect(createOnce(find, async () => Promise.reject(uniqueViolation()), () => false)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it("rethrows a unique violation when no row holds the key (another constraint)", async () => {
    const violation = uniqueViolation();
    await expect(createOnce(async () => null, async () => Promise.reject(violation), same)).rejects.toBe(violation);
  });

  it("rethrows any other failure without looking again", async () => {
    const find = vi.fn(async () => null);
    await expect(createOnce(find, async () => Promise.reject(new Error("db down")), same)).rejects.toThrow("db down");
    expect(find).toHaveBeenCalledTimes(1);
  });
});
