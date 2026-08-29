import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  createDeal,
  deleteDeal,
  getOwnedDeal,
  listDeals,
  listDealStageTransitions,
  updateDeal,
  type DealClient,
  type DealDb,
  type DealRecord,
  type DealStageTransitionRecord,
} from "./deals";

const input = {
  brand: "Kopi Nusantara",
  contactWa: "6281212345678",
  scope: "3 video TikTok",
  feeIdr: 1500000,
  status: "MASUK" as const,
};

function makeDb(records: DealRecord[] = []): DealDb {
  // Copy each record, not just the array: db.deal.update below mutates in
  // place, and several tests share the module-level `existing` fixture --
  // without this, one test's update would leak into every later test.
  const data = records.map((record) => ({ ...record }));
  const transitions: DealStageTransitionRecord[] = [];
  const db: DealDb = {
    $transaction: vi.fn(async (fn: (tx: DealClient) => Promise<unknown>) => {
      // Mimics a real transaction's rollback: snapshot both tables and
      // restore them if the callback throws, so tests can assert that a
      // failed transition write leaves no partial mutation behind.
      const dealsBefore = data.map((record) => ({ ...record }));
      const transitionsBefore = transitions.map((record) => ({ ...record }));
      // Prisma's interactive transaction client only exposes model
      // delegates, not $transaction itself, so the callback gets that
      // narrower shape rather than the full db mock.
      const tx: DealClient = { deal: db.deal, dealStageTransition: db.dealStageTransition };
      try {
        return await fn(tx);
      } catch (error) {
        data.length = 0;
        data.push(...dealsBefore);
        transitions.length = 0;
        transitions.push(...transitionsBefore);
        throw error;
      }
    }) as unknown as DealDb["$transaction"],
    deal: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        data.filter((deal) => deal.userId === where.userId),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        data.find((deal) => deal.id === where.id && deal.userId === where.userId) ?? null,
      ),
      create: vi.fn(async ({ data: values }: { data: Omit<DealRecord, "id" | "createdAt" | "updatedAt"> }) => {
        const record: DealRecord = {
          ...values,
          id: `deal-${data.length + 1}`,
          createdAt: new Date("2026-07-13T00:00:00.000Z"),
          updatedAt: new Date("2026-07-13T00:00:00.000Z"),
        };
        data.push(record);
        return record;
      }),
      update: vi.fn(async ({ where, data: values }: { where: { id: string }; data: Partial<DealRecord> }) => {
        const record = data.find((deal) => deal.id === where.id);
        if (!record) throw new Error("missing record");
        Object.assign(record, values);
        return record;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = data.findIndex((deal) => deal.id === where.id);
        if (index === -1) throw new Error("missing record");
        return data.splice(index, 1)[0];
      }),
    },
    dealStageTransition: {
      create: vi.fn(async ({ data: values }) => {
        const record: DealStageTransitionRecord = {
          id: `transition-${transitions.length + 1}`,
          createdAt: new Date(Date.UTC(2026, 6, 13, 0, 0, transitions.length)),
          ...values,
        };
        transitions.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where }: { where: { dealId: string } }) =>
        transitions
          .filter((transition) => transition.dealId === where.dealId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
    },
  };
  return db;
}

const existing: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Brand Lama",
  contactWa: "628123456789",
  contactName: null,
  scope: "Satu konten",
  feeIdr: 800000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-07-12T00:00:00.000Z"),
  updatedAt: new Date("2026-07-12T00:00:00.000Z"),
};

describe("deal repository", () => {
  it("lists only deals owned by the current user", async () => {
    const db = makeDb([existing, { ...existing, id: "deal-2", userId: "user-2" }]);

    const deals = await listDeals(db, "user-1");

    expect(deals).toHaveLength(1);
    expect(deals[0].userId).toBe("user-1");
    expect(db.deal.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    });
  });

  it("creates a deal scoped to the current user", async () => {
    const db = makeDb();

    const deal = await createDeal(db, "user-1", input);

    expect(deal.userId).toBe("user-1");
    expect(deal.brand).toBe("Kopi Nusantara");
    expect(db.deal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", brand: "Kopi Nusantara" }),
    });
  });

  it("stores a valid contact number in normalized international digits", async () => {
    const db = makeDb();

    const deal = await createDeal(db, "user-1", { ...input, contactWa: "+62 812-1234-5678" });

    expect(deal.contactWa).toBe("6281212345678");
    expect(db.deal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contactWa: "6281212345678" }),
    });
  });

  it("stores an optional contact name, defaulting to null when omitted (T-17)", async () => {
    const db = makeDb();

    const withName = await createDeal(db, "user-1", { ...input, contactName: "Budi Santoso" });
    expect(withName.contactName).toBe("Budi Santoso");

    const withoutName = await createDeal(db, "user-1", input);
    expect(withoutName.contactName).toBeNull();
  });

  it("queries by deal ID and owner together", async () => {
    const findFirst = vi.fn(async () => null);
    const db = {
      deal: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as DealDb;

    await getOwnedDeal(db, "deal-1", "user-2");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "deal-1", userId: "user-2" } });
  });

  it("does not update another user's deal", async () => {
    const db = makeDb([existing]);

    const result = await updateDeal(db, "deal-1", "user-2", { status: "DEAL" });

    expect(result).toBeNull();
    expect(db.deal.update).not.toHaveBeenCalled();
  });

  it("deletes a deal only after ownership is confirmed", async () => {
    const db = makeDb([existing]);

    expect(await deleteDeal(db, "deal-1", "user-2")).toEqual({ kind: "not-found" });
    expect(await deleteDeal(db, "deal-1", "user-1")).toEqual({ kind: "deleted" });
    expect(db.deal.delete).toHaveBeenCalledWith({ where: { id: "deal-1" } });
  });

  it("reports has-invoices when the database restricts deletion of a deal with invoices", async () => {
    const db = makeDb([existing]);
    db.deal.delete = vi.fn(async () => {
      throw new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint violated on the constraint: `Invoice_dealId_fkey`",
        { code: "P2003", clientVersion: "7.8.0" },
      );
    });

    const result = await deleteDeal(db, "deal-1", "user-1");

    expect(result).toEqual({ kind: "has-invoices" });
  });

  it("rethrows unrelated database errors during deletion", async () => {
    const db = makeDb([existing]);
    db.deal.delete = vi.fn(async () => {
      throw new Error("connection lost");
    });

    await expect(deleteDeal(db, "deal-1", "user-1")).rejects.toThrow("connection lost");
  });
});

