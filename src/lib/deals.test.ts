import { describe, expect, it, vi } from "vitest";
import {
  createDeal,
  deleteDeal,
  getOwnedDeal,
  listDeals,
  updateDeal,
  type DealDb,
  type DealRecord,
} from "./deals";

const input = {
  brand: "Kopi Nusantara",
  contactWa: "6281212345678",
  scope: "3 video TikTok",
  feeIdr: 1500000,
  status: "MASUK" as const,
};

function makeDb(records: DealRecord[] = []): DealDb {
  const data = [...records];
  return {
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
  };
}

const existing: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Brand Lama",
  contactWa: "628123456789",
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

    expect(await deleteDeal(db, "deal-1", "user-2")).toBe(false);
    expect(await deleteDeal(db, "deal-1", "user-1")).toBe(true);
    expect(db.deal.delete).toHaveBeenCalledWith({ where: { id: "deal-1" } });
  });
});
