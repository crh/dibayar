import { nextInvoiceNumber } from "./invoice-number";
import { invoiceCreateSchema } from "./invoice-validation";
import { createInvoiceSequenceDb, type InvoiceSequenceQueryClient } from "./invoice-sequence";

export type InvoiceStatus = "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID";
export type WithholdingTaxType = "NONE" | "PPH21" | "PPH23";

export type InvoiceRecord = {
  id: string;
  userId: string;
  dealId: string;
  number: string;
  subtotalIdr: number;
  withholdingTaxType: WithholdingTaxType;
  status: InvoiceStatus;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type OwnedDeal = { id: string; userId: string; feeIdr: number };

type InvoiceCreateData = {
  userId: string;
  dealId: string;
  number: string;
  subtotalIdr: number;
  withholdingTaxType: WithholdingTaxType;
  status: InvoiceStatus;
  dueDate: Date | null;
};

// Matches Prisma's $transaction callback client: raw query access for the atomic sequence adapter plus invoice.create.
export type InvoiceTransactionClient = InvoiceSequenceQueryClient & {
  invoice: {
    create(args: { data: InvoiceCreateData }): Promise<InvoiceRecord>;
  };
};

export type InvoiceCreateDb = {
  deal: {
    findUnique(args: { where: { id: string } }): Promise<OwnedDeal | null>;
  };
  $transaction<T>(fn: (tx: InvoiceTransactionClient) => Promise<T>): Promise<T>;
};

// Returns null (not a throw) when the deal is missing or not owned by userId, so callers can respond 404 uniformly.
export async function createInvoice(db: InvoiceCreateDb, userId: string, input: unknown) {
  const validated = invoiceCreateSchema.parse(input);

  const deal = await db.deal.findUnique({ where: { id: validated.dealId } });
  if (!deal || deal.userId !== userId) return null;

  return db.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(createInvoiceSequenceDb(tx), userId);
    return tx.invoice.create({
      data: {
        userId,
        dealId: deal.id,
        number,
        subtotalIdr: deal.feeIdr,
        withholdingTaxType: validated.withholdingTaxType,
        status: "DRAFT",
        dueDate: validated.dueDate ?? null,
      },
    });
  });
}