describe("deal stage history (T-17)", () => {
  it("records the initial stage as a transition when a deal is created", async () => {
    const db = makeDb();

    const deal = await createDeal(db, "user-1", input);
    const history = await listDealStageTransitions(db, deal.id);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ dealId: deal.id, fromStatus: null, toStatus: "MASUK" });
  });

  it("records a transition when a deal's status changes", async () => {
    const db = makeDb([existing]);

    await updateDeal(db, "deal-1", "user-1", { status: "NEGO" });
    const history = await listDealStageTransitions(db, "deal-1");

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ dealId: "deal-1", fromStatus: "MASUK", toStatus: "NEGO" });
  });

  it("does not record a transition for a non-status update", async () => {
    const db = makeDb([existing]);

    await updateDeal(db, "deal-1", "user-1", { brand: "Brand Baru" });

    expect(db.dealStageTransition.create).not.toHaveBeenCalled();
  });

  it("does not record a transition when the status patch matches the current status", async () => {
    const db = makeDb([existing]);

    await updateDeal(db, "deal-1", "user-1", { status: "MASUK" });

    expect(db.dealStageTransition.create).not.toHaveBeenCalled();
  });

  it("lists a deal's transitions newest first", async () => {
    const db = makeDb([existing]);

    await updateDeal(db, "deal-1", "user-1", { status: "NEGO" });
    await updateDeal(db, "deal-1", "user-1", { status: "DEAL" });
    const history = await listDealStageTransitions(db, "deal-1");

    expect(history.map((entry) => entry.toStatus)).toEqual(["DEAL", "NEGO"]);
  });

  it("creates the deal and its initial transition inside a single transaction", async () => {
    const db = makeDb();

    await createDeal(db, "user-1", input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not report a created deal when the initial transition write fails", async () => {
    const db = makeDb();
    db.dealStageTransition.create = vi.fn(async () => {
      throw new Error("transition insert failed");
    });

    await expect(createDeal(db, "user-1", input)).rejects.toThrow("transition insert failed");

    const deals = await listDeals(db, "user-1");
    expect(deals).toHaveLength(0);
  });

  it("updates the deal status and records the transition inside a single transaction", async () => {
    const db = makeDb([existing]);

    await updateDeal(db, "deal-1", "user-1", { status: "NEGO" });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not report a status change when the transition write fails", async () => {
    const db = makeDb([existing]);
    db.dealStageTransition.create = vi.fn(async () => {
      throw new Error("transition insert failed");
    });

    await expect(updateDeal(db, "deal-1", "user-1", { status: "NEGO" })).rejects.toThrow(
      "transition insert failed",
    );

    const deal = await getOwnedDeal(db, "deal-1", "user-1");
    expect(deal?.status).toBe("MASUK");
  });

  it("derives fromStatus from a read inside the transaction, not a stale pre-transaction read", async () => {
    const db = makeDb([existing]);
    const runTransaction = db.$transaction;
    db.$transaction = vi.fn((fn: Parameters<DealDb["$transaction"]>[0]) => {
      // Simulate a concurrent transaction committing a status change after
      // updateDeal's outer call started but before its own transaction reads
      // the row -- the recorded fromStatus must reflect this, not whatever
      // status existed when updateDeal was first invoked.
      return db.deal
        .update({ where: { id: "deal-1" }, data: { status: "NEGO" } })
        .then(() => runTransaction(fn));
    }) as unknown as DealDb["$transaction"];

    await updateDeal(db, "deal-1", "user-1", { status: "DEAL" });
    const history = await listDealStageTransitions(db, "deal-1");

    expect(history[0]).toMatchObject({ fromStatus: "NEGO", toStatus: "DEAL" });
  });
});
