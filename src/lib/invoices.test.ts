import { describe, expect, it, vi } from "vitest";
import {
  createInvoice,
  getOwnedInvoice,
  listInvoices,
  listInvoicesWithDealBrand,
  updateInvoiceStatus,
  type InvoiceCreateDb,
  type InvoiceListDb,
  type InvoiceReadDb,
  type InvoiceRecord,
  type InvoiceStatusDb,
  type InvoiceTransactionClient,
  type InvoiceWithDealBrand,
} from "./invoices";

const ownedDeal = { id: "deal-1", userId: "user-1", feeIdr: 1_500_000, deadline: null as Date | null };

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

  const dealFindFirst = vi.fn(async () => deal);

  // $queryRaw is Prisma's tagged-template overload returning PrismaPromise<T>;
  // a plain vi.fn() can't structurally satisfy that brand, so cast at this
  // fake transaction boundary rather than loosening the production type.
  const tx = {
    $queryRaw: queryRaw,
    invoice: { create: invoiceCreate },
  } as unknown as InvoiceTransactionClient;

  const db: InvoiceCreateDb = {
    deal: { findFirst: dealFindFirst },
    $transaction: vi.fn(async (fn) => {
      if (rejectTransactionAfterQuery) {
        await queryRaw();
        throw new Error("db write failed");
      }
      return fn(tx);
    }),
  };

  return { db, dealFindFirst, queryRaw, invoiceCreate };
}

describe("createInvoice", () => {
  it("queries the deal by ID and owner together instead of fetching another tenant's record", async () => {
    const findFirst = vi.fn(async () => null);
    const findUnique = vi.fn(async () => ({ ...ownedDeal, userId: "user-2" }));
    const db = {
      deal: { findFirst, findUnique },
      $transaction: vi.fn(),
    } as unknown as InvoiceCreateDb;

    const result = await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "deal-1", userId: "user-1" } });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the deal does not exist", async () => {
    const { db, invoiceCreate } = makeDb({ deal: null });

    const result = await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(result).toBeNull();
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    const { db, dealFindFirst } = makeDb({});

    await expect(createInvoice(db, "user-1", {})).rejects.toThrow();
    expect(dealFindFirst).not.toHaveBeenCalled();
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

  it("inherits the deal deadline as the invoice due date when no explicit due date is given", async () => {
    const { db, invoiceCreate } = makeDb({
      deal: { ...ownedDeal, deadline: new Date("2026-07-31T00:00:00.000Z") },
    });

    await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDate: new Date("2026-07-31T00:00:00.000Z") }),
    });
  });

  it("lets an explicit due date override the deal deadline", async () => {
    const { db, invoiceCreate } = makeDb({
      deal: { ...ownedDeal, deadline: new Date("2026-07-31T00:00:00.000Z") },
    });

    await createInvoice(db, "user-1", { dealId: "deal-1", dueDate: "2026-08-15" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDate: new Date("2026-08-15") }),
    });
  });

  it("leaves the due date null when neither an explicit due date nor a deal deadline is set", async () => {
    const { db, invoiceCreate } = makeDb({ deal: { ...ownedDeal, deadline: null } });

    await createInvoice(db, "user-1", { dealId: "deal-1" });

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDate: null }),
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

function makeListWithBrandDb(records: InvoiceWithDealBrand[] = []): InvoiceListDb {
  return {
    invoice: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        records.filter((invoice) => invoice.userId === where.userId),
      ),
    },
  };
}

describe("listInvoicesWithDealBrand", () => {
  it("lists only invoices owned by the current user, including the related deal's brand", async () => {
    const owned: InvoiceWithDealBrand = { ...existingInvoice, deal: { brand: "Acme" } };
    const other: InvoiceWithDealBrand = { ...existingInvoice, id: "invoice-2", userId: "user-2", deal: { brand: "Other Co" } };
    const db = makeListWithBrandDb([owned, other]);

    const invoices = await listInvoicesWithDealBrand(db, "user-1");

    expect(invoices).toHaveLength(1);
    expect(invoices[0].userId).toBe("user-1");
    expect(invoices[0].deal.brand).toBe("Acme");
    expect(db.invoice.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: { deal: { select: { brand: true } } },
    });
  });

  it("excludes a second owner's invoices entirely", async () => {
    const other: InvoiceWithDealBrand = { ...existingInvoice, id: "invoice-2", userId: "user-2", deal: { brand: "Other Co" } };
    const db = makeListWithBrandDb([other]);

    const invoices = await listInvoicesWithDealBrand(db, "user-1");

    expect(invoices).toHaveLength(0);
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

describe("updateInvoiceStatus", () => {
  function makeStatusDb(invoice: InvoiceRecord | null) {
    const findFirst = vi.fn(async () => invoice);
    const update = vi.fn(async ({ data }: { data: { status: InvoiceRecord["status"] } }) => ({
      ...existingInvoice,
      status: data.status,
    }));
    return { db: { invoice: { findFirst, update } } as unknown as InvoiceStatusDb, findFirst, update };
  }

  it("updates an owned draft invoice to SENT", async () => {
    const { db, findFirst, update } = makeStatusDb(existingInvoice);

    const result = await updateInvoiceStatus(db, "invoice-1", "user-1", "SENT");

    expect(result).toMatchObject({ kind: "updated", invoice: { status: "SENT" } });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "invoice-1", userId: "user-1" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "invoice-1", userId: "user-1" },
      data: { status: "SENT" },
    });
  });

  it("rejects an invalid DRAFT to PAID transition without writing", async () => {
    const { db, update } = makeStatusDb(existingInvoice);

    const result = await updateInvoiceStatus(db, "invoice-1", "user-1", "PAID");

    expect(result).toEqual({ kind: "invalid-transition" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns not-found without writing when the invoice is missing or foreign", async () => {
    const { db, update } = makeStatusDb(null);

    const result = await updateInvoiceStatus(db, "invoice-x", "user-1", "SENT");

    expect(result).toEqual({ kind: "not-found" });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows undoing a PAID invoice back to SENT (T-19)", async () => {
    const { db, update } = makeStatusDb({ ...existingInvoice, status: "PAID" });

    const result = await updateInvoiceStatus(db, "invoice-1", "user-1", "SENT");

    expect(result).toMatchObject({ kind: "updated", invoice: { status: "SENT" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "invoice-1", userId: "user-1" },
      data: { status: "SENT" },
    });
  });

  it("rejects PAID to any status other than SENT (T-19 undo is the only PAID transition)", async () => {
    const { db, update } = makeStatusDb({ ...existingInvoice, status: "PAID" });

    const result = await updateInvoiceStatus(db, "invoice-1", "user-1", "DUE");

    expect(result).toEqual({ kind: "invalid-transition" });
    expect(update).not.toHaveBeenCalled();
  });
});
