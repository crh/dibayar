import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { InvoiceSequenceDb } from "./invoice-number";

/**
 * Minimal slice of the generated PrismaClient this adapter needs. Matches
 * the `@/lib/prisma` proxy's surface (and any real PrismaClient instance)
 * without requiring the full generated type.
 */
export type InvoiceSequenceQueryClient = Pick<PrismaClient, "$queryRaw">;

type InvoiceSequenceRow = { lastSequence: number | bigint };

/**
 * Real Postgres-backed implementation of the `InvoiceSequenceDb` contract
 * (see src/lib/invoice-number.ts). Uses a single parameterized
 * INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING statement so
 * concurrent callers for the same (userId, year, month) serialize on the
 * row lock instead of racing a read-then-write.
 */
export function createInvoiceSequenceDb(client: InvoiceSequenceQueryClient): InvoiceSequenceDb {
  return {
    invoiceSequence: {
      async increment({ userId, year, month }) {
        const rows = await client.$queryRaw<InvoiceSequenceRow[]>(Prisma.sql`
          INSERT INTO "InvoiceSequence" ("id", "userId", "year", "month", "lastSequence", "updatedAt")
          VALUES (${randomUUID()}, ${userId}, ${year}, ${month}, 1, now())
          ON CONFLICT ("userId", "year", "month")
          DO UPDATE SET
            "lastSequence" = "InvoiceSequence"."lastSequence" + 1,
            "updatedAt" = now()
          RETURNING "lastSequence"
        `);

        const row = rows[0];
        if (!row) {
          throw new Error(
            `InvoiceSequence upsert returned no row for userId=${userId} year=${year} month=${month}`,
          );
        }

        return { lastSequence: Number(row.lastSequence) };
      },
    },
  };
}

export const invoiceSequenceDb = createInvoiceSequenceDb(prisma);
