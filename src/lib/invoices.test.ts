import { describe, expect, it, vi } from "vitest";
import {
  createInvoice,
  type InvoiceCreateDb,
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
