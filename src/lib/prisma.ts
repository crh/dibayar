import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  // On Preview, the Neon/Vercel integration writes per-branch connection
  // strings under DATABASE_URL_* (a plain DATABASE_URL Secret already
  // occupies that name project-wide), so it must take priority over the
  // static DATABASE_URL there or Preview reads a stale, unrelated branch.
  // Production has no such override and keeps using DATABASE_URL directly.
  const connectionString =
    process.env.VERCEL_ENV === "preview"
      ? (process.env.DATABASE_URL_POSTGRES_URL ?? process.env.DATABASE_URL)
      : process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database-backed M1 routes");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
