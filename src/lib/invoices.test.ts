import { describe, expect, it, vi } from "vitest";
import {
  createInvoice,
  getOwnedInvoice,
  listInvoices,
  type InvoiceCreateDb,
  type InvoiceReadDb,
  type InvoiceRecord,
  type InvoiceTransactionClient,
} from "./invoices";

const ownedDeal = { id: "deal-1", userId: "user-1", feeIdr: 1_500_000 };

type SequenceRow = { lastSequence: number | bigint };

function makeDb(options: {
  deal?: typeof ownedDeal | null;
  sequenceRows?: SequenceRow[];
  queryRawImpl?: () => Promise<SequenceRow[]>;
  invoiceCreateImpl?: (args: {
    data: Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt">;
  }) => Promise<InvoiceRecord>;
  rejectTransactionAfterQuery?: boolean;
}) {
  const {
    deal = ownedDeal,
    sequenceRows = [{ lastSequence: 1 }],
    queryRawImpl,
    invoiceCreateImpl,
    rejectTransactionAfterQuery = false,
  } = options;

  const queryRaw = vi.fn(queryRawImpl ?? (async () => sequenceRows));
  const invoiceCreate = vi.fn(
    invoiceCreateImpl ??
      (async ({ data }: { data: Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt"> }) => ({
        id: "invoice-1",
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        updatedAt: new Date("2026-07-15T00:00:00.000Z"),
        ...data,
      })),
  );

  const dealFindUnique = vi.fn(async () => deal);

  // $queryRaw is Prisma's tagged-template overload returning PrismaPromise<T>;
  // a plain vi.fn() can't structurally satisfy that brand, so cast at this
  // fake transaction boundary rather than loosening the production type.
  const tx = {
    $queryRaw: queryRaw,
    invoice: { create: invoiceCreate },
  } as unknown as InvoiceTransactionClient;

  const db: InvoiceCreateDb = {
    deal: { findUnique: dealFindUnique },
    $transaction: vi.fn(async (fn) => {
      if (rejectTransactionAfterQuery) {
        await queryRaw();
        throw new Error("db write failed");
      }
      return fn(tx);
    }),
  };

  return { db, dealFindUnique, queryRaw, invoiceCreate };
}

describe("createInvoice", () => {
  it("rejects when the deal belongs to another user without leaking its data", async () => {
    const { db, invoiceCreate } = makeDb({ deal: { ...ownedDeal, userId: "user-2" } });

    const result = await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(result).toBeNull();
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("rejects when the deal does not exist", async () => {
    const { db, invoiceCreate } = makeDb({ deal: null });

    const result = await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(result).toBeNull();
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    const { db, dealFindUnique } = makeDb({});

    await expect(createInvoice(db, "user-1", {})).rejects.toThrow();
    expect(dealFindUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown withholding tax type", async () => {
    const { db } = makeDb({});

    await expect(
      createInvoice(db, "user-1", { dealId: "deal-1", withholdingTaxType: "PPH99" }),
    ).rejects.toThrow();
  });

  it("allocates the atomic monthly invoice number in Jakarta-formatted form", async () => {
    const { db, invoiceCreate } = makeDb({ sequenceRows: [{ lastSequence: 4 }] });

    await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ number: expect.stringMatching(/^INV\/\d{4}\/\d{2}\/\d{3,}$/) }),
    });
  });

  it("snapshots the invoice subtotal from the deal fee, not client input", async () => {
    const { db, invoiceCreate } = makeDb({});

    await createInvoice(db, "user-1", { dealId: "deal-1", subtotalIdr: 999 });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ subtotalIdr: ownedDeal.feeIdr }),
    });
  });

  it("persists the requested withholding tax type", async () => {
    const { db, invoiceCreate } = makeDb({});

    await createInvoice(db, "user-1", { dealId: "deal-1", withholdingTaxType: "PPH23" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ withholdingTaxType: "PPH23" }),
    });
  });

  it("defaults withholding tax type to NONE when omitted", async () => {
    const { db, invoiceCreate } = makeDb({});

    await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ withholdingTaxType: "NONE" }),
    });
  });

  it("defaults status to DRAFT", async () => {
    const { db, invoiceCreate } = makeDb({});

    await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "DRAFT" }),
    });
  });

  it("passes through an optional due date", async () => {
    const { db, invoiceCreate } = makeDb({});

    await createInvoice(db, "user-1", { dealId: "deal-1", dueDate: "2026-08-01" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDate: new Date("2026-08-01") }),
    });
  });

  it("propagates a database failure instead of swallowing it", async () => {
    const { db } = makeDb({ rejectTransactionAfterQuery: true });

    await expect(createInvoice(db, "user-1", { dealId: "deal-1" })).rejects.toThrow(
      "db write failed",
    );
  });

  it("runs the sequence increment and invoice creation in a single transaction", async () => {
    const { db } = makeDb({});

    await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

const existingInvoice: InvoiceRecord = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "NONE",
  status: "DRAFT",
  dueDate: null,
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
};

function makeReadDb(records: InvoiceRecord[] = []): InvoiceReadDb {
  return {
    invoice: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        records.filter((invoice) => invoice.userId === where.userId),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        records.find((invoice) => invoice.id === where.id && invoice.userId === where.userId) ?? null,
      ),
    },
  };
}

describe("listInvoices", () => {
  it("lists only invoices owned by the current user, ordered by status, due date, then newest first", async () => {
    const db = makeReadDb([existingInvoice, { ...existingInvoice, id: "invoice-2", userId: "user-2" }]);

    const invoices = await listInvoices(db, "user-1");

    expect(invoices).toHaveLength(1);
    expect(invoices[0].userId).toBe("user-1");
    expect(db.invoice.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
  });
});

describe("getOwnedInvoice", () => {
  it("returns the invoice when it belongs to the requesting user", async () => {
    const db = makeReadDb([existingInvoice]);

    const invoice = await getOwnedInvoice(db, "invoice-1", "user-1");

    expect(invoice?.id).toBe("invoice-1");
  });

  it("returns null without leaking data for another user's invoice", async () => {
    const db = makeReadDb([existingInvoice]);

    const invoice = await getOwnedInvoice(db, "invoice-1", "user-2");

    expect(invoice).toBeNull();
  });

  it("queries by invoice ID and owner together instead of fetching another tenant's record", async () => {
    const findFirst = vi.fn(async () => null);
    const db = {
      invoice: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst,
      },
    } as unknown as InvoiceReadDb;

    await getOwnedInvoice(db, "invoice-1", "user-2");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "invoice-1", userId: "user-2" } });
  });

  it("returns null for a nonexistent invoice", async () => {
    const db = makeReadDb([]);

    const invoice = await getOwnedInvoice(db, "invoice-x", "user-1");

    expect(invoice).toBeNull();
  });
});
