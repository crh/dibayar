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
    findFirst(args: { where: { id: string; userId: string } }): Promise<OwnedDeal | null>;
  };
  $transaction<T>(fn: (tx: InvoiceTransactionClient) => Promise<T>): Promise<T>;
};

export type InvoiceReadDb = {
  invoice: {
    findMany(args: {
      where: { userId: string };
      orderBy: Array<Record<string, "asc" | "desc">>;
    }): Promise<InvoiceRecord[]>;
    findFirst(args: { where: { id: string; userId: string } }): Promise<InvoiceRecord | null>;
  };
};

export async function listInvoices(db: InvoiceReadDb, userId: string) {
  return db.invoice.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
}

// Returns null (not a throw) for missing or cross-tenant records so callers can respond 404 uniformly.
export async function getOwnedInvoice(db: InvoiceReadDb, id: string, userId: string) {
  return db.invoice.findFirst({ where: { id, userId } });
}

export type InvoiceStatusDb = {
  invoice: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<InvoiceRecord | null>;
    update(args: { where: { id: string; userId: string }; data: { status: InvoiceStatus } }): Promise<InvoiceRecord>;
  };
};

const ALLOWED_STATUS_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["DUE", "OVERDUE", "PAID"],
  DUE: ["OVERDUE", "PAID"],
  OVERDUE: ["PAID"],
  PAID: [],
};

export type UpdateInvoiceStatusResult =
  | { kind: "updated"; invoice: InvoiceRecord }
  | { kind: "not-found" }
  | { kind: "invalid-transition" };

export async function updateInvoiceStatus(
  db: InvoiceStatusDb,
  id: string,
  userId: string,
  nextStatus: InvoiceStatus,
): Promise<UpdateInvoiceStatusResult> {
  const invoice = await db.invoice.findFirst({ where: { id, userId } });
  if (!invoice) return { kind: "not-found" };
  if (!ALLOWED_STATUS_TRANSITIONS[invoice.status].includes(nextStatus)) {
    return { kind: "invalid-transition" };
  }

  return {
    kind: "updated",
    invoice: await db.invoice.update({ where: { id, userId }, data: { status: nextStatus } }),
  };
}

// Returns null (not a throw) when the deal is missing or not owned by userId, so callers can respond 404 uniformly.
export async function createInvoice(db: InvoiceCreateDb, userId: string, input: unknown) {
  const validated = invoiceCreateSchema.parse(input);

  const deal = await db.deal.findFirst({ where: { id: validated.dealId, userId } });
  if (!deal) return null;

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
