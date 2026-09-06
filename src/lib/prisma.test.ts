import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class PrismaPg {},
}));

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class PrismaClient {
    static current: unknown;

    constructor() {
      PrismaClient.current = this;
    }

    $transaction() {
      return this === PrismaClient.current;
    }
  },
}));

afterEach(() => {
  delete (globalThis as { prisma?: unknown }).prisma;
  delete process.env.DATABASE_URL;
  vi.resetModules();
});

describe("prisma lazy client", () => {
  it("binds PrismaClient instance methods to the real client", async () => {
    process.env.DATABASE_URL = "postgresql://test.example.invalid/test";

    const { prisma } = await import("./prisma");
    const transaction = (prisma as unknown as { $transaction(): boolean }).$transaction();

    expect(transaction).toBe(true);
  });
});
