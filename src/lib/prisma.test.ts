import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class PrismaPg {
    static lastConnectionString: string | undefined;
    // Each PrismaPg is a real pg connection pool in production, so counting
    // constructions is what proves the client is reused rather than rebuilt.
    static instances = 0;
    connectionString: string | undefined;

    constructor(options: { connectionString: string }) {
      this.connectionString = options.connectionString;
      PrismaPg.lastConnectionString = options.connectionString;
      PrismaPg.instances += 1;
    }
  },
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
  delete process.env.DATABASE_URL_POSTGRES_URL;
  delete process.env.VERCEL_ENV;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("prisma lazy client", () => {
  it("binds PrismaClient instance methods to the real client", async () => {
    process.env.DATABASE_URL = "postgresql://test.example.invalid/test";

    const { prisma } = await import("./prisma");
    const transaction = (prisma as unknown as { $transaction(): boolean }).$transaction();

    expect(transaction).toBe(true);
  });

  it("prefers the Neon-integration pooled URL over the static secret on Preview", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.DATABASE_URL = "postgresql://stale-preview-secret.example.invalid/test";
    process.env.DATABASE_URL_POSTGRES_URL = "postgresql://branch-specific.example.invalid/test";

    const { prisma } = await import("./prisma");
    (prisma as unknown as { $transaction(): boolean }).$transaction();

    const { PrismaPg } = await import("@prisma/adapter-pg");
    expect((PrismaPg as unknown as { lastConnectionString: string }).lastConnectionString).toBe(
      "postgresql://branch-specific.example.invalid/test",
    );
  });

  it("fails closed on Preview when the integration variable is absent, without falling back to DATABASE_URL", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.DATABASE_URL = "postgresql://fallback.example.invalid/test";

    const { prisma } = await import("./prisma");

    expect(() => (prisma as unknown as { $transaction(): boolean }).$transaction()).toThrow(
      "DATABASE_URL_POSTGRES_URL is required for Vercel Preview database connections",
    );
  });

  // Regression guard: `prisma` is a Proxy whose every property access calls
  // getPrismaClient(). While the client was cached only outside production,
  // production built a brand-new PrismaClient -- and a brand-new PrismaPg
  // connection pool -- on each access, exhausting the database's connection
  // budget under ordinary page/API navigation.
  it("builds one client and one connection pool per process in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "postgresql://production.example.invalid/test";

    const { PrismaPg } = await import("@prisma/adapter-pg");
    const poolsBefore = (PrismaPg as unknown as { instances: number }).instances;

    const { prisma } = await import("./prisma");
    const client = prisma as unknown as { $transaction(): boolean };
    client.$transaction();
    client.$transaction();
    client.$transaction();

    expect((PrismaPg as unknown as { instances: number }).instances - poolsBefore).toBe(1);
  });

  it("ignores the Preview integration variable outside of Preview", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = "postgresql://production.example.invalid/test";
    process.env.DATABASE_URL_POSTGRES_URL = "postgresql://should-not-be-used.example.invalid/test";

    const { prisma } = await import("./prisma");
    (prisma as unknown as { $transaction(): boolean }).$transaction();

    const { PrismaPg } = await import("@prisma/adapter-pg");
    expect((PrismaPg as unknown as { lastConnectionString: string }).lastConnectionString).toBe(
      "postgresql://production.example.invalid/test",
    );
  });
});
